#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, BytesN, Env,
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
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum State {
    Pending,
    Funded,
    Released,
    Refunded,
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

    /// Buyer accepts the delivery: the seller gets the full price, the platform its fee.
    pub fn confirm_delivery(env: Env) -> Result<(), Error> {
        let config = config(&env);
        require_state(&env, State::Funded)?;
        config.buyer.require_auth();
        settle(&env, &config, &config.buyer);
        Ok(())
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
    /// soon as the validator rejects the delivery: no delivery, no service charged.
    pub fn refund(env: Env) -> Result<(), Error> {
        let config = config(&env);
        require_state(&env, State::Funded)?;
        let rejected = matches!(validation(&env), Some(v) if !v.ok);
        if !rejected && env.ledger().timestamp() <= config.deadline {
            return Err(Error::NotExpired);
        }
        config.buyer.require_auth();

        let total = config.amount + trade_fee(&config);
        set_state(&env, State::Refunded);
        token::TokenClient::new(&env, &config.token).transfer(
            &env.current_contract_address(),
            &config.buyer,
            &total,
        );
        Refunded { buyer: config.buyer, amount: total }.publish(&env);
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
fn settle(env: &Env, config: &Config, by: &Address) {
    set_state(env, State::Released);
    let fee = trade_fee(config);
    let client = token::TokenClient::new(env, &config.token);
    let escrow = env.current_contract_address();
    client.transfer(&escrow, &config.seller, &config.amount);
    if fee > 0 {
        client.transfer(&escrow, &config.platform, &fee);
    }
    Released { seller: config.seller.clone(), by: by.clone(), amount: config.amount, fee }
        .publish(env);
    bump(env);
}

// Rounds down: on tiny amounts the platform gives up the fraction rather than overcharging.
fn trade_fee(config: &Config) -> i128 {
    config.amount * i128::from(config.trade_fee_bps) / BPS_DENOMINATOR
}

// A trade can sit funded for weeks; without extending the instance TTL the escrow (and the
// locked funds) would be archived and every call would fail until restored.
fn bump(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
}

mod test;
