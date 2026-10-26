// Prepares demo wallets so anyone can try the full flow without installing a wallet: pairs
// of buyer and farmer test accounts with test USDC, the farmers onboarded in the pool, one
// funded trade per pair ready for an advance, and investors with USDC for the pool.
//
//   node scripts/demo-wallets.mjs testnet --out <dir> [--count 6] [--investors 3] [--app https://…]
//
// Running it again tops the accounts up and replaces any trade that was used, so the same
// links keep working all week. Keys stay in the stellar CLI keystore (avocate-<net>-demo-*);
// the links, which carry them, are written only to <dir>, outside the repo: demo-links.json,
// and demo-wallets.env with the DEMO_WALLETS value the app's /api/demo/wallet route reads.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Asset, BASE_FEE, Horizon, Keypair, Operation, TransactionBuilder, contract } from "@stellar/stellar-sdk";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i > 0 ? args[i + 1] : fallback;
};
const NETWORK = args[0];
const OUT = flag("--out", null);
const COUNT = Number(flag("--count", 6));
const INVESTORS = Number(flag("--investors", 3));
const APP = flag("--app", "https://avocate-harvest-escrow.vercel.app").replace(/\/$/, "");
if (!NETWORK || !OUT) {
  console.error("usage: node scripts/demo-wallets.mjs <network> --out <dir> [--count 6] [--app <url>]");
  process.exit(1);
}
if (resolve(OUT).startsWith(resolve(ROOT) + "/")) {
  console.error("--out must be outside the repository: the links contain secret keys.");
  process.exit(1);
}

const config = JSON.parse(readFileSync(join(ROOT, `deploy/networks/${NETWORK}.json`), "utf8"));
const deployment = JSON.parse(readFileSync(join(ROOT, `deploy/deployments/${NETWORK}.json`), "utf8"));
if (!config.friendbot_url) {
  console.error(`${NETWORK} has no friendbot: demo wallets are for test networks only.`);
  process.exit(1);
}
const passphrase = config.network_passphrase;
const horizon = new Horizon.Server(config.horizon_url);
const [code, issuer] = config.usdc.asset.split(":");
const { platform, pool } = deployment.contracts;
const XLM = config.xlm.contract;
const USDC = config.usdc.contract;

const usdc = (n) => BigInt(Math.round(n * 1e7));
const now = () => BigInt(Math.floor(Date.now() / 1000));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// What each pair gets: the buyer can fund the prepared trade and still open another one.
const BUYER_USDC = usdc(15);
const FARMER_USDC = usdc(3);
const FARMER_LIMIT = usdc(20);
const INVESTOR_USDC = usdc(20);
const TRADE_PRICE = usdc(5);
const TRADE_DAYS = 10n;

function identity(name) {
  const full = `avocate-${NETWORK}-${name}`;
  try {
    execFileSync("stellar", ["keys", "address", full], { stdio: "pipe" });
  } catch {
    execFileSync("stellar", ["keys", "generate", full], { stdio: "pipe" });
  }
  return Keypair.fromSecret(execFileSync("stellar", ["keys", "show", full], { stdio: "pipe" }).toString().trim());
}

async function funded(kp) {
  try {
    return await horizon.loadAccount(kp.publicKey());
  } catch {
    for (let attempt = 1; attempt <= 5; attempt++) {
      if ((await fetch(`${config.friendbot_url}/?addr=${kp.publicKey()}`)).ok) return horizon.loadAccount(kp.publicKey());
      await sleep(attempt * 3000);
    }
    throw new Error(`friendbot did not fund ${kp.publicKey()}`);
  }
}

async function trustUsdc(kp) {
  const account = await funded(kp);
  if (account.balances.some((b) => b.asset_code === code && b.asset_issuer === issuer)) return;
  const tx = new TransactionBuilder(account, { fee: String(Number(BASE_FEE) * 10), networkPassphrase: passphrase })
    .addOperation(Operation.changeTrust({ asset: new Asset(code, issuer) }))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  await horizon.submitTransaction(tx);
}

const signer = (kp) => contract.basicNodeSigner(kp, passphrase);

async function call(contractId, source, method, params = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const c = await contract.Client.from({ contractId, rpcUrl: config.rpc_url, networkPassphrase: passphrase, publicKey: source.publicKey() });
      const assembled = await c[method](params);
      if (assembled.isReadCall) return assembled.result;
      const sent = await assembled.signAndSend({ signTransaction: signer(source).signTransaction });
      return typeof sent.result?.unwrap === "function" ? sent.result.unwrap() : sent.result;
    } catch (e) {
      if (attempt >= 2 || !/txBadSeq|TRY_AGAIN_LATER|timeout|NOT_FOUND|ECONNRESET/i.test(String(e?.message ?? e))) throw e;
      await sleep(4000);
    }
  }
}

