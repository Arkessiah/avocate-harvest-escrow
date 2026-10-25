#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    BytesN, ContractExecutable, Env, IntoVal, Val, Vec,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;
const MAX_BPS: u32 = 10_000;
const MAX_PAGE: u32 = 50;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidFee = 1,
}

/// Fee schedule in basis points. Each new escrow snapshots it, so changing it only
/// affects trades created afterwards.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Fees {
    /// Charged to the buyer on top of the price of every trade.
    pub trade_fee_bps: u32,
    /// Charged to the farmer on the amount advanced by the pool.
    pub financing_fee_bps: u32,
    /// Return paid to pool depositors on the amount advanced.
    pub pool_yield_bps: u32,
}

#[contracttype]
enum DataKey {
    Admin,
    Token,
    Treasury,
    Agent,
    Validator,
    EscrowWasm,
    Fees,
    EscrowCount,
    Escrow(u32),
}

#[contractevent]
pub struct FeesUpdated {
    pub fees: Fees,
}

#[contractevent]
pub struct EscrowCreated {
    #[topic]
    pub buyer: Address,
    #[topic]
    pub seller: Address,
    pub index: u32,
    pub escrow: Address,
    pub amount: i128,
}

/// Avocate's entry point: owns the fee schedule, deploys every trade escrow with the
/// current terms, and keeps the registry the admin dashboard reads from.
#[contract]
pub struct Platform;

#[contractimpl]
impl Platform {
    pub fn __constructor(
        env: Env,
        admin: Address,
        token: Address,
        treasury: Address,
        agent: Address,
        validator: Address,
        escrow_wasm: BytesN<32>,
        fees: Fees,
    ) {
        check_fees(&env, &fees);
        let store = env.storage().instance();
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Token, &token);
        store.set(&DataKey::Treasury, &treasury);
        store.set(&DataKey::Agent, &agent);
        store.set(&DataKey::Validator, &validator);
        store.set(&DataKey::EscrowWasm, &escrow_wasm);
        store.set(&DataKey::Fees, &fees);
        store.set(&DataKey::EscrowCount, &0u32);
        bump(&env);
    }

    pub fn set_fees(env: Env, fees: Fees) {
        admin(&env).require_auth();
        check_fees(&env, &fees);
        env.storage().instance().set(&DataKey::Fees, &fees);
        FeesUpdated { fees }.publish(&env);
        bump(&env);
    }

    pub fn set_treasury(env: Env, treasury: Address) {
        admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        bump(&env);
    }

    /// Service accounts copied into every new trade: the agent that may settle after a
    /// positive validation, and the independent validator. Open trades keep theirs.
    pub fn set_operators(env: Env, agent: Address, validator: Address) {
        admin(&env).require_auth();
        let store = env.storage().instance();
        store.set(&DataKey::Agent, &agent);
        store.set(&DataKey::Validator, &validator);
        bump(&env);
    }

    /// Escrow code used for trades created from now on; existing escrows keep theirs.
    pub fn set_escrow_wasm(env: Env, escrow_wasm: BytesN<32>) {
        admin(&env).require_auth();
        env.storage().instance().set(&DataKey::EscrowWasm, &escrow_wasm);
        bump(&env);
    }

    /// Replaces this contract's code in place. Address, fee schedule and registry survive.
    pub fn upgrade(env: Env, new_wasm: BytesN<32>) {
        admin(&env).require_auth();
        env.deployer().update_current_contract(ContractExecutable::Wasm(new_wasm));
    }

    /// Opens a trade. The buyer only chooses counterparty, price and deadline; token, fee
    /// recipient and fee come from the platform, so a trade cannot be created on custom
    /// terms and still show up as an Avocate operation.
    pub fn create_escrow(
        env: Env,
        buyer: Address,
        seller: Address,
        amount: i128,
        deadline: u64,
    ) -> Address {
        buyer.require_auth();
        let store = env.storage().instance();
        let index: u32 = store.get(&DataKey::EscrowCount).unwrap();
        let fees: Fees = store.get(&DataKey::Fees).unwrap();
        let wasm: BytesN<32> = store.get(&DataKey::EscrowWasm).unwrap();
        let token: Address = store.get(&DataKey::Token).unwrap();
        let treasury: Address = store.get(&DataKey::Treasury).unwrap();
        let agent: Address = store.get(&DataKey::Agent).unwrap();
        let validator: Address = store.get(&DataKey::Validator).unwrap();

        let args: Vec<Val> = (
            buyer.clone(),
            seller.clone(),
            treasury,
            agent,
            validator,
            token,
            amount,
            fees.trade_fee_bps,
            deadline,
        )
            .into_val(&env);
        // The registry index is the salt: unique per platform, so addresses never collide
        // and anyone can recompute where escrow N lives.
        let escrow = env
            .deployer()
            .with_current_contract(salt(&env, index))
            .deploy_contract(ContractExecutable::Wasm(wasm), args);

        let key = DataKey::Escrow(index);
        env.storage().persistent().set(&key, &escrow);
        env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
        store.set(&DataKey::EscrowCount, &(index + 1));
        EscrowCreated { buyer, seller, index, escrow: escrow.clone(), amount }.publish(&env);
        bump(&env);
        escrow
    }

    pub fn fees(env: Env) -> Fees {
        env.storage().instance().get(&DataKey::Fees).unwrap()
    }

    pub fn treasury(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Treasury).unwrap()
    }

    pub fn operators(env: Env) -> (Address, Address) {
        let store = env.storage().instance();
        (store.get(&DataKey::Agent).unwrap(), store.get(&DataKey::Validator).unwrap())
    }

    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    pub fn admin(env: Env) -> Address {
        admin(&env)
    }

    pub fn escrow_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::EscrowCount).unwrap()
    }

    /// One page of the registry, oldest first. Pages are capped so a read never exceeds
    /// the simulation budget as the registry grows.
    pub fn escrows(env: Env, start: u32, limit: u32) -> Vec<Address> {
        let count = Self::escrow_count(env.clone());
        let end = count.min(start.saturating_add(limit.min(MAX_PAGE)));
        let mut page = Vec::new(&env);
        for i in start..end {
            if let Some(a) = env.storage().persistent().get(&DataKey::Escrow(i)) {
                page.push_back(a);
            }
        }
        page
    }
}

fn admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

fn check_fees(env: &Env, fees: &Fees) {
    if fees.trade_fee_bps > MAX_BPS || fees.financing_fee_bps > MAX_BPS || fees.pool_yield_bps > MAX_BPS
    {
        panic_with_error!(env, Error::InvalidFee);
    }
}

fn salt(env: &Env, index: u32) -> BytesN<32> {
    let mut bytes = [0u8; 32];
    bytes[28..].copy_from_slice(&index.to_be_bytes());
    BytesN::from_array(env, &bytes)
}

fn bump(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
}

mod test;
