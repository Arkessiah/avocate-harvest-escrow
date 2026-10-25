#![no_std]
use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, token, Address, Env, Vec,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;

// Virtual shares/assets (OpenZeppelin's mitigation, referenced by SEP-56): share price is
// computed as if the vault always held 10^OFFSET extra shares and 1 extra unit of assets.
// An attacker inflating the price of the first share would mostly be donating to those
// virtual shares, so the attack stops paying.
const DECIMALS_OFFSET: u32 = 3;

const BPS_DENOMINATOR: i128 = 10_000;
const DEFAULT_MAX_ADVANCE_BPS: u32 = 8_000;
// Open loans live in one instance entry and are walked to value the pool; capping them
// keeps every deposit and withdrawal well inside the per-transaction budget.
const MAX_OPEN_LOANS: u32 = 50;

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
    NotAnAvocateTrade = 5,
    /// The escrow was created to be financed by a different pool.
    WrongPool = 6,
    NotFunded = 7,
    FarmerNotOnboarded = 8,
    /// Above the share of the price the pool is willing to advance.
    AdvanceOverLimit = 9,
    /// Above the total the pool is willing to have lent to this farmer.
    ExposureOverLimit = 10,
    InsufficientCash = 11,
    TooManyLoans = 12,
    UnknownLoan = 13,
    Expired = 14,
    InvalidFee = 15,
}

#[contracttype]
enum DataKey {
    Admin,
    Asset,
    Platform,
    MaxAdvanceBps,
    Loans,
    FarmerLimit(Address),
    Exposure(Address),
    /// Idle USDC tracked internally rather than read from the token balance, so a direct
    /// transfer to the pool cannot move the share price.
    Cash,
    TotalShares,
    Shares(Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Loan {
    pub escrow: Address,
    pub farmer: Address,
    pub principal: i128,
    pub repay: i128,
    pub start: u64,
    pub deadline: u64,
}

// Mirrors of the escrow and platform interfaces. Contract types travel as maps keyed by
// field name (and enums by variant name), so these decode the escrow's own values.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowConfig {
    pub buyer: Address,
    pub seller: Address,
    pub platform: Address,
    pub agent: Address,
    pub validator: Address,
    pub pool: Address,
    pub token: Address,
    pub amount: i128,
    pub trade_fee_bps: u32,
    pub financing_fee_bps: u32,
    pub pool_yield_bps: u32,
    pub deadline: u64,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EscrowState {
    Pending,
    Funded,
    Released,
    Refunded,
}

#[contractclient(name = "EscrowClient")]
pub trait EscrowApi {
    fn config(env: Env) -> EscrowConfig;
    fn state(env: Env) -> EscrowState;
    fn register_advance(env: Env, principal: i128);
}

#[contractclient(name = "PlatformClient")]
pub trait PlatformApi {
    fn is_escrow(env: Env, escrow: Address) -> bool;
}

#[contractevent]
pub struct Advanced {
    #[topic]
    pub farmer: Address,
    #[topic]
    pub escrow: Address,
    pub principal: i128,
    pub repay: i128,
}

#[contractevent]
pub struct Repaid {
    #[topic]
    pub escrow: Address,
    pub amount: i128,
}

#[contractevent]
pub struct WrittenOff {
    #[topic]
    pub escrow: Address,
    pub principal: i128,
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
    pub fn __constructor(env: Env, admin: Address, asset: Address, platform: Address) {
        let store = env.storage().instance();
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Asset, &asset);
        store.set(&DataKey::Platform, &platform);
        store.set(&DataKey::MaxAdvanceBps, &DEFAULT_MAX_ADVANCE_BPS);
        store.set(&DataKey::Loans, &Vec::<Loan>::new(&env));
        store.set(&DataKey::Cash, &0i128);
        store.set(&DataKey::TotalShares, &0i128);
        bump(&env);
    }

    pub fn query_asset(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Asset).unwrap()
    }

