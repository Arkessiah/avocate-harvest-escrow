# Smoke test on testnet

Run on 2026-10-25T15:07:48Z against platform `CBHU4N74WPLTXFNQ6JERWD7A3CIZCHVG433BCWOYYP3SR677FWPZNXBF` and pool `CDAEMNCIH7ALNKVHDGAVOR5FWT2KZFW5AZCP7TTSDJP6NAD3EWJPHH3D`.
Price 10 USDC per trade, advance 8 USDC (80%), yield 2%, financing fee 0.2%, trade fee 0.1%.

| Step | Transaction |
|---|---|
| Admin onboards the farmer (limit 50 USDC) | https://stellar.expert/explorer/testnet/tx/86def9baf4f0fc0ee8cd09994bae602c72be402a433a5f135d380560cf608c80 |
| Depositor puts 20 USDC in the pool | https://stellar.expert/explorer/testnet/tx/83915fe22b67c2b7465428e6537232da054cbeef8ab5e78477cb2bb28e0d76ba |
| **A** buyer opens trade `CCRSHJUSAMJOHWPESUJQGHIEBJKLNEPTQEOPCA27YAJ7FUNSYW7PGJOH` |  |
| A: buyer funds 10 + 0.1% | https://stellar.expert/explorer/testnet/tx/6318c1b0e8ee17e78a2fc950bf0466469f5cf7669267cac5b5de147ab36509af |
| A: farmer requests 8 USDC, buyer co-signs | https://stellar.expert/explorer/testnet/tx/6112f8c88fe3252fd77920dc1250f9eff9f381d3d681b8664335618f8ec00fac |
| A: validator attests a conforming delivery | https://stellar.expert/explorer/testnet/tx/9462667753c07fbe8d926c49ff3e08fedaebf361c29138bfed074d3f93a33182 |
| A: agent settles | https://stellar.expert/explorer/testnet/tx/2fd3d74de3774a630f3a34c0956e730e9593a69e4b064a065955ca58c8ccd8b4 |
| **B** buyer opens trade `CA2MBWLW4PQRRHMMYMEQZULZTRQJL7HQMJ2LC7A7VCL6MI7DMMNBCLNI` |  |
| B: buyer funds 10 + 0.1% | https://stellar.expert/explorer/testnet/tx/bcc0707d4672d8172054e4396a4481736c574df83cdc0dcf4c5b80a3e6ec80b7 |
| B: farmer requests 8 USDC, buyer co-signs | https://stellar.expert/explorer/testnet/tx/92384d923ecad869fae24a85985f09fbe7d4014b0fd19dd70a412e25de913254 |
| B: validator rejects the delivery | https://stellar.expert/explorer/testnet/tx/600e968bbd53bf41749fd71cb1c838a9a2ed6b92bd0abed9514443d18bac510b |
| B: buyer is refunded in full | https://stellar.expert/explorer/testnet/tx/d1243f7511eba8b51d6b61c643b18a2775ebb6b00c6d19329e015e4afd40d80c |

| Pool value | USDC |
|---|---|
| Before the trades | 40.0027 |
| After A (repaid 8 + 2%) | 40.1640 |
| After B (8 written off) | 32.1652 |

The pool value also includes the yield accruing on any other loan still open on this
deployment, so the changes can differ from the round figures by that accrual.

Trade A ended `Released`, trade B `Refunded`.
