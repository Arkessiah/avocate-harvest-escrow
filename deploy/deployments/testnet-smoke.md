# Smoke test on testnet

Run on 2026-10-25T15:31:02Z against platform `CBHU4N74WPLTXFNQ6JERWD7A3CIZCHVG433BCWOYYP3SR677FWPZNXBF` and pool `CDAEMNCIH7ALNKVHDGAVOR5FWT2KZFW5AZCP7TTSDJP6NAD3EWJPHH3D`.
Price 10 USDC per trade, advance 8 USDC (80%), yield 2%, financing fee 0.2%, trade fee 0.1%.

| Step | Transaction |
|---|---|
| Admin onboards the farmer (limit 50 USDC) | https://stellar.expert/explorer/testnet/tx/cb296a4cc4bba807ed33bf1a41c8fa5c75864512e55744a06081ade9125f9043 |
| Depositor puts 20 USDC in the pool | https://stellar.expert/explorer/testnet/tx/9d68e29c1b24a3c878806e8feb3d59640f76f9f4b4aa0bcfaf5c67813848aca5 |
| **A** buyer opens trade `CBENWET3OKGCVZ7CXHN75TSMPSTWN4HMGZYJCCJF7YNDB3OYLWFOHYG7` |  |
| A: buyer funds 10 + 0.1% | https://stellar.expert/explorer/testnet/tx/7995a8a6a805fd3cd5d7f95fb1ff626c1310152cd7446a49b19f54213ead31e2 |
| A: farmer requests 8 USDC, buyer co-signs | https://stellar.expert/explorer/testnet/tx/c674934a8318b1e3c5635b92f6c24a5747ea3f7447e9107bf4a131649ced86af |
| A: validator attests a conforming delivery | https://stellar.expert/explorer/testnet/tx/67299e1e9b9133400ba8b884daa256996ca34f413c0147f686fa20f1a6ab52e4 |
| A: agent settles | https://stellar.expert/explorer/testnet/tx/8559cf035dbb99fd1cfc5880d3122a407cc58acf758532ba327accd1a918601a |
| **B** buyer opens trade `CBNBDMQSX25HTEUL7KUJTDCOSRIWFHX6ZKDZJDOGZ7AFDLVUF4CYKWI5` |  |
| B: buyer funds 10 + 0.1% | https://stellar.expert/explorer/testnet/tx/561e24f63127d743d4ee859c4815cdec6d9c1287e4d1e725b87f4c22cae32143 |
| B: farmer requests 8 USDC, buyer co-signs | https://stellar.expert/explorer/testnet/tx/a93d8ce350a947c75a2e7a014aadba0020583372b5396a5a4c0e5c039def888b |
| B: validator rejects the delivery | https://stellar.expert/explorer/testnet/tx/98f40b359cb57bb0c09ce4b340d859ab9102e4d82242d6c3948d11f3fc72d629 |
| B: buyer is refunded in full | https://stellar.expert/explorer/testnet/tx/db0474012494f5bf16385ed465062dafbf551971969cd288aad334e4e8900dd6 |

| Pool value | USDC |
|---|---|
| Before the trades | 72.2320 |
| After A (repaid 8 + 2%) | 72.3937 |
| After B (8 written off) | 64.3954 |

The pool value also includes the yield accruing on any other loan still open on this
deployment, so the changes can differ from the round figures by that accrual.

Trade A ended `Released`, trade B `Refunded`.
