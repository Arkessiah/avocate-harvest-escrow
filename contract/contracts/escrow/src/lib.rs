#![no_std]
use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, token, Address, BytesN, Env,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 30 * DAY_IN_LEDGERS;
const BPS_DENOMINATOR: i128 = 10_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidState = 1,
    NotExpired = 2,
    InvalidAmount = 3,
    InvalidFee = 4,
    InvalidDeadline = 5,
    AlreadyValidated = 6,
    NotValidated = 7,
    AlreadyAdvanced = 8,
    /// Repaying the pool plus the financing fee must fit inside the price.
    AdvanceTooLarge = 9,
    /// Only the buyer or the farmer of the trade may do this.
    NotAParty = 10,
    /// The delivery was validated as conforming: the trade can only be paid out now.
    DeliveryConforming = 11,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum State {
    Pending,
    Funded,
    Released,
    Refunded,
    /// Dropped before any money was deposited.
    Cancelled,
}

/// Who takes part in the trade.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Parties {
    pub buyer: Address,
    pub seller: Address,
    /// Treasury receiving the platform fees.
    pub platform: Address,
    pub agent: Address,
    pub validator: Address,
    /// Financing pool allowed to advance money to the seller on this trade.
    pub pool: Address,
}

/// Economic terms, snapshotted from the platform's schedule when the trade is created.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Terms {
    pub token: Address,
    pub amount: i128,
    pub trade_fee_bps: u32,
    pub financing_fee_bps: u32,
    pub pool_yield_bps: u32,
    pub deadline: u64,
}

/// Trade terms, fixed at deploy time. Nobody can change who gets paid or how much.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub buyer: Address,
    pub seller: Address,
    pub platform: Address,
    /// Service account that may settle the trade on its own, once delivery is validated.
    pub agent: Address,
    /// Independent inspector that attests whether the delivery conforms.
    pub validator: Address,
    pub pool: Address,
    pub token: Address,
    /// Price of the goods; the seller receives it in full.
    pub amount: i128,
    /// Service fee charged to the buyer on top of the price, snapshotted at creation so
    /// later changes to the platform's fee schedule never alter an agreed trade.
    pub trade_fee_bps: u32,
    /// Charged to the seller on an advance from the pool, paid to the treasury.
    pub financing_fee_bps: u32,
    /// Return owed to the pool on an advance.
    pub pool_yield_bps: u32,
    /// Unix timestamp after which the buyer may take the funds back.
    pub deadline: u64,
}

#[contracttype]
enum DataKey {
    Config,
    State,
    Validation,
    Advance,
}

/// Money the pool put in the seller's hands before delivery. `repay` is the most it can be
/// owed (principal plus the full yield, reached at the deadline); the yield actually paid
/// grows with the time the farmer had the money, from `start`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Advance {
    pub principal: i128,
    pub repay: i128,
    pub start: u64,
}

// Callbacks the escrow makes into the financing pool once a financed trade ends.
#[contractclient(name = "PoolClient")]
pub trait PoolCallbacks {
    fn on_repaid(env: Env, escrow: Address, amount: i128);
    fn on_written_off(env: Env, escrow: Address);
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Validation {
    pub ok: bool,
    /// Hash of the inspection report kept off-chain, so the verdict can be audited later.
    pub report_hash: BytesN<32>,
}

#[contractevent]
pub struct Funded {
    #[topic]
    pub buyer: Address,
    pub amount: i128,
    pub fee: i128,
}

#[contractevent]
pub struct Released {
    #[topic]
    pub seller: Address,
    /// Who settled: the buyer confirming, or the agent after a positive validation.
    pub by: Address,
    pub amount: i128,
    pub fee: i128,
}

#[contractevent]
pub struct Advanced {
    #[topic]
    pub seller: Address,
    pub principal: i128,
    pub repay: i128,
}

#[contractevent]
pub struct Validated {
    #[topic]
    pub validator: Address,
    pub ok: bool,
    pub report_hash: BytesN<32>,
}

#[contractevent]
pub struct Refunded {
    #[topic]
    pub buyer: Address,
    pub amount: i128,
}

#[contractevent]
pub struct Cancelled {
    #[topic]
    pub by: Address,
}

/// One instance per trade: the buyer locks the price in a stablecoin and the seller is
/// paid the moment delivery is confirmed.
#[contract]
pub struct Escrow;

#[contractimpl]
impl Escrow {
    pub fn __constructor(env: Env, parties: Parties, terms: Terms) {
        if terms.amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let fees = [terms.trade_fee_bps, terms.financing_fee_bps, terms.pool_yield_bps];
        if fees.iter().any(|f| i128::from(*f) > BPS_DENOMINATOR) {
            panic_with_error!(&env, Error::InvalidFee);
        }
        if terms.deadline <= env.ledger().timestamp() {
            panic_with_error!(&env, Error::InvalidDeadline);
        }
        let config = Config {
            buyer: parties.buyer,
            seller: parties.seller,
            platform: parties.platform,
            agent: parties.agent,
            validator: parties.validator,
            pool: parties.pool,
            token: terms.token,
            amount: terms.amount,
            trade_fee_bps: terms.trade_fee_bps,
            financing_fee_bps: terms.financing_fee_bps,
            pool_yield_bps: terms.pool_yield_bps,
            deadline: terms.deadline,
        };
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::State, &State::Pending);
        bump(&env);
    }

