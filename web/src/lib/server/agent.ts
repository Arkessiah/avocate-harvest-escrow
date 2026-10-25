import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import type { PaymentRequirements } from "@x402/core/types";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { listTrades } from "@/lib/registry";
import { toHex } from "@/lib/report";
import { formatUsdc } from "@/lib/usdc";
import { serviceKey, submit } from "@/lib/server/service";
import { CHECK_PATH, X402_NETWORK } from "@/lib/server/x402";
import { network } from "@/lib/network";
import { SITE_URL } from "@/lib/site";

export interface AgentStep {
  escrow: string;
  amount: string;
  outcome: "released" | "skipped" | "failed";
  reason: string;
  paymentTx?: string;
  releaseTx?: string;
}

// Each trade costs one paid check and one release, a few seconds each; capping the batch
// keeps a run well inside the route's time limit. Later runs pick up the rest.
const MAX_PER_RUN = 3;

// Where the agent buys checks: a fixed, configured address. Deriving it from the incoming
// request would let a forged Host header send the agent's payments to someone else.
const CHECK_URL = `${process.env.AGENT_CHECK_BASE_URL ?? SITE_URL}${CHECK_PATH}`;
const MAX_CHECK_UNITS = 100_000n; // 0.01 USDC

// Spend policy: whatever a server asks for, the agent only pays our validator, in USDC on
// this network, at most the published price per check.
const onlyOurValidator = (_v: number, options: PaymentRequirements[]) =>
  options.filter(
    (o) =>
      o.payTo === network.accounts.validator &&
      o.network === X402_NETWORK &&
      o.asset === network.usdc.contract &&
      BigInt(o.amount) <= MAX_CHECK_UNITS,
  );

// The agent settles a validated trade only after buying the validator's delivery check
// over x402 and finding that it matches what the chain records. Its on-chain power is
// unchanged: it can only trigger the payout fixed when the trade was created.
export async function runAgent(): Promise<{ ready: number; steps: AgentStep[] }> {
  const agent = serviceKey("AGENT_SECRET");
  const ready = (await listTrades()).filter(
    (t) => t.state === "Funded" && t.validation?.ok === true && t.config.agent === agent.publicKey(),
  );
  const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: X402_NETWORK, client: new ExactStellarScheme(createEd25519Signer(agent.secret(), X402_NETWORK)) }],
    policies: [onlyOurValidator],
  });

  const steps: AgentStep[] = [];
  for (const trade of ready.slice(0, MAX_PER_RUN)) {
    const step: AgentStep = { escrow: trade.id, amount: formatUsdc(trade.config.amount), outcome: "failed", reason: "" };
    steps.push(step);
    try {
      const res = await paidFetch(`${CHECK_URL}?escrow=${trade.id}`);
      const receipt = res.headers.get("PAYMENT-RESPONSE") ?? res.headers.get("X-PAYMENT-RESPONSE");
      if (receipt) step.paymentTx = decodePaymentResponseHeader(receipt).transaction;
      if (!res.ok) {
        step.reason = `Delivery check failed (${res.status})`;
        continue;
      }
      const check = (await res.json()) as { state?: string; delivery?: string; reportHash?: string | null };
      const onChain = toHex(trade.validation!.report_hash);
      if (check.delivery !== "conforming" || check.state !== "Funded" || check.reportHash !== onChain) {
        step.outcome = "skipped";
        step.reason = "The paid check does not match the chain; nothing released";
        continue;
      }
      step.releaseTx = await submit(trade.id, agent, "agent_release");
      step.outcome = "released";
      step.reason = "Check paid and matched the chain; payment released to the farmer";
    } catch (e) {
      step.reason = e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : "Unexpected error";
    }
  }
  return { ready: ready.length, steps };
}
