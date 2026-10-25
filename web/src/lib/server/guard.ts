import { StrKey } from "@stellar/stellar-sdk";

// Framework-free request checks for the service routes, kept pure so they can be unit
// tested with node:test.

export const MAX_BODY_BYTES = 2_048;

export class HttpError extends Error {
  readonly status: number;
  readonly headers: Record<string, string>;

  constructor(status: number, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

// Per-instance memory: on serverless each instance keeps its own counters, so this is
// best-effort throttling, not a global limit. It stops a script hammering the service
// signers; a hard guarantee would need a shared store.
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly max: number;
  private readonly windowMs: number;

  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
  }

  /** Seconds to wait if `key` is over the limit, otherwise null (and the hit is counted). */
  check(key: string, now = Date.now()): number | null {
    // Purge on every pass, otherwise the limiter itself leaks memory.
    for (const [k, ts] of this.hits) {
      const live = ts.filter((t) => now - t < this.windowMs);
      if (live.length) this.hits.set(k, live);
      else this.hits.delete(k);
    }
    const recent = this.hits.get(key) ?? [];
    if (recent.length >= this.max) return Math.ceil((recent[0] + this.windowMs - now) / 1000);
    this.hits.set(key, [...recent, now]);
    return null;
  }
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}

// Size is checked on the declared length and again on the bytes actually read, so a
// missing or lying content-length cannot get a large body parsed.
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    throw new HttpError(413, "Payload too large");
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) throw new HttpError(413, "Payload too large");
  try {
    const body = JSON.parse(raw);
    if (body === null || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Body must be a JSON object");
  }
}

export function contractId(value: unknown, field = "escrowId"): string {
  if (typeof value !== "string" || !StrKey.isValidContract(value)) {
    throw new HttpError(400, `${field} must be a contract address (C...)`);
  }
  return value;
}

// Mirrors `enum Error` in contract/contracts/escrow/src/lib.rs (discriminant = index + 1).
const ESCROW_ERRORS = [
  "InvalidState",
  "NotExpired",
  "InvalidAmount",
  "InvalidFee",
  "InvalidDeadline",
  "AlreadyValidated",
  "NotValidated",
  "AlreadyAdvanced",
  "AdvanceTooLarge",
];

// Simulation failures carry the whole diagnostic log; callers only need the error name.
export function describeContractError(raw: string): string {
  const code = /Error\(Contract, #(\d+)\)/.exec(raw)?.[1];
  if (!code) return raw.split("\n")[0].slice(0, 200);
  return `Contract rejected the call: ${ESCROW_ERRORS[Number(code) - 1] ?? `#${code}`}`;
}
