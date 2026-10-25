#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, Env,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;

// Virtual shares/assets (OpenZeppelin's mitigation, referenced by SEP-56): share price is
// computed as if the vault always held 10^OFFSET extra shares and 1 extra unit of assets.
// An attacker inflating the price of the first share would mostly be donating to those
// virtual shares, so the attack stops paying.
const DECIMALS_OFFSET: u32 = 3;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    /// Shares are not transferable and there are no allowances, so only the owner of the
    /// assets or shares may act on them.
    OperatorNotOwner = 2,
    /// The deposit is too small to mint a single share; rejecting it protects the depositor
    /// from losing it to rounding.
    ZeroShares = 3,
    ExceedsMax = 4,
}

#[contracttype]
enum DataKey {
    Admin,
    Asset,
    /// Idle USDC tracked internally rather than read from the token balance, so a direct
    /// transfer to the pool cannot move the share price.
    Cash,
    TotalShares,
    Shares(Address),
}

#[contractevent]
pub struct Deposit {
    #[topic]
    pub operator: Address,
    #[topic]
    pub from: Address,
    #[topic]
    pub receiver: Address,
    pub assets: i128,
    pub shares: i128,
}

#[contractevent]
pub struct Withdraw {
    #[topic]
    pub operator: Address,
    #[topic]
    pub receiver: Address,
    #[topic]
    pub owner: Address,
    pub assets: i128,
    pub shares: i128,
}

#[derive(Clone, Copy)]
enum Rounding {
    Down,
    Up,
}

/// Financing pool: depositors (buyers, other buyers, anyone) pool USDC and receive shares;
/// the pool advances money to farmers against funded escrows. Follows the SEP-56 vault
/// interface; shares are internal balances, not a transferable token.
#[contract]
pub struct Pool;

