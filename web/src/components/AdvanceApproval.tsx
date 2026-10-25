"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { useTx } from "@/components/TxProvider";
import { readAdvanceRequest, submitAdvance, type AdvanceRequest } from "@/lib/cosign";
import { describeError } from "@/lib/errors";
import { pct, short } from "@/lib/format";
import { bps, formatUsdc } from "@/lib/usdc";
import type { Trade } from "@/lib/trade";

const HASH_KEY = "#advance=";

// The request travels in the URL fragment, which browsers never send to any server.
export function useAdvanceCode(): [string | null, () => void] {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    const read = () =>
      setCode(window.location.hash.startsWith(HASH_KEY) ? window.location.hash.slice(HASH_KEY.length) : null);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const clear = () => {
    history.replaceState(null, "", window.location.pathname + window.location.search);
    setCode(null);
  };
  return [code, clear];
}

export function AdvanceApproval({
  code,
  trade,
  onDone,
  onDismiss,
}: {
  code: string;
  trade: Trade | null;
  onDone: () => void;
  onDismiss: () => void;
}) {
  const { address, connect } = useWallet();
  const run = useTx();
  const [request, setRequest] = useState<AdvanceRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRequest(null);
    setError(null);
    if (!address) return;
    readAdvanceRequest(code, address).then(setRequest, (e) => setError(describeError(e, "pool")));
  }, [code, address]);

  const frame = (body: React.ReactNode) => (
    <section className="mb-6 rounded-2xl border-2 border-brand/40 bg-surface p-5 shadow-sm" aria-labelledby="advance-title">
      <p className="label">Step 2 of 2 · Buyer</p>
      <h2 id="advance-title" className="text-lg font-semibold">
        The farmer asks for an advance
      </h2>
      {body}
    </section>
  );

  if (!address) {
    return frame(
      <div className="mt-3 space-y-3">
        <p className="text-sm text-ink/70">Connect the buyer's wallet to review the request.</p>
        <button className="btn-brand" onClick={connect}>
          Connect wallet
        </button>
      </div>,
    );
  }
  if (error) {
    return frame(
      <div className="mt-3 space-y-3">
        <p className="rounded-xl border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
        <button className="btn-ghost" onClick={onDismiss}>
          Dismiss
        </button>
      </div>,
    );
  }
  if (!request || !trade) return frame(<p className="mt-3 text-sm text-ink/70">Reading the request…</p>);
  if (request.escrow !== trade.id) {
    return frame(<p className="mt-3 text-sm text-danger">This request is for another trade ({short(request.escrow)}).</p>);
  }

  const { config } = trade;
  const repay = request.principal + bps(request.principal, config.pool_yield_bps);
  const expired = request.expiresAt.getTime() < Date.now();

  async function approve() {
    const out = await run({
      title: "Approve advance",
      detail: `${formatUsdc(request!.principal)} paid by the pool to the farmer`,
      kind: "pool",
      execute: (source, onStep) => submitAdvance(request!, source, onStep),
    });
    if (out) onDone();
  }

  return frame(
    <div className="mt-3 space-y-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-mist px-3 py-2">
          <dt className="label">Farmer receives now</dt>
          <dd className="text-lg font-semibold">{formatUsdc(request.principal)}</dd>
        </div>
        <div className="rounded-xl bg-mist px-3 py-2">
          <dt className="label">Owed to the pool ({pct(config.pool_yield_bps)} yield)</dt>
          <dd className="text-lg font-semibold">{formatUsdc(repay)}</dd>
        </div>
      </dl>
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink/70">
        <li>Your deposit stays locked in the trade, and you still confirm the delivery as usual.</li>
        <li>When the trade settles, the pool is repaid from the price before the farmer is paid the rest.</li>
        <li>
          If you let the trade reach its deadline without settling, the pool is repaid {formatUsdc(repay)} from your
          deposit first. If the validator rejects the delivery, you get your full deposit back.
        </li>
      </ul>
      <p className="text-xs text-ink/70">
        {expired
          ? "This request has expired. Ask the farmer for a new link."
          : `Valid until ${request.expiresAt.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}.`}
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-brand" disabled={expired} onClick={approve}>
          Approve and submit
        </button>
        <button className="btn-ghost" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>,
  );
}
