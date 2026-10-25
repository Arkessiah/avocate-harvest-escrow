// Fills a network with sample activity so every screen has something real to show: trades
// in every state, advances repaid and written off, deposits and a withdrawal in the pool,
// and payouts released by the agent after paying for the delivery check over x402.
//
//   node scripts/seed.mjs testnet [--app http://localhost:3030]
//
// Each run adds a new batch; nothing is deleted. Keys come from the stellar CLI keystore
// (identities avocate-<network>-<role>, created and funded here when missing) and stay in
// memory. The agent's releases go through the app's /api/agent/release route, so the app
// at --app must be running with AGENT_SECRET set; without it the agent signs directly and
// the x402 step is skipped, which the summary says.
//
// At the end it prints two links that are valid for one hour, for testing the QR flows by
// hand with the main buyer's wallet: a trade proposed by a farmer, and an advance request.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Operation,
  TransactionBuilder,
  contract,
  rpc,
} from "@stellar/stellar-sdk";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const NETWORK = args[0];
if (!NETWORK) {
  console.error("usage: node scripts/seed.mjs <network> [--app <url>]");
  process.exit(1);
}
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i > 0 ? args[i + 1] : fallback;
};
const APP = flag("--app", "http://localhost:3030").replace(/\/$/, "");

const config = JSON.parse(readFileSync(join(ROOT, `deploy/networks/${NETWORK}.json`), "utf8"));
const deployment = JSON.parse(readFileSync(join(ROOT, `deploy/deployments/${NETWORK}.json`), "utf8"));
if (!config.friendbot_url) {
  console.error(`${NETWORK} has no friendbot: this script is for test networks only.`);
  process.exit(1);
}
const passphrase = config.network_passphrase;
const server = new rpc.Server(config.rpc_url);
const horizon = new Horizon.Server(config.horizon_url);
const [code, issuer] = config.usdc.asset.split(":");
const USDC = new Asset(code, issuer);
const { platform, pool } = deployment.contracts;

const usdc = (n) => BigInt(Math.round(n * 1e7));
const show = (units) => `${(Number(units) / 1e7).toFixed(2)} USDC`;
const tx = (hash) => `${config.explorer_tx}${hash}`;
const now = () => BigInt(Math.floor(Date.now() / 1000));
const DAY = 86_400n;

// ---------------------------------------------------------------- accounts

const keystoreName = (role) => `avocate-${NETWORK}-${role}`;

function identity(role) {
  const name = keystoreName(role);
  try {
    execFileSync("stellar", ["keys", "address", name], { stdio: "pipe" });
  } catch {
    execFileSync("stellar", ["keys", "generate", name], { stdio: "pipe" });
  }
  const secret = execFileSync("stellar", ["keys", "show", name], { stdio: "pipe" }).toString().trim();
  return Keypair.fromSecret(secret);
}

async function account(kp) {
  try {
    return await horizon.loadAccount(kp.publicKey());
  } catch {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const res = await fetch(`${config.friendbot_url}/?addr=${kp.publicKey()}`);
      if (res.ok) return horizon.loadAccount(kp.publicKey());
      await sleep(attempt * 3000);
    }
    throw new Error(`friendbot did not fund ${kp.publicKey()}`);
  }
}

async function classic(kp, ops) {
  const source = await horizon.loadAccount(kp.publicKey());
  const builder = new TransactionBuilder(source, { fee: String(Number(BASE_FEE) * 10), networkPassphrase: passphrase });
  ops.forEach((op) => builder.addOperation(op));
  const built = builder.setTimeout(60).build();
  built.sign(kp);
  return (await horizon.submitTransaction(built)).hash;
}

const usdcBalance = (acc) =>
  usdc(Number(acc.balances.find((b) => b.asset_code === code && b.asset_issuer === issuer)?.balance ?? 0));

async function ensureUsdc(kp, wanted, from) {
  const acc = await account(kp);
  const ops = [];
  if (!acc.balances.some((b) => b.asset_code === code && b.asset_issuer === issuer)) {
    await classic(kp, [Operation.changeTrust({ asset: USDC })]);
  }
  const have = usdcBalance(await horizon.loadAccount(kp.publicKey()));
  if (have >= wanted) return;
  const missing = wanted - have;
  const pay = (Number(missing) / 1e7).toFixed(7);
  ops.push(Operation.payment({ destination: kp.publicKey(), asset: USDC, amount: pay }));
  await classic(from, ops);
}