    /// Idle cash plus the value of open loans. A loan is worth its principal plus the yield
    /// accrued linearly over its term, so the yield cannot be captured by depositing just
    /// before a repayment. A loan past its deadline is worth nothing until it is repaid: a
    /// depositor who knows a loss is coming cannot exit at a price that still counts it.
    pub fn total_assets(env: Env) -> i128 {
        let now = env.ledger().timestamp();
        let mut total = cash(&env);
        for loan in loans(&env).iter() {
            if now <= loan.deadline {
                let term = (loan.deadline - loan.start).max(1);
                let elapsed = now.saturating_sub(loan.start).min(term);
                let accrued = (loan.repay - loan.principal) * i128::from(elapsed) / i128::from(term);
                total += loan.principal + accrued;
            }
        }
        total
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

    /// Admin onboards a farmer (after off-chain due diligence) with a cap on what the pool
    /// may have lent them at any time.
    pub fn onboard(env: Env, farmer: Address, limit: i128) {
        require_admin(&env);
        positive(&env, limit);
        let key = DataKey::FarmerLimit(farmer);
        env.storage().persistent().set(&key, &limit);
        env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
        bump(&env);
    }

    /// Stops new advances; loans already open run their course.
    pub fn offboard(env: Env, farmer: Address) {
        require_admin(&env);
        env.storage().persistent().remove(&DataKey::FarmerLimit(farmer));
        bump(&env);
    }

    pub fn set_max_advance_bps(env: Env, max_advance_bps: u32) {
        require_admin(&env);
        if i128::from(max_advance_bps) > BPS_DENOMINATOR {
            panic_with_error!(&env, Error::InvalidFee);
        }
        env.storage().instance().set(&DataKey::MaxAdvanceBps, &max_advance_bps);
        bump(&env);
    }

    /// The farmer of a funded Avocate trade asks for part of the price before delivery.
    /// The escrow then records the advance and requires the buyer's signature as well.
    pub fn advance(env: Env, escrow: Address, principal: i128) {
        positive(&env, principal);
        let platform: Address = env.storage().instance().get(&DataKey::Platform).unwrap();
        if !PlatformClient::new(&env, &platform).is_escrow(&escrow) {
            panic_with_error!(&env, Error::NotAnAvocateTrade);
        }
        let trade = EscrowClient::new(&env, &escrow);
        let config = trade.config();
        if config.pool != env.current_contract_address() {
            panic_with_error!(&env, Error::WrongPool);
        }
        if trade.state() != EscrowState::Funded {
            panic_with_error!(&env, Error::NotFunded);
        }
        let now = env.ledger().timestamp();
        if now >= config.deadline {
            panic_with_error!(&env, Error::Expired);
        }
        let farmer = config.seller.clone();
        farmer.require_auth();
        // The escrow checks the buyer's signature again in `register_advance`, but Soroban
        // only accepts an authorization rooted in the top-level call: requiring it here
        // ties the buyer's signature to `advance`, and the nested check joins that tree.
        config.buyer.require_auth();

        let limit: i128 = match env.storage().persistent().get(&DataKey::FarmerLimit(farmer.clone())) {
            Some(l) => l,
            None => panic_with_error!(&env, Error::FarmerNotOnboarded),
        };
        let max_bps: u32 = env.storage().instance().get(&DataKey::MaxAdvanceBps).unwrap();
        if principal > config.amount * i128::from(max_bps) / BPS_DENOMINATOR {
            panic_with_error!(&env, Error::AdvanceOverLimit);
        }
        let exposure = exposure_of(&env, &farmer);
        if exposure + principal > limit {
            panic_with_error!(&env, Error::ExposureOverLimit);
        }
        if principal > cash(&env) {
            panic_with_error!(&env, Error::InsufficientCash);
        }
        let mut open = loans(&env);
        if open.len() >= MAX_OPEN_LOANS {
            panic_with_error!(&env, Error::TooManyLoans);
        }

        // Same formula the escrow applies, from the yield it snapshotted at creation.
        let repay = principal + principal * i128::from(config.pool_yield_bps) / BPS_DENOMINATOR;
        trade.register_advance(&principal);

        open.push_back(Loan {
            escrow: escrow.clone(),
            farmer: farmer.clone(),
            principal,
            repay,
            start: now,
            deadline: config.deadline,
        });
        env.storage().instance().set(&DataKey::Loans, &open);
        set_exposure(&env, &farmer, exposure + principal);
        set_cash(&env, cash(&env) - principal);
        token::TokenClient::new(&env, &query_asset(&env)).transfer(
            &env.current_contract_address(),
            &farmer,
            &principal,
        );
        Advanced { farmer, escrow, principal, repay }.publish(&env);
        bump(&env);
    }

    /// Called by an escrow right after it transferred what it owes to the pool.
    pub fn on_repaid(env: Env, escrow: Address) {
        escrow.require_auth();
        let loan = take_loan(&env, &escrow);
        set_cash(&env, cash(&env) + loan.repay);
        Repaid { escrow, amount: loan.repay }.publish(&env);
        bump(&env);
    }

    /// Called by an escrow refunded after a rejected delivery: the advance is lost and the
    /// loss is shared by every depositor through the share price.
    pub fn on_written_off(env: Env, escrow: Address) {
        escrow.require_auth();
        let loan = take_loan(&env, &escrow);
        WrittenOff { escrow, principal: loan.principal }.publish(&env);
        bump(&env);
    }

    pub fn loans(env: Env) -> Vec<Loan> {
        loans(&env)
    }

    pub fn exposure(env: Env, farmer: Address) -> i128 {
        exposure_of(&env, &farmer)
    }

    pub fn farmer_limit(env: Env, farmer: Address) -> Option<i128> {
        env.storage().persistent().get(&DataKey::FarmerLimit(farmer))
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

// Only escrows the pool lent to have a loan entry, so an unknown caller is rejected here
// even though its own `require_auth` passed.
fn take_loan(env: &Env, escrow: &Address) -> Loan {
    let mut open = loans(env);
    let index = match open.iter().position(|l| &l.escrow == escrow) {
        Some(i) => i as u32,
        None => panic_with_error!(env, Error::UnknownLoan),
    };
    let loan = open.get(index).unwrap();
    open.remove(index);
    env.storage().instance().set(&DataKey::Loans, &open);
    let exposure = exposure_of(env, &loan.farmer) - loan.principal;
    set_exposure(env, &loan.farmer, exposure);
    loan
}

fn loans(env: &Env) -> Vec<Loan> {
    env.storage().instance().get(&DataKey::Loans).unwrap()
}

fn exposure_of(env: &Env, farmer: &Address) -> i128 {
    env.storage().persistent().get(&DataKey::Exposure(farmer.clone())).unwrap_or(0)
}

fn set_exposure(env: &Env, farmer: &Address, value: i128) {
    let key = DataKey::Exposure(farmer.clone());
    if value == 0 {
        env.storage().persistent().remove(&key);
    } else {
        env.storage().persistent().set(&key, &value);
        env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
    }
}

fn query_asset(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Asset).unwrap()
}

fn require_admin(env: &Env) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
}

fn enter(env: &Env, operator: &Address, from: &Address, receiver: &Address, assets: i128, shares: i128) {
    let asset = query_asset(env);
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
    let asset = query_asset(env);
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
