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
        let pool = env.register(Pool, (Address::generate(&env), &usdc, Address::generate(&env)));
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

// Lending runs against the real platform and escrow Wasm (build them first).
mod lending {
    use super::*;
    use soroban_sdk::testutils::Ledger;
    use soroban_sdk::BytesN;

    mod platform {
        soroban_sdk::contractimport!(file = "../../target/wasm32v1-none/release/platform.wasm");
    }
    mod escrow {
        soroban_sdk::contractimport!(file = "../../target/wasm32v1-none/release/escrow.wasm");
    }

    const START: u64 = 1_000;
    const TERM: u64 = 100_000;
    const PRICE: i128 = 1_000 * USDC;

    struct Market {
        env: Env,
        usdc: Address,
        treasury: Address,
        platform: Address,
        pool: Address,
        alice: Address,
        bob: Address,
    }

    struct Trade {
        buyer: Address,
        farmer: Address,
        escrow: Address,
    }

    impl Market {
        fn new() -> Self {
            let env = Env::default();
            env.mock_all_auths();
            env.ledger().set_timestamp(START);
            let admin = Address::generate(&env);
            let treasury = Address::generate(&env);
            let usdc = env.register_stellar_asset_contract_v2(Address::generate(&env)).address();
            let wasm = env.deployer().upload_contract_wasm(escrow::WASM);
            let fees = platform::Fees { trade_fee_bps: 10, financing_fee_bps: 20, pool_yield_bps: 200 };
            let platform = env.register(
                platform::WASM,
                (&admin, &usdc, &treasury, Address::generate(&env), Address::generate(&env), wasm, fees),
            );
            let pool = env.register(Pool, (&admin, &usdc, &platform));
            platform::Client::new(&env, &platform).set_pool(&pool);

            let alice = Address::generate(&env);
            let bob = Address::generate(&env);
            let m = Market { env, usdc, treasury, platform, pool, alice, bob };
            m.give(&m.alice, 3_000 * USDC);
            m.give(&m.bob, 1_000 * USDC);
            m.pool().deposit(&(3_000 * USDC), &m.alice, &m.alice, &m.alice);
            m.pool().deposit(&(1_000 * USDC), &m.bob, &m.bob, &m.bob);
            m
        }

        fn pool(&self) -> PoolClient<'_> {
            PoolClient::new(&self.env, &self.pool)
        }

        fn give(&self, who: &Address, amount: i128) {
            StellarAssetClient::new(&self.env, &self.usdc).mint(who, &amount);
        }

        fn usdc(&self, who: &Address) -> i128 {
            TokenClient::new(&self.env, &self.usdc).balance(who)
        }

        fn funded_trade(&self) -> Trade {
            let buyer = Address::generate(&self.env);
            let farmer = Address::generate(&self.env);
            self.give(&buyer, 2_000 * USDC);
            let escrow = platform::Client::new(&self.env, &self.platform)
                .create_escrow(&buyer, &farmer, &PRICE, &(START + TERM));
            escrow::Client::new(&self.env, &escrow).fund();
            self.pool().onboard(&farmer, &(2_000 * USDC));
            Trade { buyer, farmer, escrow }
        }