#[contractimpl]
impl Pool {
    pub fn __constructor(env: Env, admin: Address, asset: Address) {
        let store = env.storage().instance();
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Asset, &asset);
        store.set(&DataKey::Cash, &0i128);
        store.set(&DataKey::TotalShares, &0i128);
        bump(&env);
    }

    pub fn query_asset(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Asset).unwrap()
    }

    pub fn total_assets(env: Env) -> i128 {
        cash(&env)
    }

    pub fn total_supply(env: Env) -> i128 {
        total_shares(&env)
    }

    pub fn balance(env: Env, owner: Address) -> i128 {
        shares_of(&env, &owner)
    }

    pub fn convert_to_shares(env: Env, assets: i128) -> i128 {
        to_shares(&env, assets, Rounding::Down)
    }

    pub fn convert_to_assets(env: Env, shares: i128) -> i128 {
        to_assets(&env, shares, Rounding::Down)
    }

    pub fn max_deposit(_env: Env, _receiver: Address) -> i128 {
        i128::MAX
    }

    pub fn preview_deposit(env: Env, assets: i128) -> i128 {
        to_shares(&env, assets, Rounding::Down)
    }

    pub fn max_mint(_env: Env, _receiver: Address) -> i128 {
        i128::MAX
    }

    pub fn preview_mint(env: Env, shares: i128) -> i128 {
        to_assets(&env, shares, Rounding::Up)
    }

    /// Only idle cash can leave: money lent to farmers is not withdrawable until repaid.
    pub fn max_withdraw(env: Env, owner: Address) -> i128 {
        to_assets(&env, shares_of(&env, &owner), Rounding::Down).min(cash(&env))
    }

    pub fn preview_withdraw(env: Env, assets: i128) -> i128 {
        to_shares(&env, assets, Rounding::Up)
    }

    pub fn max_redeem(env: Env, owner: Address) -> i128 {
        let by_cash = to_shares(&env, cash(&env), Rounding::Down);
        shares_of(&env, &owner).min(by_cash)
    }

    pub fn preview_redeem(env: Env, shares: i128) -> i128 {
        to_assets(&env, shares, Rounding::Down)
    }

    pub fn deposit(env: Env, assets: i128, receiver: Address, from: Address, operator: Address) -> i128 {
        require_owner(&env, &operator, &from);
        positive(&env, assets);
        let shares = to_shares(&env, assets, Rounding::Down);
        if shares == 0 {
            panic_with_error!(&env, Error::ZeroShares);
        }
        enter(&env, &operator, &from, &receiver, assets, shares);
        shares
    }

    pub fn mint(env: Env, shares: i128, receiver: Address, from: Address, operator: Address) -> i128 {
        require_owner(&env, &operator, &from);
        positive(&env, shares);
        let assets = to_assets(&env, shares, Rounding::Up);
        enter(&env, &operator, &from, &receiver, assets, shares);
        assets
    }

    pub fn withdraw(env: Env, assets: i128, receiver: Address, owner: Address, operator: Address) -> i128 {
        require_owner(&env, &operator, &owner);
        positive(&env, assets);
        if assets > Self::max_withdraw(env.clone(), owner.clone()) {
            panic_with_error!(&env, Error::ExceedsMax);
        }
        let shares = to_shares(&env, assets, Rounding::Up);
        exit(&env, &operator, &receiver, &owner, assets, shares);
        shares
    }

    pub fn redeem(env: Env, shares: i128, receiver: Address, owner: Address, operator: Address) -> i128 {
        require_owner(&env, &operator, &owner);
        positive(&env, shares);
        if shares > Self::max_redeem(env.clone(), owner.clone()) {
            panic_with_error!(&env, Error::ExceedsMax);
        }
        let assets = to_assets(&env, shares, Rounding::Down);
        exit(&env, &operator, &receiver, &owner, assets, shares);
        assets
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

fn enter(env: &Env, operator: &Address, from: &Address, receiver: &Address, assets: i128, shares: i128) {
    let asset = Pool::query_asset(env.clone());
    token::TokenClient::new(env, &asset).transfer(from, &env.current_contract_address(), &assets);
    set_cash(env, cash(env) + assets);
    set_total_shares(env, total_shares(env) + shares);
    set_shares(env, receiver, shares_of(env, receiver) + shares);
    Deposit { operator: operator.clone(), from: from.clone(), receiver: receiver.clone(), assets, shares }
        .publish(env);
    bump(env);
}

// Burn first, pay after: if the transfer fails the whole call reverts with the shares intact.
fn exit(env: &Env, operator: &Address, receiver: &Address, owner: &Address, assets: i128, shares: i128) {
    set_shares(env, owner, shares_of(env, owner) - shares);
    set_total_shares(env, total_shares(env) - shares);
    set_cash(env, cash(env) - assets);
    let asset = Pool::query_asset(env.clone());
    token::TokenClient::new(env, &asset).transfer(&env.current_contract_address(), receiver, &assets);
    Withdraw { operator: operator.clone(), receiver: receiver.clone(), owner: owner.clone(), assets, shares }
        .publish(env);
    bump(env);
}

// Rounding always favours the pool (down when paying out, up when charging), so repeated
// small operations can never drain value from the other depositors.
fn to_shares(env: &Env, assets: i128, rounding: Rounding) -> i128 {
    mul_div(assets, total_shares(env) + virtual_shares(), Pool::total_assets(env.clone()) + 1, rounding)
}

fn to_assets(env: &Env, shares: i128, rounding: Rounding) -> i128 {
    mul_div(shares, Pool::total_assets(env.clone()) + 1, total_shares(env) + virtual_shares(), rounding)
}

fn virtual_shares() -> i128 {
    10i128.pow(DECIMALS_OFFSET)
}

fn mul_div(a: i128, b: i128, denominator: i128, rounding: Rounding) -> i128 {
    let product = a.checked_mul(b).expect("overflow");
    match rounding {
        Rounding::Down => product / denominator,
        Rounding::Up => (product + denominator - 1) / denominator,
    }
}

fn require_owner(env: &Env, operator: &Address, owner: &Address) {
    if operator != owner {
        panic_with_error!(env, Error::OperatorNotOwner);
    }
    operator.require_auth();
}

fn positive(env: &Env, amount: i128) {
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
}

fn cash(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::Cash).unwrap()
}

fn set_cash(env: &Env, value: i128) {
    env.storage().instance().set(&DataKey::Cash, &value);
}

fn total_shares(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::TotalShares).unwrap()
}

fn set_total_shares(env: &Env, value: i128) {
    env.storage().instance().set(&DataKey::TotalShares, &value);
}

fn shares_of(env: &Env, owner: &Address) -> i128 {
    env.storage().persistent().get(&DataKey::Shares(owner.clone())).unwrap_or(0)
}

fn set_shares(env: &Env, owner: &Address, value: i128) {
    let key = DataKey::Shares(owner.clone());
    if value == 0 {
        env.storage().persistent().remove(&key);
    } else {
        env.storage().persistent().set(&key, &value);
        env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
    }
}

fn bump(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
}

mod test;