// ---------------------------------------------------------------- contract calls

const client = (contractId, source) =>
  contract.Client.from({ contractId, rpcUrl: config.rpc_url, networkPassphrase: passphrase, publicKey: source.publicKey() });

const signer = (kp) => contract.basicNodeSigner(kp, passphrase);

// Testnet occasionally drops a submission or rejects a stale sequence; one retry clears it.
async function call(contractId, source, method, params = {}, cosigners = []) {
  for (let attempt = 1; ; attempt++) {
    try {
      const c = await client(contractId, source);
      const assembled = await c[method](params);
      for (const kp of cosigners) {
        await assembled.signAuthEntries({ address: kp.publicKey(), signAuthEntry: signer(kp).signAuthEntry });
      }
      if (assembled.isReadCall) return { result: assembled.result };
      const sent = await assembled.signAndSend({ signTransaction: signer(source).signTransaction });
      const hash = sent.sendTransactionResponse?.hash ?? sent.getTransactionResponse?.txHash;
      const result = sent.result;
      return { hash, result: typeof result?.unwrap === "function" ? result.unwrap() : result };
    } catch (e) {
      if (attempt >= 2 || !/txBadSeq|TRY_AGAIN_LATER|timeout|NOT_FOUND|ECONNRESET/i.test(String(e?.message ?? e))) throw e;
      await sleep(4000);
    }
  }
}

async function reportHash(escrow, ok) {
  const text = `${escrow}:${ok}`;
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

// ---------------------------------------------------------------- links for the QR flows

async function pack(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return Buffer.from(await new Response(stream).arrayBuffer()).toString("base64url");
}

async function expiry() {
  const { sequence } = await server.getLatestLedger();
  return sequence + 720; // about an hour of ledgers, as in the app
}

// Same hand-off the app makes: the proposer signs their authorization with the receiver as
// the transaction source, and the receiver signs and submits from the link.
async function proposeDeal(proposer, receiver, terms) {
  const c = await client(platform, receiver);
  const assembled = await c.create_trade(terms, { timeoutInSeconds: 3600 });
  await assembled.signAuthEntries({
    address: proposer.publicKey(),
    expiration: await expiry(),
    signAuthEntry: signer(proposer).signAuthEntry,
  });
  return `${APP}/deal#d=${await pack(Buffer.from(assembled.built.toXDR(), "base64"))}`;
}

async function requestAdvance(farmer, buyer, escrow, principal) {
  const c = await client(pool, buyer);
  const assembled = await c.advance({ escrow, principal }, { timeoutInSeconds: 3600 });
  await assembled.signAuthEntries({
    address: farmer.publicKey(),
    expiration: await expiry(),
    signAuthEntry: signer(farmer).signAuthEntry,
  });
  return `${APP}/buyer?trade=${escrow}#advance=${Buffer.from(assembled.toJSON()).toString("base64url")}`;
}

// ---------------------------------------------------------------- the agent

let agentViaApp = true;

async function agentRelease(escrow, agent) {
  if (agentViaApp) {
    try {
      const res = await fetch(`${APP}/api/agent/release`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ escrowId: escrow }),
      });
      const body = await res.json();
      if (res.ok) return { hash: body.hash, paid: body.paymentTx };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    } catch (e) {
      console.log(`   the app's agent route failed (${e.message}); the agent signs directly from now on`);
      agentViaApp = false;
    }
  }
  return { hash: (await call(escrow, agent, "agent_release")).hash };
}

// ---------------------------------------------------------------- run

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
const log = (label, hash) => console.log(`   ${label}${hash ? `  ${tx(hash)}` : ""}`);

async function step(name, fn) {
  console.log(`== ${name}`);
  try {
    await fn();
  } catch (e) {
    console.log(`   FAILED: ${e?.message ?? e}`);
    rows.push({ name, trade: "-", outcome: `failed: ${String(e?.message ?? e).slice(0, 80)}` });
  }
}

