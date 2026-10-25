"use client";

import { useState } from "react";
import { network } from "@/lib/network";
import { short } from "@/lib/format";

interface Step {
  escrow: string;
  amount: string;
  outcome: "released" | "skipped" | "failed";
  reason: string;
  paymentTx?: string;
  releaseTx?: string;
}

const BADGE: Record<Step["outcome"], string> = {
  released: "bg-released-tint text-released",
  skipped: "bg-pending-tint text-pending",
  failed: "bg-danger-tint text-danger-strong",
};

const Tx = ({ label, hash }: { label: string; hash?: string }) =>
  hash ? (
    <a href={`${network.explorerTx}${hash}`} target="_blank" rel="noreferrer" className="text-brand-dark hover:underline">
      {label} {short(hash, 4)} ↗
    </a>
  ) : null;

export function AgentRun({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ready: number; steps: Step[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `The agent answered ${res.status}`);
      setResult(data);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The agent could not run");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="card mb-6 p-6">
      <h2 className="text-lg font-semibold">Autonomous agent</h2>
      <p className="mt-1 text-sm text-ink/70">
        For each trade ready to settle, the agent buys the validator's delivery check for 0.01 USDC over x402, compares it
        with what the chain records, and only then releases the payment to the farmer.
      </p>
      <button className="btn-brand mt-4" onClick={run} disabled={running} aria-busy={running}>
        {running ? "Running: paying for checks and settling…" : "Run the agent"}
      </button>
      {error && <p className="mt-3 rounded-xl border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      {result && (
        <div className="mt-4" aria-live="polite">
          <p className="text-sm text-ink/70">
            {result.ready === 0
              ? "No trades were ready to settle."
              : `${result.ready} trade${result.ready === 1 ? "" : "s"} ready; ${result.steps.length} handled in this run.`}
          </p>
          <ul className="mt-2 divide-y divide-ink/5">
            {result.steps.map((s) => (
              <li key={s.escrow} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[s.outcome]}`}>{s.outcome}</span>
                  <span className="font-semibold">{s.amount}</span>
                  <span className="font-mono text-xs text-ink/70">{short(s.escrow, 4)}</span>
                </div>
                <p className="mt-1 text-ink/70">{s.reason}</p>
                <p className="mt-1 flex flex-wrap gap-x-4 text-xs">
                  <Tx label="x402 payment" hash={s.paymentTx} />
                  <Tx label="Release" hash={s.releaseTx} />
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
