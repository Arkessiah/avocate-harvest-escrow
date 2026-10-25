import { network } from "@/lib/network";
import { HttpError, contractId, readJson } from "@/lib/server/guard";
import { escrowView, requireAvocateEscrow, serviceKey, serviceRoute } from "@/lib/server/service";
import { settleOne } from "@/lib/server/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

// The agent settles a trade on the buyer's behalf. Exposing this publicly is safe by
// design: the contract only lets the agent trigger the payout agreed at creation, and only
// after a conforming validation. The checks below just turn those rejections into clear
// errors before any fee is spent; then the agent buys the delivery check over x402 and
// releases only if it matches the chain, exactly as in an autonomous run.
export const POST = serviceRoute("agent", async (req) => {
  const escrowId = contractId((await readJson(req)).escrowId);
  const agent = serviceKey("AGENT_SECRET");

  await requireAvocateEscrow(escrowId);
  const view = await escrowView(escrowId);
  if (view.agent !== agent.publicKey()) throw new HttpError(409, "This trade names a different agent");
  if (view.state !== "Funded") throw new HttpError(409, `Trade is ${view.state}, not Funded`);
  if (!view.validation?.ok) throw new HttpError(409, "No conforming validation yet");

  const step = await settleOne(escrowId);
  if (step.outcome !== "released" || !step.releaseTx) throw new HttpError(502, step.reason);
  return { hash: step.releaseTx, paymentTx: step.paymentTx, explorer: `${network.explorerTx}${step.releaseTx}` };
});
