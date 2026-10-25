// Requests a pool advance that needs two signatures in one transaction: the farmer builds
// and submits it, the buyer only authorizes their part. This is the flow the web app
// follows (farmer signs first, buyer completes).
//
//   FARMER_SECRET=... BUYER_SECRET=... node cosign-advance.mjs <network.json> <pool> <escrow> <principal>
//
// Secrets come from the environment (the shell reads them from the stellar CLI keystore);
// nothing is written to disk.
import { readFileSync } from "node:fs";
import {
  rpc,
  Keypair,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Address,
  nativeToScVal,
  authorizeEntry,
  xdr,
} from "@stellar/stellar-sdk";

const [configPath, pool, escrow, principal] = process.argv.slice(2);
if (!principal) {
  console.error("usage: node cosign-advance.mjs <network.json> <pool> <escrow> <principal>");
  process.exit(1);
}
const config = JSON.parse(readFileSync(configPath, "utf8"));
const farmer = Keypair.fromSecret(process.env.FARMER_SECRET);
const buyer = Keypair.fromSecret(process.env.BUYER_SECRET);
const server = new rpc.Server(config.rpc_url);
const passphrase = config.network_passphrase;

const build = async (op) =>
  new TransactionBuilder(await server.getAccount(farmer.publicKey()), {
    fee: BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(op)
    .setTimeout(120)
    .build();

const call = new Contract(pool).call(
  "advance",
  new Address(escrow).toScVal(),
  nativeToScVal(BigInt(principal), { type: "i128" }),
);

// 1. Simulate to learn which authorizations the call needs.
const sim = await server.simulateTransaction(await build(call));
if (!rpc.Api.isSimulationSuccess(sim)) throw new Error(`simulation failed: ${sim.error}`);

// 2. The buyer signs only their own entry. The farmer, as transaction source, is covered by
//    the envelope signature and needs no separate entry.
const { sequence } = await server.getLatestLedger();
const auth = await Promise.all(
  sim.result.auth.map((entry) => {
    const creds = entry.credentials();
    if (creds.switch() !== xdr.SorobanCredentialsType.sorobanCredentialsAddress()) return entry;
    const who = Address.fromScAddress(creds.address().address()).toString();
    if (who !== buyer.publicKey()) throw new Error(`unexpected signer required: ${who}`);
    return authorizeEntry(entry, buyer, sequence + 100, passphrase);
  }),
);

// 3. Rebuild with the signed entries and re-simulate in enforce mode: signature checks
//    change the resource footprint, so the fee must be computed on the final payload.
const signedOp = xdr.Operation.fromXDR(call.toXDR());
signedOp.body().invokeHostFunctionOp().auth(auth);
const prepared = await server.prepareTransaction(await build(signedOp));
prepared.sign(farmer);

const sent = await server.sendTransaction(prepared);
if (sent.status === "ERROR") throw new Error(`rejected: ${JSON.stringify(sent.errorResult)}`);
let res = await server.getTransaction(sent.hash);
for (let i = 0; res.status === rpc.Api.GetTransactionStatus.NOT_FOUND && i < 30; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  res = await server.getTransaction(sent.hash);
}
if (res.status !== rpc.Api.GetTransactionStatus.SUCCESS) throw new Error(`transaction ${sent.hash}: ${res.status}`);
console.log(`${config.explorer_tx}${sent.hash}`);
