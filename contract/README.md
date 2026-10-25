# Contracts

[![contracts](https://github.com/Arkessiah/avocate-harvest-escrow/actions/workflows/contracts.yml/badge.svg)](https://github.com/Arkessiah/avocate-harvest-escrow/actions/workflows/contracts.yml)

Soroban workspace (`soroban-sdk` 29, target `wasm32v1-none`).

| Contract | Purpose |
|---|---|
| `contracts/platform` | Avocate's single entry point. Holds the fee schedule, the service accounts (agent, validator) and the linked financing pool, all admin-only; deploys one escrow per trade with the terms in force at that moment, and keeps the registry of every trade it created. Escrows deployed outside it are not Avocate operations. Upgradeable in place. |
| `contracts/escrow` | One instance per trade. The buyer locks the price plus the trade fee in USDC. An independent validator attests the delivery once (conforming or not, with the report hash). The seller is paid the full price when the buyer confirms, or when the agent settles after a conforming validation; the agent can trigger nothing else. A rejected delivery or an expired deadline gives the buyer the whole deposit back. |
| `contracts/pool` | Financing pool following the SEP-56 vault interface. Anyone can deposit USDC for shares and redeem them; in later steps it advances money to farmers against funded escrows. Shares are internal balances, not a transferable token. |

Fee schedule (basis points, configurable by the platform admin):

| Fee | Default | Paid by |
|---|---|---|
| `trade_fee_bps` | 10 (0.1%) | Buyer, on top of the price; refunded if the trade is refunded |
| `financing_fee_bps` | 20 (0.2%) | Farmer, on an advance from the pool (not wired yet) |
| `pool_yield_bps` | 200 (2%) | Farmer, to pool depositors (not wired yet) |

## Security and anti-fraud rules

Every rule below is enforced on-chain and covered by tests.

**Trade escrow**
- Trade terms (parties, token, price, fees, agent, validator, pool, deadline) are fixed at creation; nobody can redirect the payout or change the amount.
- Only the buyer can fund, confirm or claim a refund.
- The validator attests a delivery **once**. A verdict that could be rewritten would let a negative attestation be swapped in later to unlock a refund.
- The agent can only trigger the payout already agreed, and only after a conforming validation. It cannot choose recipients or amounts.
- A refund before the deadline needs a non-conforming validation from the independent validator.
- State changes before any token moves, so a trade can never be settled twice.

**Platform**
- Fee schedule, service accounts and escrow code are admin-only. Changes apply to new trades only; open trades keep the terms they were created with.
- Only escrows deployed by the platform are listed in its registry, so an escrow created on custom terms cannot pass for an Avocate operation. `is_escrow` exposes that check in a single read for other contracts (the pool uses it before lending).
- No trade can be opened until the admin links the financing pool, so every escrow knows from birth which pool may finance it.

**Financing pool**
- Idle cash is tracked internally, so sending USDC straight to the pool cannot move the share price.
- Virtual shares and assets (the OpenZeppelin mitigation referenced by SEP-56) make the first-depositor inflation attack unprofitable; a deposit too small to mint a share is rejected instead of being lost to rounding.
- Rounding always favours the pool, so repeated small operations cannot drain the other depositors.
- Shares are not transferable and there are no allowances: only the owner can deposit their funds or redeem their shares.
- Only idle cash can be withdrawn; money lent to farmers stays in the pool until it is repaid.

## Build and test

```bash
stellar contract build    # platform tests deploy the real escrow Wasm, so build first
cargo test
```

CI runs the same two steps on every push that touches `contract/`.

## Testnet

| | Address |
|---|---|
| Platform | `CCIA6NOBPICFCEMMAZ6HGAJERXOVVQQDRFJB2AYU4PQT27VL7URB2ERB` |
| USDC (Circle, SAC) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| Escrow Wasm hash | `1617258a6f5e1a5b9ff71f9d259890a2819c8af8f7b099bd515e6ac45883eb22` |

First trade through the platform (5 USDC): create
[`6c6845d4…`](https://stellar.expert/explorer/testnet/tx/6c6845d46da6feff99e709ebf3e87e7b1e14ac37ec7df8eb8be7ae1ed414af34),
fund [`e390c11b…`](https://stellar.expert/explorer/testnet/tx/e390c11b37718dd1be8383649fa5867f5ac3ad68e81a9fa7a4148578255e5c10),
confirm [`550551fa…`](https://stellar.expert/explorer/testnet/tx/550551fa88fe4735405b7fc18399590da7f178fad88b5b47cdcdafa2cb0a2b9e)
→ seller 5 USDC, treasury 0.005 USDC.

The platform was then upgraded in place to add the agent and validator
([`673caf54…`](https://stellar.expert/explorer/testnet/tx/673caf54a9646b58f0a2a77c1da477f95010306da02fe620432f4f9df4600105));
address, fees and registry were kept.

- Validated trade settled by the agent (3 USDC): validate
  [`ca2ccf66…`](https://stellar.expert/explorer/testnet/tx/ca2ccf66944cbc8bf30932b56adf2b02af0ca4aa3aea67f4c5757bf666af1ef7),
  agent release [`c52f3f37…`](https://stellar.expert/explorer/testnet/tx/c52f3f37d91311d1ccbdffe98f832f292860ef7858d961c38a5ddbf4cfc01d1a).
  Releasing before validation fails with `NotValidated`; a second verdict fails with `AlreadyValidated`.
- Rejected delivery refunded before the deadline (2 USDC): validate
  [`2617616d…`](https://stellar.expert/explorer/testnet/tx/2617616d218b7ec86339c1299b8adf2e77e2951e955c51b7c47a8f7ece4d7bbc),
  refund [`c3fd7019…`](https://stellar.expert/explorer/testnet/tx/c3fd70195b0a15aa86aadc9ee5af105decbe53b92c56a5e317d9e440d6773c69).