const variant = (v) => (typeof v === "string" ? v : v?.tag);

// Buys exactly the USDC still missing with the account's own XLM, through Soroswap.
async function topUpUsdc(kp, target) {
  const have = await call(USDC, kp, "balance", { id: kp.publicKey() });
  if (have >= target) return 0n;
  const missing = target - have;
  const path = [XLM, USDC];
  const quote = (await call(config.soroswap.router, kp, "router_get_amounts_in", { amount_out: missing, path })).unwrap()[0];
  await call(config.soroswap.router, kp, "swap_tokens_for_exact_tokens", {
    amount_out: missing,
    amount_in_max: quote + quote / 50n,
    path,
    to: kp.publicKey(),
    deadline: now() + 300n,
  });
  return missing;
}

// A pair is ready when the farmer has a funded trade from its buyer that can still take an
// advance for at least a day.
async function readyTrade(buyer, farmer, registry) {
  for (const id of registry) {
    const cfg = await call(id, buyer, "config");
    if (cfg.buyer !== buyer.publicKey() || cfg.seller !== farmer.publicKey()) continue;
    if (variant(await call(id, buyer, "state")) !== "Funded") continue;
    if ((await call(id, buyer, "advance")) || (await call(id, buyer, "validation"))) continue;
    if (BigInt(cfg.deadline) > now() + 86_400n) return id;
  }
  return null;
}

const admin = identity("admin");
const links = [];
const registry = await call(platform, admin, "escrows", { start: 0, limit: 200 });

for (let n = 1; n <= COUNT; n++) {
  const buyer = identity(`demo-buyer-${n}`);
  const farmer = identity(`demo-farmer-${n}`);
  console.log(`== pair ${n}`);
  await trustUsdc(buyer);
  await trustUsdc(farmer);
  const boughtB = await topUpUsdc(buyer, BUYER_USDC);
  const boughtF = await topUpUsdc(farmer, FARMER_USDC);
  if (boughtB || boughtF) console.log(`   topped up with Soroswap`);

  if (!(await call(pool, admin, "farmer_limit", { farmer: farmer.publicKey() }))) {
    await call(pool, admin, "onboard", { farmer: farmer.publicKey(), limit: FARMER_LIMIT });
    console.log(`   farmer onboarded in the pool`);
  }

  let trade = await readyTrade(buyer, farmer, registry);
  if (!trade) {
    trade = await call(platform, buyer, "create_escrow", {
      buyer: buyer.publicKey(),
      seller: farmer.publicKey(),
      amount: TRADE_PRICE,
      deadline: now() + TRADE_DAYS * 86_400n,
    });
    await call(trade, buyer, "fund");
    // The buyer may have spent the margin on the fee; keep them able to open another trade.
    await topUpUsdc(buyer, BUYER_USDC);
    console.log(`   new trade ready for an advance: ${trade}`);
  } else {
    console.log(`   trade still ready: ${trade}`);
  }

  for (const [role, kp] of [["buyer", buyer], ["farmer", farmer]]) {
    links.push({ pair: n, role, address: kp.publicKey(), trade, link: `${APP}/demo#role=${role}&k=${kp.secret()}` });
  }
}

for (let n = 1; n <= INVESTORS; n++) {
  const investor = identity(`demo-investor-${n}`);
  console.log(`== investor ${n}`);
  await trustUsdc(investor);
  if (await topUpUsdc(investor, INVESTOR_USDC)) console.log(`   topped up with Soroswap`);
  links.push({ pair: null, role: "pool", address: investor.publicKey(), trade: null, link: `${APP}/demo#role=pool&k=${investor.secret()}` });
}

// One JSON value for the hosting provider: role -> secrets. The secrets are read back from
// the links rather than kept in a second list.
const wallets = { buyer: [], farmer: [], pool: [] };
for (const l of links) wallets[l.role].push(new URL(l.link).hash.split("k=")[1]);

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "demo-links.json"), JSON.stringify(links, null, 2) + "\n", { mode: 0o600 });
writeFileSync(join(OUT, "demo-wallets.env"), `DEMO_WALLETS=${JSON.stringify(wallets)}\n`, { mode: 0o600 });
console.log(`== ${links.length} demo wallets written to ${OUT} (demo-links.json, demo-wallets.env)`);
