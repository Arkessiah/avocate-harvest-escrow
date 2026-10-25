# Contracts

[![contracts](https://github.com/Arkessiah/avocate-harvest-escrow/actions/workflows/contracts.yml/badge.svg)](https://github.com/Arkessiah/avocate-harvest-escrow/actions/workflows/contracts.yml)

Soroban workspace (`soroban-sdk` 29, target `wasm32v1-none`).

| Contract | Purpose |
|---|---|
| `contracts/platform` | Avocate's single entry point. Holds the fee schedule, the service accounts (agent, validator) and the linked financing pool, all admin-only; deploys one escrow per trade with the terms in force at that moment (`create_escrow`, signed by the buyer, or `create_trade`, signed by buyer and farmer), and keeps the registry of every trade it created. Escrows deployed outside it are not Avocate operations. Upgradeable in place. |
| `contracts/escrow` | One instance per trade. The buyer locks the price plus the trade fee in USDC. An independent validator attests the delivery once (conforming or not, with the report hash). The seller is paid the full price when the buyer confirms, or when the agent settles after a conforming validation; the agent can trigger nothing else. A rejected delivery or an expired deadline gives the buyer the whole deposit back. |
| `contracts/pool` | Financing pool following the SEP-56 vault interface. Anyone can deposit USDC for shares and redeem them; it advances money to onboarded farmers against funded Avocate escrows and is repaid when the trade settles. Shares are internal balances, not a transferable token. |

Fee schedule (basis points, configurable by the platform admin):

| Fee | Default | Paid by |
|---|---|---|
| `trade_fee_bps` | 10 (0.1%) | Buyer, on top of the price; refunded if the trade is refunded |
| `financing_fee_bps` | 20 (0.2%) | Farmer, on an advance from the pool |
| `pool_yield_bps` | 200 (2%) | Farmer, to pool depositors |

Security and anti-fraud rules are listed in the [main README](../README.md#security-and-anti-fraud-rules).

## Build and test

```bash
stellar contract build    # platform tests deploy the real escrow Wasm, so build first
cargo test
```

CI runs the same two steps on every push that touches `contract/`.

## Deployment

Contracts are deployed with [`scripts/deploy.sh`](../scripts/deploy.sh); current addresses are in
[`deploy/deployments/`](../deploy/deployments/), and an end-to-end run with real USDC in
[`testnet-smoke.md`](../deploy/deployments/testnet-smoke.md).
