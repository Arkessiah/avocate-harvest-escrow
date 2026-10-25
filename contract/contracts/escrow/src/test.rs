#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::token::{StellarAssetClient, TokenClient};
use soroban_sdk::{Address, BytesN, Env};

const USDC: i128 = 10_000_000; // 7 decimals
const AMOUNT: i128 = 1_000 * USDC;
const FEE_BPS: u32 = 10; // 0.1%
const FEE: i128 = USDC; // 0.1% of 1000 USDC
const DEADLINE: u64 = 1_000_000;

// Owned values only: keeping a client with a borrowed Env inside the struct is a
// self-referential lifetime the borrow checker rejects, so clients are built on demand.
struct Setup {
    env: Env,
    buyer: Address,
    seller: Address,
    platform: Address,
    agent: Address,
    validator: Address,
    token: Address,
    escrow: Address,
}

impl Setup {
    fn new(fee_bps: u32) -> Self {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(1_000);

        let issuer = Address::generate(&env);
        let buyer = Address::generate(&env);
        let seller = Address::generate(&env);
        let platform = Address::generate(&env);
        let agent = Address::generate(&env);
        let validator = Address::generate(&env);
        let token = env.register_stellar_asset_contract_v2(issuer).address();
        StellarAssetClient::new(&env, &token).mint(&buyer, &(5_000 * USDC));

        let escrow = env.register(
            Escrow,
            (&buyer, &seller, &platform, &agent, &validator, &token, AMOUNT, fee_bps, DEADLINE),
        );
        Setup { env, buyer, seller, platform, agent, validator, token, escrow }
    }

    fn client(&self) -> EscrowClient<'_> {
        EscrowClient::new(&self.env, &self.escrow)
    }

    fn report(&self) -> BytesN<32> {
        BytesN::from_array(&self.env, &[1; 32])
    }

    fn balance(&self, who: &Address) -> i128 {
        TokenClient::new(&self.env, &self.token).balance(who)
    }
}

#[test]
fn starts_pending_with_the_agreed_terms() {
    let s = Setup::new(FEE_BPS);
    assert_eq!(s.client().state(), State::Pending);
    let config = s.client().config();
    assert_eq!(config.buyer, s.buyer);
    assert_eq!(config.amount, AMOUNT);
    assert_eq!(config.trade_fee_bps, FEE_BPS);
}

#[test]
fn fund_locks_price_plus_fee_and_needs_the_buyer() {
    let s = Setup::new(FEE_BPS);
    s.client().fund();
    // env.auths() only reports the most recent invocation, so check it before any read.
    assert_eq!(s.env.auths()[0].0, s.buyer);

    assert_eq!(s.client().state(), State::Funded);
    assert_eq!(s.balance(&s.escrow), AMOUNT + FEE);
    assert_eq!(s.balance(&s.buyer), 5_000 * USDC - AMOUNT - FEE);
}

#[test]
fn confirm_pays_the_full_price_to_seller_and_fee_to_platform() {
    let s = Setup::new(FEE_BPS);
    s.client().fund();
    s.client().confirm_delivery();

    assert_eq!(s.client().state(), State::Released);
    assert_eq!(s.balance(&s.seller), AMOUNT);
    assert_eq!(s.balance(&s.platform), FEE);
    assert_eq!(s.balance(&s.escrow), 0);
}

#[test]
fn zero_fee_charges_the_buyer_only_the_price() {
    let s = Setup::new(0);
    s.client().fund();
    s.client().confirm_delivery();

    assert_eq!(s.balance(&s.buyer), 5_000 * USDC - AMOUNT);
    assert_eq!(s.balance(&s.seller), AMOUNT);
    assert_eq!(s.balance(&s.platform), 0);
}

#[test]
fn cannot_confirm_before_funding() {
    let s = Setup::new(FEE_BPS);
    assert_eq!(s.client().try_confirm_delivery(), Err(Ok(Error::InvalidState)));
}

#[test]
fn cannot_fund_twice() {
    let s = Setup::new(FEE_BPS);
    s.client().fund();
    assert_eq!(s.client().try_fund(), Err(Ok(Error::InvalidState)));
}

#[test]
fn refund_is_blocked_until_the_deadline() {
    let s = Setup::new(FEE_BPS);
    s.client().fund();
    s.env.ledger().set_timestamp(DEADLINE);
    assert_eq!(s.client().try_refund(), Err(Ok(Error::NotExpired)));
}

#[test]
fn refund_after_deadline_returns_price_and_fee_to_the_buyer() {
    let s = Setup::new(FEE_BPS);
    s.client().fund();
    s.env.ledger().set_timestamp(DEADLINE + 1);
    s.client().refund();

    assert_eq!(s.client().state(), State::Refunded);
    assert_eq!(s.balance(&s.buyer), 5_000 * USDC);
    assert_eq!(s.balance(&s.escrow), 0);
}

