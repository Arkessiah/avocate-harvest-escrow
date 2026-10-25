import { Keypair, contract } from "@stellar/stellar-sdk";
import { network } from "@/lib/network";
import { HttpError, RateLimiter, clientIp, describeContractError } from "@/lib/server/guard";

// Server-only: signs with the service accounts (agent, validator). Secrets come from the
// environment and never reach the browser.

const SUBMIT_TIMEOUT_S = 30; // below the routes' maxDuration, so polling never gets cut off

export function serviceKey(envName: string): Keypair {
  const secret = process.env[envName];
  if (!secret) throw new HttpError(500, `${envName} is not configured`);
  return Keypair.fromSecret(secret);
}

function client(contractId: string, signer?: Keypair): Promise<contract.Client> {
  return contract.Client.from({
    contractId,
    rpcUrl: network.rpcUrl,
    networkPassphrase: network.passphrase,
    publicKey: signer?.publicKey(),
    ...(signer ? contract.basicNodeSigner(signer, network.passphrase) : {}),
  });
}

type Call = (args?: Record<string, unknown>, opts?: { timeoutInSeconds?: number }) => Promise<{
  result: unknown;
  signAndSend: () => Promise<{ sendTransactionResponse?: { hash: string } }>;
}>;
const method = (c: contract.Client, name: string) => (c as unknown as Record<string, Call>)[name];

// Unit enum variants decode as a string, a one-element array or `{ tag }` depending on how
// they were read; callers only ever need the variant name.
export function variant(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return String(value[0]);
  if (value && typeof value === "object" && "tag" in value) return String((value as { tag: unknown }).tag);
  return String(value);
}

export interface EscrowView {
  agent: string;
  validator: string;
  state: string;
  validation: { ok: boolean } | null;
}

/** Rejects anything that is not an escrow deployed by our platform. */
export async function requireAvocateEscrow(escrowId: string): Promise<void> {
  const platform = await client(network.contracts.platform);
  const { result } = await method(platform, "is_escrow")({ escrow: escrowId });
  if (result !== true) throw new HttpError(403, "Not an Avocate trade");
}

export async function escrowView(escrowId: string): Promise<EscrowView> {
  const escrow = await client(escrowId);
  const [config, state, validation] = await Promise.all([
    method(escrow, "config")(),
    method(escrow, "state")(),
    method(escrow, "validation")(),
  ]);
  const c = config.result as { agent: string; validator: string };
  const v = validation.result as { ok: boolean } | undefined | null;
  return { agent: c.agent, validator: c.validator, state: variant(state.result), validation: v ?? null };
}

/** Signs and submits `name` on the escrow as `signer`; returns the transaction hash. */
export async function submit(escrowId: string, signer: Keypair, name: string, args: Record<string, unknown> = {}): Promise<string> {
  try {
    const escrow = await client(escrowId, signer);
    const tx = await method(escrow, name)(args, { timeoutInSeconds: SUBMIT_TIMEOUT_S });
    const sent = await tx.signAndSend();
    const hash = sent.sendTransactionResponse?.hash;
    if (!hash) throw new Error("No transaction hash returned");
    return hash;
  } catch (e) {
    throw new HttpError(502, describeContractError(e instanceof Error ? e.message : String(e)));
  }
}

const limiter = new RateLimiter(10, 10 * 60 * 1000);

/** Shared wrapper: throttling, JSON errors, and no stack traces leaking to the client. */
export function serviceRoute(scope: string, handler: (req: Request) => Promise<Record<string, unknown>>) {
  return async (req: Request): Promise<Response> => {
    try {
      const retryAfter = limiter.check(`${scope}:${clientIp(req.headers)}`);
      if (retryAfter !== null) {
        throw new HttpError(429, "Too many requests", { "Retry-After": String(retryAfter) });
      }
      return Response.json(await handler(req));
    } catch (e) {
      const err = e instanceof HttpError ? e : new HttpError(500, "Unexpected error");
      if (!(e instanceof HttpError)) console.error(`[${scope}]`, e);
      return Response.json({ error: err.message }, { status: err.status, headers: err.headers });
    }
  };
}
