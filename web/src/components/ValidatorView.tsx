"use client";

import { useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { useTx } from "@/components/TxProvider";
import { TradeWorkspace, type ActionsProps } from "@/components/TradeWorkspace";
import { MAX_REPORT, reportHash, toHex } from "@/lib/report";
import { callService } from "@/lib/services";
import { short } from "@/lib/format";
import type { Trade } from "@/lib/trade";

const toValidate = { label: "To validate", test: (t: Trade) => t.state === "Funded" && !t.validation };

export function ValidatorView() {
  return <TradeWorkspace focus={toValidate} Actions={ValidatorActions} />;
}

function ValidatorActions({ trade, onDone }: ActionsProps) {
  const { address } = useWallet();
  const run = useTx();
  const [report, setReport] = useState("");
  const { config, state, validation } = trade;

  if (validation) {
    return (
      <div className="space-y-1 text-sm">
        <p className="font-medium">
          Verdict recorded: {validation.ok ? "the delivery conforms." : "the delivery was rejected."}
        </p>
        <p className="font-mono text-xs break-all text-ink/70">Report hash {toHex(validation.report_hash)}</p>
        <p className="text-ink/70">A verdict can be recorded only once and cannot be changed.</p>
      </div>
    );
  }
  if (state !== "Funded") {
    return <p className="text-sm text-ink/70">Only a funded trade can be validated.</p>;
  }

  const isValidator = address === config.validator;

  async function decide(ok: boolean, viaDemo: boolean) {
    const verdict = ok ? "Conforming delivery" : "Rejected delivery";
    const out = await run(
      viaDemo
        ? {
            title: verdict,
            detail: "Recorded by Avocate's demo validator",
            kind: "escrow",
            trade: trade.id,
            wallet: false,
            execute: (_s, onStep) => callService("/api/validator/attest", { escrowId: trade.id, ok, report }, onStep),
          }
        : {
            title: verdict,
            detail: "Signed with your validator wallet",
            kind: "escrow",
            contractId: trade.id,
            method: "validate",
            args: { ok, report_hash: await reportHash(report, trade.id, ok) },
          },
    );
    if (out) onDone();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="report">
          Inspection report (optional)
        </label>
        <textarea
          id="report"
          className="input min-h-24"
          maxLength={MAX_REPORT}
          value={report}
          onChange={(e) => setReport(e.target.value)}
          placeholder="Lot, quantity, quality checks, photos reference…"
        />
        <p className="mt-1 text-xs text-ink/70">
          The report stays with you; only its fingerprint (SHA-256) is written on chain, so it can be checked later.
        </p>
      </div>

      <p className="text-sm text-ink/70">
        Conforming lets the agent or the buyer settle the trade. Rejecting lets the buyer take the whole deposit back
        {trade.advance && ", and the advance becomes a loss shared by the pool"}.
      </p>

      {isValidator ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="btn-brand" onClick={() => decide(true, false)}>
            Delivery conforms
          </button>
          <button className="btn-ghost text-danger" onClick={() => decide(false, false)}>
            Reject delivery
          </button>
        </div>
      ) : (
        <div className="space-y-3 border-t border-ink/10 pt-4">
          <p className="text-sm text-ink/70">
            The trade's validator is {short(config.validator)}. Connect that wallet to sign, or, for this demo, let
            Avocate's demo validator record the verdict.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn-brand" onClick={() => decide(true, true)}>
              Demo: delivery conforms
            </button>
            <button className="btn-ghost text-danger" onClick={() => decide(false, true)}>
              Demo: reject delivery
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
