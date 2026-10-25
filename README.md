# Avocate Harvest Escrow

[![contracts](https://github.com/Arkessiah/avocate-harvest-escrow/actions/workflows/contracts.yml/badge.svg)](https://github.com/Arkessiah/avocate-harvest-escrow/actions/workflows/contracts.yml)

**Version 0.0.1** · Stellar testnet · built for HackMeridian (Genesis · Stellar Composed)

Stablecoin escrow for agricultural trade between farmers and buyers, on Stellar (Soroban).
Today a farmer ships the harvest and waits weeks to be paid. Here the buyer locks the price in
USDC when ordering, and the farmer is paid **in seconds** once the delivery is confirmed. If
the delivery fails, the buyer gets the money back. Farmers who need cash before delivery can
get an advance from a financing pool funded by buyers and other depositors.

## How it works

| Role | What they do |
|---|---|
| **Buyer** | Opens the trade, locks price + service fee in USDC, confirms the delivery or claims a refund. |
| **Farmer (seller)** | Gets the full price on settlement; can be advanced part of it by the pool. |
| **Validator** | Independent inspector: attests once whether the delivery conforms, with the report hash. |
| **Agent** | Service account that settles the trade on its own, but only after a conforming validation and only with the payout already agreed. |
| **Pool depositors** | Lend USDC to the pool and earn the yield paid by financed farmers. |
| **Avocate (platform)** | Sets the fee schedule, deploys every trade escrow and keeps the registry of trades. |

Flow: `create → fund → (validate) → confirm by the buyer or release by the agent`, or
`refund` when the deadline passes or the validator rejects the delivery.

### Fees (configurable by the platform, snapshotted into each trade)

| Fee | Default | Paid by |
|---|---|---|
| Trade fee | 0.1% | Buyer, on top of the price; refunded if the trade is refunded |
| Financing fee | 0.2% of the advance | Farmer, to the platform |
| Pool yield | 2% of the advance | Farmer, to pool depositors |

A fee change only affects trades created afterwards: nobody sees the terms of an agreed trade change.

## Security and anti-fraud rules

Every rule below is enforced on-chain and covered by tests. This section grows with each piece
that is built.

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

**Financing (advances to farmers)**
- Only genuine Avocate trades can be financed: the pool checks the platform registry, that the escrow names this pool, that it is funded and still within its deadline.
- Only farmers onboarded by the admin get advances, up to **80% of the price** and up to a per-farmer exposure cap. One advance per trade, and none once a verdict exists.
- Both the farmer and the buyer sign the advance. By signing, the buyer accepts that a deadline refund repays the pool first.
- The amount owed (advance + 2%) is computed by the escrow from the terms it snapshotted at creation, never taken from the caller.
- **Deadline refund on a financed trade:** the pool is repaid first and the buyer gets the rest. A buyer and a farmer who agree to let the trade lapse end up exactly where they started minus the yield: colluding gains nothing.
- **Rejected delivery (independent validator):** the buyer gets the whole deposit back and the advance is written off. The loss is shared by all depositors in proportion to their shares.
- Yield accrues linearly over the loan term, so nobody can deposit just before a repayment, take the yield and leave.
- A loan past its deadline counts as zero in the pool value until it is repaid, so a depositor who sees a loss coming cannot exit at a price that still includes it.
- The pool only accepts repayment and loss notices from escrows it actually lent to.

## Status

| Piece | State |
|---|---|
| Trade escrow (fund, confirm, refund, validation, agent release) | Built, tested, deployed on testnet |
| Platform (fees, escrow factory, registry, upgrade) | Built, tested, deployed on testnet |
| Financing pool: deposits and withdrawals (SEP-56) | Built and tested |
| Financing pool: advances to farmers, repayment, losses | Built and tested |
| Pool and financing on testnet | In progress |
| Web app | Planned |

Contracts, build instructions and testnet addresses: [`contract/`](contract/README.md).

## Prior work

Before the event we tested parts of the project on Stellar testnet (trial contracts and
isolated pieces).

## License

[PolyForm Noncommercial 1.0.0](PolyForm%20NonCommercial%201.0.0.txt).
