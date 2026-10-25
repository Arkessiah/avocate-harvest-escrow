#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::token::{StellarAssetClient, TokenClient};
use soroban_sdk::{Address, Env};

// Tests deploy the real escrow Wasm, so it must be built first: `stellar contract build`.
mod escrow {
    soroban_sdk::contractimport!(file = "../../target/wasm32v1-none/release/escrow.wasm");
}

const USDC: i128 = 10_000_000;
const DEADLINE: u64 = 1_000_000;
const FEES: Fees = Fees { trade_fee_bps: 10, financing_fee_bps: 20, pool_yield_bps: 200 };

struct Setup {
    env: Env,
    admin: Address,
    treasury: Address,
    agent: Address,
    validator: Address,
    pool: Address,
    token: Address,
    platform: Address,
}

impl Setup {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(1_000);

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let agent = Address::generate(&env);
        let validator = Address::generate(&env);
        let token = env.register_stellar_asset_contract_v2(Address::generate(&env)).address();
        let wasm = env.deployer().upload_contract_wasm(escrow::WASM);
        let platform =
            env.register(Platform, (&admin, &token, &treasury, &agent, &validator, wasm, FEES));
        let pool = Address::generate(&env);
        PlatformClient::new(&env, &platform).set_pool(&pool);
        Setup { env, admin, treasury, agent, validator, pool, token, platform }
    }

    fn client(&self) -> PlatformClient<'_> {
        PlatformClient::new(&self.env, &self.platform)
    }

    fn open_trade(&self, amount: i128) -> (Address, Address, Address) {
        let buyer = Address::generate(&self.env);
        let seller = Address::generate(&self.env);
        StellarAssetClient::new(&self.env, &self.token).mint(&buyer, &(10_000 * USDC));
        let escrow = self.client().create_escrow(&buyer, &seller, &amount, &DEADLINE);
        (buyer, seller, escrow)
    }
}

#[test]
fn starts_with_the_initial_fee_schedule() {
    let s = Setup::new();
    assert_eq!(s.client().fees(), FEES);
    assert_eq!(s.client().treasury(), s.treasury);
    assert_eq!(s.client().admin(), s.admin);
    assert_eq!(s.client().escrow_count(), 0);
}

#[test]
fn escrow_snapshots_platform_terms() {
    let s = Setup::new();
    let (buyer, seller, escrow) = s.open_trade(1_000 * USDC);

    let config = escrow::Client::new(&s.env, &escrow).config();
    assert_eq!(config.buyer, buyer);
    assert_eq!(config.seller, seller);
    assert_eq!(config.platform, s.treasury);
    assert_eq!(config.agent, s.agent);
    assert_eq!(config.validator, s.validator);
    assert_eq!(config.pool, s.pool);
    assert_eq!(config.financing_fee_bps, FEES.financing_fee_bps);
    assert_eq!(config.pool_yield_bps, FEES.pool_yield_bps);
    assert_eq!(config.token, s.token);
    assert_eq!(config.trade_fee_bps, FEES.trade_fee_bps);
}

#[test]
fn create_escrow_needs_the_buyer() {
    let s = Setup::new();
    let (buyer, _, _) = s.open_trade(1_000 * USDC);
    assert_eq!(s.env.auths()[0].0, buyer);
}

#[test]
fn fee_change_only_applies_to_new_trades() {
    let s = Setup::new();
    let (_, _, before) = s.open_trade(1_000 * USDC);
    s.client().set_fees(&Fees { trade_fee_bps: 50, ..FEES });
    let (_, _, after) = s.open_trade(1_000 * USDC);

    assert_eq!(escrow::Client::new(&s.env, &before).config().trade_fee_bps, 10);
    assert_eq!(escrow::Client::new(&s.env, &after).config().trade_fee_bps, 50);
}

