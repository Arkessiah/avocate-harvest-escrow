import { network } from "@/lib/network";
import { MAX_REPORT, reportHash, toHex } from "@/lib/report";
import { HttpError, contractId, readJson } from "@/lib/server/guard";
import { escrowView, requireAvocateEscrow, serviceKey, serviceRoute, submit } from "@/lib/server/service";

export const runtime = "nodejs";
export const maxDuration = 60;

// DEMO ONLY. A real validator is an independent inspector who signs with their own wallet
// from the validator screen. A public route signing as the validator would let anyone
// approve or reject any trade, so it stays off unless DEMO_VALIDATOR=true, which lets
// judges walk through a trade without an inspector's keys.
export const POST = serviceRoute("validator", async (req) => {
  if (process.env.DEMO_VALIDATOR !== "true") throw new HttpError(404, "Demo validator is disabled");

  const body = await readJson(req);
  const escrowId = contractId(body.escrowId);
  if (typeof body.ok !== "boolean") throw new HttpError(400, "ok must be a boolean");
  const report = body.report ?? "";
  if (typeof report !== "string" || report.length > MAX_REPORT) {
    throw new HttpError(400, `report must be a string of at most ${MAX_REPORT} characters`);
  }
  const validator = serviceKey("VALIDATOR_SECRET");

  await requireAvocateEscrow(escrowId);
  const view = await escrowView(escrowId);
  if (view.validator !== validator.publicKey()) throw new HttpError(409, "This trade names a different validator");
  if (view.state !== "Funded") throw new HttpError(409, `Trade is ${view.state}, not Funded`);
  if (view.validation) throw new HttpError(409, "This trade has already been validated");

  const digest = await reportHash(report, escrowId, body.ok);
  const hash = await submit(escrowId, validator, "validate", { ok: body.ok, report_hash: Buffer.from(digest) });
  return { hash, explorer: `${network.explorerTx}${hash}`, reportHash: toHex(digest) };
});
