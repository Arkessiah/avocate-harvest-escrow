#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, Env,
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
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum State {
    Pending,
    Funded,
    Released,
    Refunded,
}

/// Trade terms, fixed at deploy time. Nobody can change who gets paid or how much.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub buyer: Address,
    pub seller: Address,
    pub platform: Address,
    pub token: Address,
    /// Price of the goods; the seller receives it in full.
    pub amount: i128,
    /// Service fee charged to the buyer on top of the price, snapshotted at creation so
    /// later changes to the platform's fee schedule never alter an agreed trade.
    pub trade_fee_bps: u32,
    /// Unix timestamp after which the buyer may take the funds back.
    pub deadline: u64,
}

#[contracttype]
enum DataKey {
    Config,
    State,
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
    pub amount: i128,
    pub fee: i128,
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
    pub fn __constructor(
        env: Env,
        buyer: Address,
        seller: Address,
        platform: Address,
        token: Address,
        amount: i128,
        trade_fee_bps: u32,
        deadline: u64,
    ) {
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        if i128::from(trade_fee_bps) > BPS_DENOMINATOR {
            panic_with_error!(&env, Error::InvalidFee);
        }
        if deadline <= env.ledger().timestamp() {
            panic_with_error!(&env, Error::InvalidDeadline);
        }
        let config = Config { buyer, seller, platform, token, amount, trade_fee_bps, deadline };
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
        settle(&env, &config);
        Ok(())
    }

    /// Past the deadline without a confirmed delivery, the buyer recovers the whole deposit,
    /// fee included: no delivery, no service charged.
    pub fn refund(env: Env) -> Result<(), Error> {
        let config = config(&env);
        require_state(&env, State::Funded)?;
        if env.ledger().timestamp() <= config.deadline {
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
fn settle(env: &Env, config: &Config) {
    set_state(env, State::Released);
    let fee = trade_fee(config);
    let client = token::TokenClient::new(env, &config.token);
    let escrow = env.current_contract_address();
    client.transfer(&escrow, &config.seller, &config.amount);
    if fee > 0 {
        client.transfer(&escrow, &config.platform, &fee);
    }
    Released { seller: config.seller.clone(), amount: config.amount, fee }.publish(env);
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