#[test]
fn set_fees_needs_the_admin() {
    let s = Setup::new();
    s.client().set_fees(&Fees { trade_fee_bps: 15, ..FEES });
    assert_eq!(s.env.auths()[0].0, s.admin);
    assert_eq!(s.client().fees().trade_fee_bps, 15);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn rejects_a_fee_above_100_percent() {
    let s = Setup::new();
    s.client().set_fees(&Fees { pool_yield_bps: 10_001, ..FEES });
}

#[test]
#[should_panic]
fn non_admin_cannot_change_fees() {
    let s = Setup::new();
    // Drop the blanket mock so the admin signature is really required.
    s.env.set_auths(&[]);
    s.client().set_fees(&Fees { trade_fee_bps: 0, ..FEES });
}

#[test]
fn registry_lists_trades_in_creation_order_by_page() {
    let s = Setup::new();
    let created: [Address; 3] = core::array::from_fn(|_| s.open_trade(USDC).2);

    assert_eq!(s.client().escrow_count(), 3);
    let page = s.client().escrows(&0, &2);
    assert_eq!(page.len(), 2);
    assert_eq!(page.get(0).unwrap(), created[0]);
    assert_eq!(page.get(1).unwrap(), created[1]);
    let rest = s.client().escrows(&2, &10);
    assert_eq!(rest.len(), 1);
    assert_eq!(rest.get(0).unwrap(), created[2]);
    assert_eq!(s.client().escrows(&5, &10).len(), 0);
}

#[test]
fn full_trade_through_the_platform_pays_the_treasury() {
    let s = Setup::new();
    let (buyer, seller, escrow) = s.open_trade(1_000 * USDC);
    let trade = escrow::Client::new(&s.env, &escrow);
    trade.fund();
    trade.confirm_delivery();

    let usdc = TokenClient::new(&s.env, &s.token);
    assert_eq!(usdc.balance(&seller), 1_000 * USDC);
    assert_eq!(usdc.balance(&s.treasury), USDC);
    assert_eq!(usdc.balance(&buyer), 10_000 * USDC - 1_001 * USDC);
}

#[test]
#[should_panic]
fn non_admin_cannot_swap_the_escrow_code() {
    let s = Setup::new();
    s.env.set_auths(&[]);
    s.client().set_escrow_wasm(&BytesN::from_array(&s.env, &[7; 32]));
}

#[test]
fn operator_change_only_applies_to_new_trades() {
    let s = Setup::new();
    let (_, _, before) = s.open_trade(USDC);
    let new_agent = Address::generate(&s.env);
    s.client().set_operators(&new_agent, &s.validator);
    assert_eq!(s.env.auths()[0].0, s.admin);
    let (_, _, after) = s.open_trade(USDC);

    assert_eq!(escrow::Client::new(&s.env, &before).config().agent, s.agent);
    assert_eq!(escrow::Client::new(&s.env, &after).config().agent, new_agent);
}

#[test]
fn agent_settles_a_validated_platform_trade() {
    let s = Setup::new();
    let (_, seller, escrow) = s.open_trade(1_000 * USDC);
    let trade = escrow::Client::new(&s.env, &escrow);
    trade.fund();
    trade.validate(&true, &BytesN::from_array(&s.env, &[9; 32]));
    trade.agent_release();
    assert_eq!(TokenClient::new(&s.env, &s.token).balance(&seller), 1_000 * USDC);
}

#[test]
fn registry_recognises_its_own_escrows_only() {
    let s = Setup::new();
    let (_, _, escrow) = s.open_trade(USDC);
    assert!(s.client().is_escrow(&escrow));
    assert!(!s.client().is_escrow(&Address::generate(&s.env)));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn trades_need_a_linked_pool() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    let a = Address::generate(&env);
    let wasm = env.deployer().upload_contract_wasm(escrow::WASM);
    let platform = env.register(Platform, (&a, &a, &a, &a, &a, wasm, FEES));
    PlatformClient::new(&env, &platform).create_escrow(&a, &a, &USDC, &DEADLINE);
}

#[test]
#[should_panic]
fn non_admin_cannot_link_a_pool() {
    let s = Setup::new();
    s.env.set_auths(&[]);
    s.client().set_pool(&Address::generate(&s.env));
}

#[test]
fn create_trade_needs_buyer_and_farmer() {
    let s = Setup::new();
    let buyer = Address::generate(&s.env);
    let seller = Address::generate(&s.env);
    let escrow = s.client().create_trade(&buyer, &seller, &(500 * USDC), &DEADLINE);

    let auths = s.env.auths();
    assert!(auths.iter().any(|(a, _)| *a == buyer));
    assert!(auths.iter().any(|(a, _)| *a == seller));
    assert!(s.client().is_escrow(&escrow));
    let config = escrow::Client::new(&s.env, &escrow).config();
    assert_eq!((config.buyer, config.seller, config.amount), (buyer, seller, 500 * USDC));
}

#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
fn create_trade_fails_without_the_farmer() {
    use soroban_sdk::testutils::{MockAuth, MockAuthInvoke};
    use soroban_sdk::IntoVal;

    let s = Setup::new();
    let buyer = Address::generate(&s.env);
    let seller = Address::generate(&s.env);
    let args = (&buyer, &seller, 500 * USDC, DEADLINE).into_val(&s.env);
    // Only the buyer signs: the farmer's authorization is missing.
    s.env.mock_auths(&[MockAuth {
        address: &buyer,
        invoke: &MockAuthInvoke { contract: &s.platform, fn_name: "create_trade", args, sub_invokes: &[] },
    }]);
    s.client().create_trade(&buyer, &seller, &(500 * USDC), &DEADLINE);
}