    /// Buyer locks the price plus the service fee in the contract.
    pub fn fund(env: Env) -> Result<(), Error> {
        let config = config(&env);
        require_state(&env, State::Pending)?;
        config.buyer.require_auth();

        let fee = trade_fee(&config);
        set_state(&env, State::Funded);
        token::TokenClient::new(&env, &config.token).transfer(
            &config.buyer,
            &env.current_contract_address(),
            &(config.amount + fee),
        );
        Funded { buyer: config.buyer, amount: config.amount, fee }.publish(&env);
        bump(&env);
        Ok(())
    }

    /// Either party drops the trade while nothing has been deposited. Once the buyer has
    /// funded it, the money only leaves through settlement or refund.
    pub fn cancel(env: Env, by: Address) -> Result<(), Error> {
        let config = config(&env);
        require_state(&env, State::Pending)?;
        if by != config.buyer && by != config.seller {
            return Err(Error::NotAParty);
        }
        by.require_auth();
        set_state(&env, State::Cancelled);
        Cancelled { by }.publish(&env);
        bump(&env);
        Ok(())
    }

    /// Buyer accepts the delivery: the seller gets the full price, the platform its fee.
    pub fn confirm_delivery(env: Env) -> Result<(), Error> {
        let config = config(&env);
        require_state(&env, State::Funded)?;
        config.buyer.require_auth();
        settle(&env, &config, &config.buyer);
        Ok(())
    }

    /// Records an advance the pool has just paid to the seller. Only the trade's pool can
    /// call it, and the buyer co-signs: by signing they accept that, if the trade is
    /// refunded on the deadline, the pool is repaid from their deposit first. The amount
    /// owed is computed here from the snapshotted yield, never taken from the caller.
    pub fn register_advance(env: Env, principal: i128) -> Result<(), Error> {
        let config = config(&env);
        require_state(&env, State::Funded)?;
        if advance(&env).is_some() {
            return Err(Error::AlreadyAdvanced);
        }
        // Once there is a verdict the outcome is decided; financing it then would only
        // serve to extract money from a trade that is about to be refunded.
        if validation(&env).is_some() {
            return Err(Error::InvalidState);
        }
        if env.ledger().timestamp() >= config.deadline {
            return Err(Error::InvalidDeadline);
        }
        if principal <= 0 {
            return Err(Error::InvalidAmount);
        }
        let repay = principal + bps(principal, config.pool_yield_bps);
        if repay + bps(principal, config.financing_fee_bps) > config.amount {
            return Err(Error::AdvanceTooLarge);
        }
        config.pool.require_auth();
        config.buyer.require_auth();

        let start = env.ledger().timestamp();
        env.storage().instance().set(&DataKey::Advance, &Advance { principal, repay, start });
        Advanced { seller: config.seller, principal, repay }.publish(&env);
        bump(&env);
        Ok(())
    }

    pub fn advance(env: Env) -> Option<Advance> {
        advance(&env)
    }

    /// The validator attests the delivery. Allowed once: a verdict that could be rewritten
    /// would let a negative attestation be swapped in after the fact to unlock a refund.
    pub fn validate(env: Env, ok: bool, report_hash: BytesN<32>) -> Result<(), Error> {
        let config = config(&env);
        require_state(&env, State::Funded)?;
        if env.storage().instance().has(&DataKey::Validation) {
            return Err(Error::AlreadyValidated);
        }
        config.validator.require_auth();

        let validation = Validation { ok, report_hash: report_hash.clone() };
        env.storage().instance().set(&DataKey::Validation, &validation);
        // A rejected delivery means the advance will not come back. The pool books the loss
        // now, not when the buyer gets round to the refund: otherwise depositors who notice
        // first could leave at a price that still counts the lost money.
        if !ok && advance(&env).is_some() {
            PoolClient::new(&env, &config.pool).on_written_off(&env.current_contract_address());
        }
        Validated { validator: config.validator, ok, report_hash }.publish(&env);
        bump(&env);
        Ok(())
    }

    /// The agent settles on the buyer's behalf. Its only power is to trigger the payout
    /// agreed at deploy time (recipients and amounts are fixed), and only after the
    /// independent validator attested a conforming delivery.
    pub fn agent_release(env: Env) -> Result<(), Error> {
        let config = config(&env);
        require_state(&env, State::Funded)?;
        match validation(&env) {
            Some(v) if v.ok => {}
            _ => return Err(Error::NotValidated),
        }
        config.agent.require_auth();
        settle(&env, &config, &config.agent);
        Ok(())
    }

