# Spec

**Farmers paid in seconds. Buyers pay only for what arrives.**

## The demo path
Everything happens on Stellar testnet with test USDC, at https://avocate-harvest-escrow.vercel.app.

1. **Agree a trade.** The buyer opens a trade for a farmer with a price and a deadline, or the two agree
   it on the spot: one proposes and signs, the other completes it from a link or a QR code.
2. **Lock the price.** The buyer funds the trade in USDC (price + 1%), or pays the difference in XLM,
   swapped on Soroswap in the same step.
3. **Advance (optional).** While the trade is funded, the farmer asks the pool for up to 80% of the price.
   The farmer signs first and sends a link; the buyer completes it; the farmer receives USDC at once.
4. **Validate.** An independent validator records one verdict on the delivery, with the hash of the
   inspection report.
5. **Settle.** The buyer confirms, or the agent pays for the delivery check over x402 and releases the
   payment. The pool is repaid first if it advanced money; the farmer receives the rest.
6. **Or refund.** A rejected delivery returns 100% to the buyer; after the deadline anyone can trigger the
   refund, and the pool is repaid first.

## Screens
| Screen | For | Main actions |
|---|---|---|
| `/` | Everyone | What it is, live numbers, how it works |
| `/app` | Everyone | Choose a role, with your wallet or a demo wallet |
| `/buyer` | Buyer | Create, propose, fund (USDC or XLM), confirm, refund, approve an advance |
| `/farmer` | Farmer | Propose a trade, request an advance, follow payment |
| `/pool` | Investors | Deposit, withdraw, see loans and yield |
| `/validator` | Inspector | Record the delivery verdict |
| `/agent` | Agent | Release payments after a conforming validation, paying over x402 |
| `/admin` | Avocate | Fees, farmer onboarding, registry of every trade |

Each role sees only its own screen; Avocate's admin sees all of them, including the agent. Demo wallets
(prepared test accounts with test USDC) let anyone try a role without installing a wallet, and a demo
farmer's advance can be completed as the demo buyer of the same trade.

Every action shows its steps while it runs, links to its transaction, and is kept in the browser's
history panel. Any trade can be shared with another role by link or QR code.

## Deployment
The contracts run on Stellar testnet (`deploy/deployments/testnet.json`). The web app is hosted on **Vercel**
and deployed from `main` on every push; service keys (agent, demo validator) and the demo wallets live in
Vercel's environment variables, never in the repository.

## Done when
- [x] Each step of the demo path works on testnet and can be checked in the explorer.
- [x] Contract rules are covered by tests (77) and the web logic by tests (22), run in CI on every push.
- [x] A security review (CoinFabrik Scout + manual) is published, with its fixes deployed.
- [x] `scripts/seed.mjs` fills testnet with trades in every state, so every screen has real data.
- [x] `scripts/demo-wallets.mjs` prepares demo wallets, so anyone can run the whole flow without a wallet.
- [x] No secret keys in the repository; service keys are set in the hosting provider and in local env files that git ignores.
- [ ] Demo video recorded.

## Out of scope for the hackathon
Fiat off-ramp (SEP-24 anchor), a data oracle for the physical delivery, multisig admin and the other
pre-mainnet hardening listed in the security review, Spanish and Portuguese translations, mainnet.
