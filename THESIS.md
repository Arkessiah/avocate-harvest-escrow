# Thesis

> **Farmers paid in seconds. Buyers pay only for what arrives.**
>
> The same line opens the README, the landing page, the pitch deck and the Devpost submission.

## Who it is for
Small and mid-sized farmers who sell their harvest to professional buyers in other countries, and those
buyers. Avocate, which works in agricultural trade, is the first operator.

## The problem
The farmer ships first and is paid weeks or months later, through international transfers with bank fees
and intermediaries. By then they have already paid for growing, packing and shipping, and small producers
rarely have access to credit to cover the wait. The buyer has the opposite fear: paying up front to a
seller they may never have met, with little recourse if the delivery fails.

## The bet
If the price is locked in a stablecoin where both sides can see it, and released once the delivery is
confirmed, the farmer is paid in seconds instead of weeks and the buyer only pays for what arrives. The
same locked money is good collateral, so an investor pool can advance part of the price to the farmer
before the delivery (embedded factoring), at a known cost, and is repaid first when the trade settles.

## Why Stellar
- **USDC native to the network**, finality in seconds and fees of a fraction of a cent: paying the farmer
  directly is cheap enough for small trades.
- **Soroban** enforces every rule on-chain: one escrow per trade, the validator's single verdict, the
  agent's limited power, fees frozen per trade and a SEP-56 vault for the pool.
- **The ecosystem composes**: x402 for an agent that pays for data, Soroswap to pay in XLM, wallets through
  stellar-wallets-kit, and anchors as the path to local currency.

## What success looks like
- A farmer receives the full price seconds after the delivery is confirmed.
- A farmer can take an advance of up to 80% of the price while the trade is funded.
- A buyer gets 100% back in one click if the delivery is rejected, and can be refunded once the deadline
  passes.
- Nobody, including Avocate, can change a trade's amount or redirect its payment.

## This build and the Avocate platform
**Built during HackMeridian and live on Stellar testnet** (test USDC): the escrow, the validator's verdict,
the bounded agent paying over x402, the investor pool with advances, payments in XLM through Soroswap,
trades agreed face to face by link or QR code, and the screens for every role.

**Part of the wider Avocate platform, not of this demo:** blockchain-backed traceability of the harvest,
futures and auctions of harvests, a SaaS for traders, AI and IoT services, and [Agropanel](https://agropanel.avocate.io), Avocate's
market information app for farmers. Also ahead: a fiat off-ramp, a data oracle for the physical delivery, and
mainnet.