    /// The buyer recovers the whole deposit, fee included, once the deadline passes or as
    /// soon as the validator rejects the delivery: no delivery, no service charged. After a
    /// conforming validation there is no refund: the goods were delivered, so the trade can
    /// only be paid out to the farmer.
    ///
    /// On a financed trade the two exits differ on purpose. A rejection by the independent
    /// validator is a real dispute: the buyer gets everything and the pool has already
    /// booked the loss, shared by all depositors. A plain deadline expiry repays the pool
    /// first, because otherwise a buyer and a farmer could agree to let the trade lapse and
    /// keep the advance between them.
    ///
    /// A rejection refund needs the buyer. A deadline refund can be triggered by anyone,
    /// since the money still goes only to the pool and the buyer: an expired trade must
    /// not hold the pool's money hostage while the buyer stays away.
    pub fn refund(env: Env) -> Result<(), Error> {
        let config = config(&env);
        require_state(&env, State::Funded)?;
        let rejected = match validation(&env) {
            Some(v) if v.ok => return Err(Error::DeliveryConforming),
            Some(_) => true,
            None => false,
        };
        if !rejected && env.ledger().timestamp() <= config.deadline {
            return Err(Error::NotExpired);
        }
        if rejected {
            config.buyer.require_auth();
        }

        set_state(&env, State::Refunded);
        let client = token::TokenClient::new(&env, &config.token);
        let escrow = env.current_contract_address();
        let mut to_buyer = config.amount + trade_fee(&config);
        if let (Some(a), false) = (advance(&env), rejected) {
            let owed = owed(&env, &config, &a);
            client.transfer(&escrow, &config.pool, &owed);
            PoolClient::new(&env, &config.pool).on_repaid(&escrow, &owed);
            to_buyer -= owed;
        }
        client.transfer(&escrow, &config.buyer, &to_buyer);
        Refunded { buyer: config.buyer, amount: to_buyer }.publish(&env);
        bump(&env);
        Ok(())
    }

    pub fn state(env: Env) -> State {
        env.storage().instance().get(&DataKey::State).unwrap()
    }

    pub fn config(env: Env) -> Config {
        config(&env)
    }

    pub fn validation(env: Env) -> Option<Validation> {
        validation(&env)
    }
}

fn advance(env: &Env) -> Option<Advance> {
    env.storage().instance().get(&DataKey::Advance)
}

fn validation(env: &Env) -> Option<Validation> {
    env.storage().instance().get(&DataKey::Validation)
}

// The constructor always writes Config, so an instance can never exist without it.
fn config(env: &Env) -> Config {
    env.storage().instance().get(&DataKey::Config).unwrap()
}

fn require_state(env: &Env, expected: State) -> Result<(), Error> {
    let current: State = env.storage().instance().get(&DataKey::State).unwrap();
    if current == expected {
        Ok(())
    } else {
        Err(Error::InvalidState)
    }
}

fn set_state(env: &Env, state: State) {
    env.storage().instance().set(&DataKey::State, &state);
}

// State moves before any token transfer, so a failing transfer reverts the whole call and
// the escrow can never be settled twice.
// On a financed trade the pool is repaid first, then the platform takes the financing fee,
// and the seller receives what is left of the price.
fn settle(env: &Env, config: &Config, by: &Address) {
    set_state(env, State::Released);
    let client = token::TokenClient::new(env, &config.token);
    let escrow = env.current_contract_address();
    let mut to_seller = config.amount;
    let mut fee = trade_fee(config);
    if let Some(a) = advance(env) {
        let financing_fee = bps(a.principal, config.financing_fee_bps);
        let owed = owed(env, config, &a);
        client.transfer(&escrow, &config.pool, &owed);
        PoolClient::new(env, &config.pool).on_repaid(&escrow, &owed);
        to_seller -= owed + financing_fee;
        fee += financing_fee;
    }
    client.transfer(&escrow, &config.seller, &to_seller);
    if fee > 0 {
        client.transfer(&escrow, &config.platform, &fee);
    }
    Released { seller: config.seller.clone(), by: by.clone(), amount: to_seller, fee }
        .publish(env);
    bump(env);
}

// What the pool is owed today: the principal plus the yield for the time the farmer has
// had the money, at the same linear rate the pool uses to value the loan, so a repayment
// never makes the share price jump. At or after the deadline it is the full `repay`.
fn owed(env: &Env, config: &Config, a: &Advance) -> i128 {
    let term = config.deadline.saturating_sub(a.start).max(1);
    let elapsed = env.ledger().timestamp().saturating_sub(a.start).min(term);
    a.principal + (a.repay - a.principal) * i128::from(elapsed) / i128::from(term)
}

// Rounds down: on tiny amounts the platform gives up the fraction rather than overcharging.
fn trade_fee(config: &Config) -> i128 {
    bps(config.amount, config.trade_fee_bps)
}

fn bps(amount: i128, rate_bps: u32) -> i128 {
    amount * i128::from(rate_bps) / BPS_DENOMINATOR
}

// A trade can sit funded for weeks; without extending the instance TTL the escrow (and the
// locked funds) would be archived and every call would fail until restored.
fn bump(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
}

mod test;