#[test]
fn a_refunded_escrow_cannot_be_settled() {
    let s = Setup::new(FEE_BPS);
    s.client().fund();
    s.env.ledger().set_timestamp(DEADLINE + 1);
    s.client().refund();
    assert_eq!(s.client().try_confirm_delivery(), Err(Ok(Error::InvalidState)));
}

#[test]
fn a_released_escrow_cannot_be_refunded() {
    let s = Setup::new(FEE_BPS);
    s.client().fund();
    s.client().confirm_delivery();
    s.env.ledger().set_timestamp(DEADLINE + 1);
    assert_eq!(s.client().try_refund(), Err(Ok(Error::InvalidState)));
}

#[test]
fn fee_rounds_down_on_tiny_amounts() {
    let env = Env::default();
    env.mock_all_auths();
    let issuer = Address::generate(&env);
    let buyer = Address::generate(&env);
    let a = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(issuer).address();
    StellarAssetClient::new(&env, &token).mint(&buyer, &10_000);
    // 999 base units at 0.1% is 0.999 -> 0: the platform waives the fraction.
    let escrow = env.register(Escrow, (&buyer, &a, &a, &a, &a, &token, 999_i128, FEE_BPS, DEADLINE));
    EscrowClient::new(&env, &escrow).fund();
    assert_eq!(TokenClient::new(&env, &token).balance(&buyer), 10_000 - 999);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rejects_a_fee_above_100_percent() {
    Setup::new(10_001);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn rejects_a_deadline_in_the_past() {
    let env = Env::default();
    env.ledger().set_timestamp(DEADLINE + 1);
    let a = Address::generate(&env);
    env.register(Escrow, (&a, &a, &a, &a, &a, &a, AMOUNT, FEE_BPS, DEADLINE));
}

#[test]
fn validator_records_its_verdict_once() {
    let s = Setup::new(FEE_BPS);
    s.client().fund();
    s.client().validate(&true, &s.report());
    assert_eq!(s.env.auths()[0].0, s.validator);

    let v = s.client().validation().unwrap();
    assert!(v.ok);
    assert_eq!(v.report_hash, s.report());
    assert_eq!(s.client().try_validate(&false, &s.report()), Err(Ok(Error::AlreadyValidated)));
}

#[test]
fn cannot_validate_an_unfunded_trade() {
    let s = Setup::new(FEE_BPS);
    assert_eq!(s.client().try_validate(&true, &s.report()), Err(Ok(Error::InvalidState)));
}

#[test]
fn agent_cannot_release_without_a_validation() {
    let s = Setup::new(FEE_BPS);
    s.client().fund();
    assert_eq!(s.client().try_agent_release(), Err(Ok(Error::NotValidated)));
}

#[test]
fn agent_cannot_release_a_rejected_delivery() {
    let s = Setup::new(FEE_BPS);
    s.client().fund();
    s.client().validate(&false, &s.report());
    assert_eq!(s.client().try_agent_release(), Err(Ok(Error::NotValidated)));
}

#[test]
fn agent_releases_the_agreed_payout_after_a_positive_validation() {
    let s = Setup::new(FEE_BPS);
    s.client().fund();
    s.client().validate(&true, &s.report());
    s.client().agent_release();
    assert_eq!(s.env.auths()[0].0, s.agent);

    assert_eq!(s.client().state(), State::Released);
    assert_eq!(s.balance(&s.seller), AMOUNT);
    assert_eq!(s.balance(&s.platform), FEE);
    assert_eq!(s.balance(&s.escrow), 0);
}

#[test]
#[should_panic]
fn only_the_agent_can_release() {
    let s = Setup::new(FEE_BPS);
    s.client().fund();
    s.client().validate(&true, &s.report());
    s.env.set_auths(&[]);
    s.client().agent_release();
}

#[test]
#[should_panic]
fn only_the_validator_can_validate() {
    let s = Setup::new(FEE_BPS);
    s.client().fund();
    s.env.set_auths(&[]);
    s.client().validate(&false, &s.report());
}

#[test]
fn a_rejected_delivery_unlocks_the_refund_before_the_deadline() {
    let s = Setup::new(FEE_BPS);
    s.client().fund();
    s.client().validate(&false, &s.report());
    s.client().refund();

    assert_eq!(s.client().state(), State::Refunded);
    assert_eq!(s.balance(&s.buyer), 5_000 * USDC);
}

#[test]
fn a_positive_validation_does_not_unlock_an_early_refund() {
    let s = Setup::new(FEE_BPS);
    s.client().fund();
    s.client().validate(&true, &s.report());
    assert_eq!(s.client().try_refund(), Err(Ok(Error::NotExpired)));
}
