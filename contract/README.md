# Contracts

Soroban workspace (`soroban-sdk` 28, target `wasm32v1-none`).

| Contract | Purpose |
|---|---|
| `contracts/escrow` | One instance per trade. The buyer locks the price plus a service fee in a stablecoin; on confirmed delivery the seller receives the full price and the platform the fee. Past the deadline without delivery, the buyer gets the whole deposit back. |

## Build and test

```bash
cargo test                # unit tests, run on the host
stellar contract build    # -> target/wasm32v1-none/release/escrow.wasm
```
