# Avocate Harvest Escrow

[![contracts](https://github.com/Arkessiah/avocate-harvest-escrow/actions/workflows/contracts.yml/badge.svg)](https://github.com/Arkessiah/avocate-harvest-escrow/actions/workflows/contracts.yml) [![web](https://github.com/Arkessiah/avocate-harvest-escrow/actions/workflows/web.yml/badge.svg)](https://github.com/Arkessiah/avocate-harvest-escrow/actions/workflows/web.yml)

**Version 0.0.3** · Stellar testnet · built for HackMeridian (Genesis · Stellar Composed)

**Live app:** https://avocate-harvest-escrow.vercel.app

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
`refund` when the deadline passes or the validator rejects the delivery. The buyer can fund
in USDC or pay the difference in XLM through Soroswap. A trade can be
opened by the buyer alone, or agreed on the spot by both parties: one proposes and signs,
the other completes it from a link or by scanning a QR code.

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
- Before any money is deposited, the buyer or the farmer can cancel the trade (state `Cancelled`). Once funded it can only end through settlement or a refund, so no one can walk away with the other party's money. Trades created before this rule (escrow code earlier than v0.0.2) cannot be cancelled; the pool refuses to finance a cancelled trade.

**Platform**
- Fee schedule, service accounts and escrow code are admin-only. Changes apply to new trades only; open trades keep the terms they were created with.
- Only escrows deployed by the platform are listed in its registry, so an escrow created on custom terms cannot pass for an Avocate operation. `is_escrow` exposes that check in a single read for other contracts (the pool uses it before lending).
- No trade can be opened until the admin links the financing pool, so every escrow knows from birth which pool may finance it.
- A trade agreed on the spot (`create_trade`) needs both the buyer's and the farmer's signatures in the same transaction, so neither can open it on the other's behalf.

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

**Service routes (web app)**
- The agent and the demo validator sign on the server; their keys live in environment variables and never reach the browser.
- Before signing, each route checks the request (size cap, per-IP rate limit, valid contract address), that the trade was deployed by the platform, that it names our agent or validator, and that it is in the right state, so a doomed call never costs a fee.
- The agent route is safe to expose: the contract only lets it trigger the agreed payout after a conforming validation.
- The validator route is a **demo convenience**, disabled unless `DEMO_VALIDATOR=true`. A real validator is an independent inspector signing with their own wallet; a public route signing as the validator would let anyone decide deliveries.
- The inspection report stays off-chain; only its SHA-256 hash is recorded, so anyone holding the report can verify it.
- **Paid delivery checks (x402).** The validator sells a delivery check at `/api/x402/delivery-check`: 0.01 USDC per query over x402, paid to the validator's account and settled on Stellar by the facilitator. It refuses contracts that are not Avocate trades before asking for any payment, and only settles once the answer has been read from the chain.
- **The agent pays before it releases.** On each run it buys the check for every trade ready to settle, compares the verdict and the report fingerprint with what the chain records, and only then calls `agent_release`. A mismatch releases nothing.
- **The agent's spending is capped.** It buys checks only from a fixed, configured address (never one taken from the incoming request), and its payment policy accepts only our validator as payee, USDC on this network, and at most 0.01 USDC per check.

**Web app**
- Every signature happens in the user's own wallet; the app never sees a secret key. Before asking for one, it checks that the wallet is on the same network as the app.
- A trade is only shown, and money only sent to it, if the platform registry confirms it was created by Avocate. A contract that imitates the escrow is refused.
- Advance requests travel from the farmer to the buyer as a link. The request sits in the URL fragment, which browsers never send to any server.
- The buyer's screen does not trust the link: it decodes the transaction they are about to sign and checks that it is a single call to the Avocate pool's `advance`, prepared for their account. The amounts shown come from that transaction.
- The farmer's signature on a request expires after one hour.
- **Paying in XLM (Soroswap).** A buyer short of USDC can pay the difference in XLM: Soroswap's router swaps exactly the USDC missing (`swap_tokens_for_exact_tokens`), with the XLM capped at the quote plus 1%, so a price move beyond that makes the swap fail instead of overcharging. The escrow itself only ever receives USDC. The router address lives in `deploy/networks/<network>.json` (on testnet it changes when the network is reset).
- Trade proposals work the same way: the link or QR code carries the compressed transaction, the receiving screen checks it is a single `create_trade` call on the Avocate platform prepared for the connected account, shows the terms read from it, and the proposer's signature expires after one hour. A damaged or oversized payload is refused before it is decoded.

## Status

| Piece | State |
|---|---|
| Trade escrow (fund, confirm, refund, validation, agent release) | Built, tested, deployed on testnet |
| Platform (fees, escrow factory, registry, upgrade) | Built, tested, deployed on testnet |
| Financing pool: deposits and withdrawals (SEP-56) | Built and tested |
| Financing pool: advances to farmers, repayment, losses | Built and tested |
| Pool and financing on testnet | Deployed; two financed trades run end to end ([report](deploy/deployments/testnet-smoke.md)) |
| Web app | Live at https://avocate-harvest-escrow.vercel.app: screens for buyer, farmer (co-signed advances), pool depositor, validator, agent and Avocate admin, plus a landing page with SEO and AI-crawler metadata. Languages in progress |
| Agent with x402 payments | Live: buys the validator's delivery check over x402 before each release |
| Pay in XLM (Soroswap) | Live on testnet: the buyer can fund a trade with XLM, swapped to USDC by Soroswap's router |

Contracts and build instructions: [`contract/`](contract/README.md).

## Deploy from a clean checkout

Requirements: Rust with the `wasm32v1-none` target, the [Stellar CLI](https://developers.stellar.org/docs/tools/cli), Python 3, Node 20+ and pnpm.

```bash
scripts/deploy.sh testnet   # build, upload, deploy platform + pool, link them
scripts/smoke.sh testnet    # two financed trades with real USDC, links in a report
```

Nothing network-specific is hardcoded: RPC, passphrase, USDC and default fees live in
[`deploy/networks/<network>.json`](deploy/networks/testnet.json), and each deployment writes its
addresses to [`deploy/deployments/<network>.json`](deploy/deployments/testnet.json). Another network
is a new config file, not a code change. Accounts are local identities of the Stellar CLI
(`avocate-<network>-<role>`); their keys never leave the machine.

Web app (`web/`): `pnpm install && pnpm dev`. Service routes need, in `web/.env.local` or in the
hosting provider: `AGENT_SECRET`, `VALIDATOR_SECRET` (secret keys of the deployed agent and
validator accounts) and, for the demo validator, `DEMO_VALIDATOR=true`. `pnpm test` runs the web unit tests.

The agent pays for delivery checks with x402 (`scripts/setup-x402.sh <network>` gives the agent
and validator accounts a USDC trustline and the agent a small USDC balance). Optional variables:
`AGENT_CHECK_BASE_URL` (where the agent buys checks; defaults to the live site, set it to
`http://localhost:3030` locally) and `X402_FACILITATOR_URL` (defaults to `https://x402.org/facilitator`).

Current testnet deployment: [addresses](deploy/deployments/testnet.json) ·
[end-to-end run](deploy/deployments/testnet-smoke.md).

## Version history

- **0.0.3**: autonomous agent that pays for the validator's delivery check over x402 (0.01 USDC per check, settled on Stellar) and releases a trade only when the check matches the chain.
- **0.0.2**: trades agreed on the spot, signed by buyer and farmer from a link or a QR code (`create_trade`, platform upgraded in place); either party can cancel a trade before it is funded (new escrow code for new trades).
- **0.0.1**: escrow, platform and financing pool on testnet; web app with buyer, farmer, pool, validator, agent and admin screens.

## Prior work

Before the event we tested parts of the project on Stellar testnet (trial contracts and
isolated pieces).

## Third-party code

The landing page's isometric drawing kit (`web/src/components/harvest-figure/kit/`) is MIT
licensed; its license file sits beside it.

## License

[PolyForm Noncommercial 1.0.0](PolyForm%20NonCommercial%201.0.0.txt).
