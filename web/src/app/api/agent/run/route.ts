import { serviceRoute } from "@/lib/server/service";
import { runAgent } from "@/lib/server/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

// Runs the autonomous agent once. Safe to expose for the same reason as the release route:
// whatever it does is bounded by the contracts, and every release is preceded by a paid
// check that has to agree with the chain.
export const POST = serviceRoute("agent-run", async () => ({ ...(await runAgent()) }));
