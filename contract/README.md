# Contracts

Soroban workspace (`soroban-sdk` 29, target `wasm32v1-none`).

| Contract | Purpose |
|---|---|
| `contracts/platform` | Avocate's single entry point. Holds the fee schedule (admin-only), deploys one escrow per trade with the fees in force at that moment, and keeps the registry of every trade it created. Escrows deployed outside it are not Avocate operations. |
| `contracts/escrow` | One instance per trade. The buyer locks the price plus the trade fee in USDC; on confirmed delivery the seller receives the full price and the treasury the fee. Past the deadline without delivery, the buyer gets the whole deposit back. |

Fee schedule (basis points, configurable by the platform admin):

| Fee | Default | Paid by |
|---|---|---|
| `trade_fee_bps` | 10 (0.1%) | Buyer, on top of the price; refunded if the trade is refunded |
| `financing_fee_bps` | 20 (0.2%) | Farmer, on an advance from the pool (not wired yet) |
| `pool_yield_bps` | 200 (2%) | Farmer, to pool depositors (not wired yet) |

## Build and test

```bash
stellar contract build    # platform tests deploy the real escrow Wasm, so build first
cargo test
```

## Testnet

| | Address |
|---|---|
| Platform | `CCIA6NOBPICFCEMMAZ6HGAJERXOVVQQDRFJB2AYU4PQT27VL7URB2ERB` |
| USDC (Circle, SAC) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| Escrow Wasm hash | `cfa2484b59264dcbf708fae0b7223ba5a12e1b1ec51ae2d762f174311b507195` |

First trade through the platform (5 USDC): create
[`6c6845d4…`](https://stellar.expert/explorer/testnet/tx/6c6845d46da6feff99e709ebf3e87e7b1e14ac37ec7df8eb8be7ae1ed414af34),
fund [`e390c11b…`](https://stellar.expert/explorer/testnet/tx/e390c11b37718dd1be8383649fa5867f5ac3ad68e81a9fa7a4148578255e5c10),
confirm [`550551fa…`](https://stellar.expert/explorer/testnet/tx/550551fa88fe4735405b7fc18399590da7f178fad88b5b47cdcdafa2cb0a2b9e)
→ seller 5 USDC, treasury 0.005 USDC.
