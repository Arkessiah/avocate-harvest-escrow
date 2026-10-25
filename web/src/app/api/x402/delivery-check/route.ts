import { readTrade } from "@/lib/trade";
import { toHex } from "@/lib/report";
import { HttpError, RateLimiter, clientIp, contractId } from "@/lib/server/guard";
import { requireAvocateEscrow } from "@/lib/server/service";
import { adapterFor, deliveryCheckServer } from "@/lib/server/x402";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const limiter = new RateLimiter(60, 10 * 60 * 1000);

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body ?? {}, { status, headers });

// Paid API sold by the validator. Without a valid x402 payment it answers 402 with the
// price; with one, it reads the verdict from the chain, settles the payment and returns it.
// Unknown or foreign contracts are refused before any payment is asked for.
export async function GET(req: Request): Promise<Response> {
  try {
    const retryAfter = limiter.check(`x402:${clientIp(req.headers)}`);
    if (retryAfter !== null) throw new HttpError(429, "Too many requests", { "Retry-After": String(retryAfter) });

    const escrowId = contractId(new URL(req.url).searchParams.get("escrow"), "escrow");
    await requireAvocateEscrow(escrowId);

    const server = await deliveryCheckServer();
    const url = new URL(req.url);
    const result = await server.processHTTPRequest({ adapter: adapterFor(req), path: url.pathname, method: req.method });
    if (result.type === "payment-error") {
      return json(result.response.body, result.response.status, result.response.headers);
    }
    if (result.type !== "payment-verified") throw new HttpError(500, "Route is not priced");

    const trade = await readTrade(escrowId, true);
    const check = {
      escrow: escrowId,
      state: trade.state,
      delivery: !trade.validation ? "pending" : trade.validation.ok ? "conforming" : "rejected",
      reportHash: trade.validation ? toHex(trade.validation.report_hash) : null,
      validator: trade.config.validator,
      checkedAt: new Date().toISOString(),
    };

    const settled = await server.processSettlement(result.paymentPayload, result.paymentRequirements, result.declaredExtensions);
    if (!settled.success) return json(settled.response.body, settled.response.status, settled.response.headers);
    return json(check, 200, settled.headers);
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(502, "Delivery check unavailable");
    if (!(e instanceof HttpError)) console.error("[x402]", e);
    return json({ error: err.message }, err.status, err.headers);
  }
}
