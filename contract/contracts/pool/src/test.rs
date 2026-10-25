#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::token::{StellarAssetClient, TokenClient};
use soroban_sdk::{Address, Env};

const USDC: i128 = 10_000_000;

struct Setup {
    env: Env,
    usdc: Address,
    pool: Address,
}

impl Setup {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        let usdc = env.register_stellar_asset_contract_v2(Address::generate(&env)).address();
        let pool = env.register(Pool, (Address::generate(&env), &usdc));
        Setup { env, usdc, pool }
    }

    fn client(&self) -> PoolClient<'_> {
        PoolClient::new(&self.env, &self.pool)
    }

    fn depositor(&self, usdc: i128) -> Address {
        let a = Address::generate(&self.env);
        StellarAssetClient::new(&self.env, &self.usdc).mint(&a, &usdc);
        a
    }

    fn usdc_of(&self, who: &Address) -> i128 {
        TokenClient::new(&self.env, &self.usdc).balance(who)
    }
}

#[test]
fn deposit_mints_shares_and_moves_usdc_into_the_pool() {
    let s = Setup::new();
    let alice = s.depositor(1_000 * USDC);
    let shares = s.client().deposit(&(1_000 * USDC), &alice, &alice, &alice);

    assert_eq!(shares, 1_000 * USDC * 1_000); // 10^3 virtual offset on an empty pool
    assert_eq!(s.client().balance(&alice), shares);
    assert_eq!(s.client().total_supply(), shares);
    assert_eq!(s.client().total_assets(), 1_000 * USDC);
    assert_eq!(s.usdc_of(&s.pool), 1_000 * USDC);
    assert_eq!(s.usdc_of(&alice), 0);
}

#[test]
fn deposit_needs_the_owner_of_the_funds() {
    let s = Setup::new();
    let alice = s.depositor(10 * USDC);
    s.client().deposit(&(10 * USDC), &alice, &alice, &alice);
    assert_eq!(s.env.auths()[0].0, alice);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn nobody_can_deposit_someone_elses_funds() {
    let s = Setup::new();
    let alice = s.depositor(10 * USDC);
    let mallory = Address::generate(&s.env);
    s.client().deposit(&(10 * USDC), &mallory, &alice, &mallory);
}

#[test]
fn redeem_returns_the_deposit_in_full() {
    let s = Setup::new();
    let alice = s.depositor(500 * USDC);
    let shares = s.client().deposit(&(500 * USDC), &alice, &alice, &alice);
    let assets = s.client().redeem(&shares, &alice, &alice, &alice);

    assert_eq!(assets, 500 * USDC);
    assert_eq!(s.usdc_of(&alice), 500 * USDC);
    assert_eq!(s.client().balance(&alice), 0);
    assert_eq!(s.client().total_supply(), 0);
}

#[test]
fn two_depositors_get_shares_in_proportion() {
    let s = Setup::new();
    let alice = s.depositor(300 * USDC);
    let bob = s.depositor(100 * USDC);
    let a = s.client().deposit(&(300 * USDC), &alice, &alice, &alice);
    let b = s.client().deposit(&(100 * USDC), &bob, &bob, &bob);

    assert_eq!(a, 3 * b);
    assert_eq!(s.client().max_withdraw(&bob), 100 * USDC);
}

#[test]
fn withdraw_burns_rounded_up_shares() {
    let s = Setup::new();
    let alice = s.depositor(100 * USDC);
    s.client().deposit(&(100 * USDC), &alice, &alice, &alice);
    let before = s.client().balance(&alice);
    let burned = s.client().withdraw(&(40 * USDC), &alice, &alice, &alice);

    assert_eq!(burned, s.client().preview_withdraw(&(40 * USDC)));
    assert_eq!(s.client().balance(&alice), before - burned);
    assert_eq!(s.usdc_of(&alice), 40 * USDC);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn cannot_withdraw_more_than_owned() {
    let s = Setup::new();
    let alice = s.depositor(100 * USDC);
    s.client().deposit(&(100 * USDC), &alice, &alice, &alice);
    s.client().withdraw(&(101 * USDC), &alice, &alice, &alice);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn nobody_can_redeem_someone_elses_shares() {
    let s = Setup::new();
    let alice = s.depositor(100 * USDC);
    let shares = s.client().deposit(&(100 * USDC), &alice, &alice, &alice);
    let mallory = Address::generate(&s.env);
    s.client().redeem(&shares, &mallory, &alice, &mallory);
}

#[test]
fn a_direct_transfer_does_not_move_the_share_price() {
    let s = Setup::new();
    let alice = s.depositor(100 * USDC);
    s.client().deposit(&(100 * USDC), &alice, &alice, &alice);
    let price = s.client().convert_to_assets(&1_000_000);

    let donor = s.depositor(1_000 * USDC);
    TokenClient::new(&s.env, &s.usdc).transfer(&donor, &s.pool, &(1_000 * USDC));

    assert_eq!(s.client().total_assets(), 100 * USDC);
    assert_eq!(s.client().convert_to_assets(&1_000_000), price);
}

#[test]
fn first_depositor_cannot_steal_the_next_deposit() {
    // Classic inflation attack: tiny first deposit, then inflate the share price so the
    // victim's deposit rounds down to nothing. Internal cash accounting ignores the
    // donation and the virtual offset keeps the victim's shares positive.
    let s = Setup::new();
    let attacker = s.depositor(1_000 * USDC);
    s.client().deposit(&1, &attacker, &attacker, &attacker);
    TokenClient::new(&s.env, &s.usdc).transfer(&attacker, &s.pool, &(500 * USDC));

    let victim = s.depositor(100 * USDC);
    let shares = s.client().deposit(&(100 * USDC), &victim, &victim, &victim);
    assert!(shares > 0);
    assert_eq!(s.client().max_withdraw(&victim), 100 * USDC);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn rejects_a_zero_deposit() {
    let s = Setup::new();
    let alice = s.depositor(USDC);
    s.client().deposit(&0, &alice, &alice, &alice);
}

#[test]
fn mint_charges_rounded_up_assets() {
    let s = Setup::new();
    let alice = s.depositor(100 * USDC);
    s.client().deposit(&(50 * USDC), &alice, &alice, &alice);
    let quote = s.client().preview_mint(&1_234_567);
    let paid = s.client().mint(&1_234_567, &alice, &alice, &alice);
    assert_eq!(paid, quote);
    assert_eq!(s.usdc_of(&alice), 50 * USDC - paid);
}
