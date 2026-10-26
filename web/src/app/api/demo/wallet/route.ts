import { Networks, Keypair, StrKey } from "@stellar/stellar-sdk";
import { network } from "@/lib/network";
import { HttpError, readJson } from "@/lib/server/guard";
import { serviceRoute } from "@/lib/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DEMO ONLY. Hands out prepared testnet accounts so anyone can try a role without a wallet
// (see scripts/demo-wallets.mjs). They hold test assets with no value; the secrets live in
// the DEMO_WALLETS environment variable, never in the repository, and the route refuses to
// run on the public network.
type Pool = Record<"buyer" | "farmer" | "pool", string[]>;

function wallets(): Pool {
  if (network.passphrase === Networks.PUBLIC) throw new HttpError(404, "Demo wallets are not available");
  const raw = process.env.DEMO_WALLETS;
  if (!raw) throw new HttpError(404, "Demo wallets are not available");
  let parsed: Partial<Pool>;
  try {
    parsed = JSON.parse(raw) as Partial<Pool>;
  } catch {
    throw new HttpError(404, "Demo wallets are not available");
  }
  const valid = (list?: string[]) => (list ?? []).filter((s) => StrKey.isValidEd25519SecretSeed(s));
  return { buyer: valid(parsed.buyer), farmer: valid(parsed.farmer), pool: valid(parsed.pool) };
}

// { role } picks one of that role's accounts; { address } returns that demo account, so a
// demo farmer's request can be completed by the demo buyer of the same trade.
export const POST = serviceRoute("demo", async (req) => {
  const body = await readJson(req);
  const pool = wallets();
  if (typeof body.address === "string") {
    for (const [role, list] of Object.entries(pool)) {
      const secret = list.find((s) => Keypair.fromSecret(s).publicKey() === body.address);
      if (secret) return { role, address: body.address, secret };
    }
    throw new HttpError(404, "That account is not a demo wallet");
  }
  const role = body.role;
  if (role !== "buyer" && role !== "farmer" && role !== "pool") throw new HttpError(400, "role must be buyer, farmer or pool");
  const list = pool[role];
  if (list.length === 0) throw new HttpError(404, "No demo wallets for this role");
  const secret = list[Math.floor(Math.random() * list.length)];
  return { role, address: Keypair.fromSecret(secret).publicKey(), secret };
});