const admin = identity("admin");
const validator = identity("validator");
const agent = identity("agent");
const buyer = identity("buyer");
const farmer = identity("farmer");
const depositor = identity("depositor");
const buyer2 = identity("seed-buyer-1");
const buyer3 = identity("seed-buyer-2");
const farmer2 = identity("seed-farmer-1");
const farmer3 = identity("seed-farmer-2");

console.log(`== accounts on ${NETWORK}`);
for (const kp of [buyer2, buyer3, farmer2, farmer3]) await account(kp);
// The main farmer holds the test USDC and tops up the others; `buyer` keeps a margin so
// the QR flows at the end can be completed from its wallet.
await ensureUsdc(buyer, usdc(14), farmer);
await ensureUsdc(buyer2, usdc(16), farmer);
await ensureUsdc(buyer3, usdc(12), farmer);
await ensureUsdc(farmer2, 0n, farmer);
await ensureUsdc(farmer3, 0n, farmer);
await ensureUsdc(depositor, usdc(6), farmer);

for (const f of [farmer2, farmer3]) {
  const limit = (await call(pool, admin, "farmer_limit", { farmer: f.publicKey() })).result;
  if (!limit) log(`onboarded ${f.publicKey().slice(0, 6)}… in the pool`, (await call(pool, admin, "onboard", { farmer: f.publicKey(), limit: usdc(20) })).hash);
}

const create = async (b, f, amount, deadline = now() + 7n * DAY) => {
  const { hash, result } = await call(platform, b, "create_escrow", {
    buyer: b.publicKey(),
    seller: f.publicKey(),
    amount: usdc(amount),
    deadline,
  });
  log(`created ${result} (${amount} USDC)`, hash);
  return result;
};
const fund = async (b, id) => log("funded", (await call(id, b, "fund")).hash);
const validate = async (id, ok) =>
  log(ok ? "validated: conforming" : "validated: rejected", (await call(id, validator, "validate", { ok, report_hash: await reportHash(id, ok) })).hash);
const advance = async (b, f, id, amount) =>
  log(`advance of ${amount} USDC paid to the farmer`, (await call(pool, b, "advance", { escrow: id, principal: usdc(amount) }, [f])).hash);

// Created first so its short deadline runs out while the rest is seeded.
let lapsing;
// The funded trade the advance-request link is built on.
let waiting;
await step("deadline passes with no delivery: anyone triggers the refund", async () => {
  lapsing = await create(buyer3, farmer3, 2, now() + 150n);
  await fund(buyer3, lapsing);
});

await step("cancelled before funding", async () => {
  const id = await create(buyer, farmer, 2);
  log("cancelled by the farmer", (await call(id, farmer, "cancel", { by: farmer.publicKey() })).hash);
  rows.push({ name: "cancelled", trade: id, outcome: "Cancelled" });
});

await step("agreed on the spot: both parties sign create_trade", async () => {
  const { hash, result } = await call(
    platform,
    buyer2,
    "create_trade",
    { buyer: buyer2.publicKey(), seller: farmer2.publicKey(), amount: usdc(3), deadline: now() + 7n * DAY },
    [farmer2],
  );
  log(`created ${result}, signed by buyer and farmer`, hash);
  rows.push({ name: "agreed on the spot", trade: result, outcome: "Pending" });
});

await step("funded, waiting for the validator", async () => {
  const id = await create(buyer, farmer3, 4);
  await fund(buyer, id);
  rows.push({ name: "waiting for the validator", trade: id, outcome: "Funded" });
  waiting = id;
});

await step("funded for the main farmer: an advance can be requested from the farmer screen", async () => {
  const id = await create(buyer2, farmer, 4);
  await fund(buyer2, id);
  rows.push({ name: "ready for an advance", trade: id, outcome: "Funded" });
});

await step("validated, waiting for the agent", async () => {
  const id = await create(buyer3, farmer, 2.5);
  await fund(buyer3, id);
  await validate(id, true);
  rows.push({ name: "ready for the agent", trade: id, outcome: "Funded, conforming" });
});