        fn trade(&self, t: &Trade) -> escrow::Client<'_> {
            escrow::Client::new(&self.env, &t.escrow)
        }

        fn validate(&self, t: &Trade, ok: bool) {
            self.trade(t).validate(&ok, &BytesN::from_array(&self.env, &[3; 32]));
        }

        fn at(&self, t: u64) {
            self.env.ledger().set_timestamp(t);
        }
    }

    #[test]
    fn advance_pays_the_farmer_and_keeps_the_pool_value() {
        let m = Market::new();
        let t = m.funded_trade();
        m.pool().advance(&t.escrow, &(800 * USDC));

        assert_eq!(m.usdc(&t.farmer), 800 * USDC);
        assert_eq!(m.pool().total_assets(), 4_000 * USDC);
        assert_eq!(m.pool().exposure(&t.farmer), 800 * USDC);
        let a = m.trade(&t).advance().unwrap();
        assert_eq!(a.repay, 816 * USDC);
    }

    #[test]
    fn advance_needs_the_farmer_and_the_buyer() {
        let m = Market::new();
        let t = m.funded_trade();
        m.pool().advance(&t.escrow, &(100 * USDC));
        let auths = m.env.auths();
        assert!(auths.iter().any(|a| a.0 == t.farmer));
        assert!(auths.iter().any(|a| a.0 == t.buyer));
    }

    #[test]
    fn settlement_repays_the_pool_and_depositors_earn_the_yield() {
        let m = Market::new();
        let t = m.funded_trade();
        m.pool().advance(&t.escrow, &(800 * USDC));
        m.validate(&t, true);
        m.trade(&t).agent_release();

        // Pool gets 800 + 2%, platform 0.2% of the advance + 0.1% of the price, farmer the rest.
        assert_eq!(m.pool().total_assets(), 4_016 * USDC);
        assert_eq!(m.usdc(&m.treasury), 16 * USDC / 10 + USDC);
        assert_eq!(m.usdc(&t.farmer), 800 * USDC + (PRICE - 816 * USDC - 16 * USDC / 10));
        assert!(m.pool().loans().is_empty());
        assert_eq!(m.pool().exposure(&t.farmer), 0);
        // Alice owns 3/4 of the pool, so 3/4 of the 16 USDC yield.
        assert_eq!(m.pool().max_withdraw(&m.alice), 3_012 * USDC - 1);
    }

    #[test]
    fn yield_accrues_over_the_term_not_all_at_once() {
        let m = Market::new();
        let t = m.funded_trade();
        m.pool().advance(&t.escrow, &(800 * USDC));
        m.at(START + TERM / 2);
        assert_eq!(m.pool().total_assets(), 4_008 * USDC);
        m.at(START + TERM);
        assert_eq!(m.pool().total_assets(), 4_016 * USDC);
    }

    #[test]
    fn an_overdue_loan_is_worth_nothing_until_repaid() {
        let m = Market::new();
        let t = m.funded_trade();
        m.pool().advance(&t.escrow, &(800 * USDC));
        m.at(START + TERM + 1);
        assert_eq!(m.pool().total_assets(), 3_200 * USDC);
    }

    #[test]
    fn deadline_refund_repays_the_pool_first_so_colluding_gains_nothing() {
        let m = Market::new();
        let t = m.funded_trade();
        let buyer_before = m.usdc(&t.buyer) + 1_001 * USDC; // deposit = price + 0.1%
        m.pool().advance(&t.escrow, &(800 * USDC));
        m.at(START + TERM + 1);
        m.trade(&t).refund();

        assert_eq!(m.pool().total_assets(), 4_016 * USDC);
        // Together, buyer and farmer end up exactly where they started minus the yield.
        let pair_after = m.usdc(&t.buyer) + m.usdc(&t.farmer);
        assert_eq!(pair_after, buyer_before - 16 * USDC);
    }

    #[test]
    fn rejected_delivery_refunds_the_buyer_and_the_loss_is_shared() {
        let m = Market::new();
        let t = m.funded_trade();
        m.pool().advance(&t.escrow, &(800 * USDC));
        m.validate(&t, false);
        m.trade(&t).refund();

        assert_eq!(m.usdc(&t.buyer), 2_000 * USDC);
        assert_eq!(m.pool().total_assets(), 3_200 * USDC);
        assert!(m.pool().loans().is_empty());
        // 800 lost on 4000: each depositor keeps 80% of what they put in.
        assert_eq!(m.pool().max_withdraw(&m.alice), 2_400 * USDC);
        assert_eq!(m.pool().max_withdraw(&m.bob), 800 * USDC);
    }

    #[test]
    fn lent_money_cannot_be_withdrawn() {
        let m = Market::new();
        let t = m.funded_trade();
        m.pool().advance(&t.escrow, &(800 * USDC));
        assert_eq!(m.pool().max_withdraw(&m.alice), 3_000 * USDC);
        let rich = Address::generate(&m.env);
        m.give(&rich, 10_000 * USDC);
        m.pool().deposit(&(10_000 * USDC), &rich, &rich, &rich);
        m.pool().advance(&m.funded_trade().escrow, &(800 * USDC));
        assert!(m.pool().max_withdraw(&rich) <= m.pool().total_assets() - 1_600 * USDC);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #8)")]
    fn only_onboarded_farmers_get_advances() {
        let m = Market::new();
        let t = m.funded_trade();
        m.pool().offboard(&t.farmer);
        m.pool().advance(&t.escrow, &(100 * USDC));
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #9)")]
    fn advance_is_capped_at_80_percent_of_the_price() {
        let m = Market::new();
        let t = m.funded_trade();
        m.pool().advance(&t.escrow, &(801 * USDC));
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #10)")]
    fn exposure_per_farmer_is_capped() {
        let m = Market::new();
        let t = m.funded_trade();
        m.pool().onboard(&t.farmer, &(500 * USDC));
        m.pool().advance(&t.escrow, &(600 * USDC));
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #5)")]
    fn escrows_outside_the_platform_are_not_financed() {
        let m = Market::new();
        let a = Address::generate(&m.env);
        let parties = escrow::Parties {
            buyer: a.clone(),
            seller: a.clone(),
            platform: a.clone(),
            agent: a.clone(),
            validator: a.clone(),
            pool: m.pool.clone(),
        };
        let terms = escrow::Terms {
            token: m.usdc.clone(),
            amount: PRICE,
            trade_fee_bps: 0,
            financing_fee_bps: 0,
            pool_yield_bps: 0,
            deadline: START + TERM,
        };
        let fake = m.env.register(escrow::WASM, (parties, terms));
        m.pool().onboard(&a, &PRICE);
        m.pool().advance(&fake, &(100 * USDC));
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #8)")]
    fn a_trade_cannot_be_financed_twice() {
        let m = Market::new();
        let t = m.funded_trade();
        m.pool().advance(&t.escrow, &(100 * USDC));
        m.pool().advance(&t.escrow, &(100 * USDC));
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #13)")]
    fn only_a_lent_escrow_can_report_a_repayment() {
        let m = Market::new();
        m.pool().on_repaid(&Address::generate(&m.env));
    }

    #[test]
    #[should_panic]
    fn non_admin_cannot_onboard_farmers() {
        let m = Market::new();
        m.env.set_auths(&[]);
        m.pool().onboard(&Address::generate(&m.env), &PRICE);
    }

    // The deployed pool predates the Cancelled state. Financing a cancelled trade must still
    // fail, and it does: the pool cannot even read that state, let alone treat it as funded.
    #[test]
    #[should_panic]
    fn a_cancelled_trade_cannot_be_financed() {
        let m = Market::new();
        let buyer = Address::generate(&m.env);
        let farmer = Address::generate(&m.env);
        let escrow = platform::Client::new(&m.env, &m.platform).create_escrow(&buyer, &farmer, &PRICE, &(START + TERM));
        escrow::Client::new(&m.env, &escrow).cancel(&farmer);
        m.pool().onboard(&farmer, &(2_000 * USDC));
        m.pool().advance(&escrow, &(100 * USDC));
    }
}
