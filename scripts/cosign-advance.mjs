// Requests a pool advance that needs two signatures in one transaction: the farmer builds
// and submits it, the buyer only authorizes their part. This is the flow the web app
// follows (farmer signs first, buyer completes), on the SDK's contract client.
//
//   FARMER_SECRET=... BUYER_SECRET=... node cosign-advance.mjs <network.json> <pool> <escrow> <principal>
//
// Secrets come from the environment (the shell reads them from the stellar CLI keystore);
// nothing is written to disk.
import { readFileSync } from "node:fs";
import { Keypair, contract } from "@stellar/stellar-sdk";

const [configPath, pool, escrow, principal] = process.argv.slice(2);
if (!principal) {
  console.error("usage: node cosign-advance.mjs <network.json> <pool> <escrow> <principal>");
  process.exit(1);
}
const config = JSON.parse(readFileSync(configPath, "utf8"));
const farmer = Keypair.fromSecret(process.env.FARMER_SECRET);
const buyer = Keypair.fromSecret(process.env.BUYER_SECRET);
const networkPassphrase = config.network_passphrase;

// The client is generated from the contract spec stored on chain, so argument encoding
// always matches the deployed code.
const pools = await contract.Client.from({
  contractId: pool,
  rpcUrl: config.rpc_url,
  networkPassphrase,
  publicKey: farmer.publicKey(),
});
const tx = await pools.advance({ escrow, principal: BigInt(principal) });

// Anyone other than the farmer (the transaction source) who must authorize the call.
const others = tx.needsNonInvokerSigningBy();
if (others.length !== 1 || others[0] !== buyer.publicKey()) {
  throw new Error(`unexpected co-signers: ${others.join(", ") || "none"}`);
}
await tx.signAuthEntries({
  address: buyer.publicKey(),
  signAuthEntry: contract.basicNodeSigner(buyer, networkPassphrase).signAuthEntry,
});

const sent = await tx.signAndSend({
  signTransaction: contract.basicNodeSigner(farmer, networkPassphrase).signTransaction,
});
const hash = sent.sendTransactionResponse?.hash ?? sent.getTransactionResponse?.txHash;
console.log(`${config.explorer_tx}${hash}`);