await step("buyer confirms delivery and pays the farmer", async () => {
  const id = await create(buyer2, farmer, 5);
  await fund(buyer2, id);
  log("buyer confirmed delivery", (await call(id, buyer2, "confirm_delivery")).hash);
  rows.push({ name: "paid by the buyer", trade: id, outcome: "Released" });
});

await step("validator approves, the agent pays over x402 and releases", async () => {
  const id = await create(buyer3, farmer2, 3);
  await fund(buyer3, id);
  await validate(id, true);
  const out = await agentRelease(id, agent);
  if (out.paid) log("agent paid for the delivery check over x402", out.paid);
  log("agent released the payment", out.hash);
  rows.push({ name: "released by the agent", trade: id, outcome: out.paid ? "Released (x402)" : "Released" });
});

await step("delivery rejected: the buyer gets the money back", async () => {
  const id = await create(buyer, farmer3, 2);
  await fund(buyer, id);
  await validate(id, false);
  log("buyer refunded", (await call(id, buyer, "refund")).hash);
  rows.push({ name: "rejected and refunded", trade: id, outcome: "Refunded" });
});

await step("advance repaid: the agent settles and the pool earns its yield", async () => {
  const id = await create(buyer2, farmer2, 5);
  await fund(buyer2, id);
  await advance(buyer2, farmer2, id, 3);
  await validate(id, true);
  const out = await agentRelease(id, agent);
  if (out.paid) log("agent paid for the delivery check over x402", out.paid);
  log("agent released: pool repaid first, the rest to the farmer", out.hash);
  rows.push({ name: "advance repaid", trade: id, outcome: "Released, pool repaid" });
});

await step("advance written off: delivery rejected after an advance", async () => {
  const id = await create(buyer, farmer, 3);
  await fund(buyer, id);
  await advance(buyer, farmer, id, 2);
  await validate(id, false);
  log("buyer refunded in full; the pool books the loss", (await call(id, buyer, "refund")).hash);
  rows.push({ name: "advance written off", trade: id, outcome: "Refunded, pool loss" });
});

await step("pool: two deposits and a withdrawal", async () => {
  const d = (kp, n) => call(pool, kp, "deposit", { assets: usdc(n), receiver: kp.publicKey(), from: kp.publicKey(), operator: kp.publicKey() });
  log("depositor added 5 USDC", (await d(depositor, 5)).hash);
  log("a buyer invested 3 USDC", (await d(buyer3, 3)).hash);
  const w = await call(pool, buyer3, "withdraw", {
    assets: usdc(1),
    receiver: buyer3.publicKey(),
    owner: buyer3.publicKey(),
    operator: buyer3.publicKey(),
  });
  log("and withdrew 1 USDC", w.hash);
});

await step("deadline refund", async () => {
  if (!lapsing) throw new Error("the lapsing trade was not created");
  const deadline = BigInt((await call(lapsing, admin, "config")).result.deadline);
  const wait = Number(deadline - now()) + 15;
  if (wait > 0) {
    console.log(`   waiting ${wait} s for the deadline`);
    await sleep(wait * 1000);
  }
  log("refund triggered by a third party; the buyer is repaid", (await call(lapsing, admin, "refund")).hash);
  rows.push({ name: "refunded at the deadline", trade: lapsing, outcome: "Refunded" });
});

const links = {};
await step("links for testing the QR flows by hand (valid for one hour)", async () => {
  links.deal = await proposeDeal(farmer2, buyer, {
    buyer: buyer.publicKey(),
    seller: farmer2.publicKey(),
    amount: usdc(2),
    deadline: now() + 7n * DAY,
  });
  if (waiting) links.advance = await requestAdvance(farmer3, buyer, waiting, usdc(2));
});

console.log("\n== summary");
for (const r of rows) console.log(`   ${r.outcome.padEnd(24)} ${r.trade}  ${r.name}`);
if (!agentViaApp) console.log("   note: the agent signed directly, without the x402 payment (the app was not reachable)");
console.log(`\n== for ${buyer.publicKey()} (the main buyer's wallet)`);
if (links.deal) console.log(`   trade proposal: ${links.deal}`);
if (links.advance) console.log(`   advance request: ${links.advance}`);
