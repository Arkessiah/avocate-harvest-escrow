"use client";

import { useState } from "react";
import { useTx } from "@/components/TxProvider";
import { AgentRun } from "@/components/AgentRun";
import { TradeWorkspace, type ActionsProps } from "@/components/TradeWorkspace";
import { callService } from "@/lib/services";
import { bps, formatUsdc } from "@/lib/usdc";
import { owedNow, type Trade } from "@/lib/trade";

const ready = { label: "Ready to release", test: (t: Trade) => t.state === "Funded" && t.validation?.ok === true };

export function AgentView() {
  const [version, setVersion] = useState(0);
  return (
    <>
      <div className="mx-auto max-w-3xl">
        <AgentRun onDone={() => setVersion((v) => v + 1)} />
      </div>
      <TradeWorkspace key={version} focus={ready} Actions={AgentActions} />
    </>
  );
}

function AgentActions({ trade, onDone }: ActionsProps) {
  const run = useTx();
  const { config, state, validation, advance } = trade;

  if (state !== "Funded") return <p className="text-sm text-ink/70">This trade is closed.</p>;
  if (!validation) return <p className="text-sm text-ink/70">Waiting for the validator. The agent can only act after a conforming verdict.</p>;
  if (!validation.ok) return <p className="text-sm text-ink/70">The delivery was rejected, so the agent cannot pay it. The buyer can take the deposit back.</p>;

  const toFarmer = config.amount - (advance ? owedNow(trade) + bps(advance.principal, config.financing_fee_bps) : 0n);

  async function release() {
    const out = await run({
      title: "Agent releases the payment",
      detail: `${formatUsdc(toFarmer)} to the farmer`,
      kind: "escrow",
      trade: trade.id,
      wallet: false,
      execute: (_s, onStep) => callService("/api/agent/release", { escrowId: trade.id }, onStep),
    });
    if (out) onDone();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/70">
        The validator confirmed the delivery. The agent can settle now on the buyer's behalf: the farmer receives{" "}
        {formatUsdc(toFarmer)}
        {advance && ", after the pool is repaid"}. First it pays 0.01 USDC over x402 for the validator's delivery check
        and compares it with the chain. It can only trigger this payout, fixed when the trade was created.
      </p>
      <button className="btn-brand w-full" onClick={release}>
        Release payment
      </button>
    </div>
  );
}
