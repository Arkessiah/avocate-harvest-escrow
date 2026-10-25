"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { useTx } from "@/components/TxProvider";
import { TradeCard } from "@/components/TradeCard";
import { TradePicker } from "@/components/TradePicker";
import { ProposeDeal } from "@/components/ProposeDeal";
import { CancelTrade } from "@/components/CancelTrade";
import { useTrade, useTradeParam } from "@/components/useTrade";
import { network } from "@/lib/network";
import { read } from "@/lib/chain";
import { pct } from "@/lib/format";
import { bps, formatUsdc, toInput, toUnits } from "@/lib/usdc";
import type { Trade } from "@/lib/trade";
import { signAdvanceRequest } from "@/lib/cosign";

export function FarmerView() {
  const [tradeId, setTradeId] = useTradeParam();
  const { trade, error, loading, refresh } = useTrade(tradeId);
  const [version, setVersion] = useState(0);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="order-2 lg:order-none lg:col-span-2">
        <ProposeDeal side="farmer" />
      </div>
      <div className="order-1 lg:order-none lg:col-span-3">
        <TradePicker current={tradeId} onSelect={setTradeId} party="seller" version={version} />
        {error && <p className="card p-6 text-sm text-danger">{error}</p>}
        {loading && !trade && <p className="card p-6 text-sm text-ink/70">Reading the trade from the network…</p>}
        {trade && (
          <TradeCard trade={trade}>
            <FarmerActions
              trade={trade}
              onDone={() => {
                refresh();
                setVersion((v) => v + 1);
              }}
            />
          </TradeCard>
        )}
      </div>
    </div>
  );
}

function FarmerActions({ trade, onDone }: { trade: Trade; onDone: () => void }) {
  const { address } = useWallet();
  const { config, state, validation, advance } = trade;
  const financingFee = advance ? bps(advance.principal, config.financing_fee_bps) : 0n;

  if (address !== config.seller) {
    return <p className="text-sm text-ink/70">Connect the farmer's wallet to act on this trade.</p>;
  }
  if (state === "Pending") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink/70">Waiting for the buyer to deposit the payment.</p>
        <CancelTrade trade={trade} me={address} onDone={onDone} />
      </div>
    );
  }
  if (state === "Cancelled") {
    return <p className="text-sm text-ink/70">This trade was cancelled before any deposit.</p>;
  }
  if (state === "Released") {
    const received = config.amount - (advance ? advance.repay + financingFee : 0n);
    return (
      <p className="text-sm text-ink/70">
        Paid. You received {formatUsdc(received)} at settlement
        {advance && `, on top of the ${formatUsdc(advance.principal)} advance`}.
      </p>
    );
  }
  if (state === "Refunded") {
    return <p className="text-sm text-ink/70">This trade was refunded to the buyer.</p>;
  }
  if (advance) {
    return (
      <p className="text-sm text-ink/70">
        You already received an advance of {formatUsdc(advance.principal)}. At settlement the pool is repaid{" "}
        {formatUsdc(advance.repay)} and Avocate keeps {formatUsdc(financingFee)}; the rest is paid to you.
      </p>
    );
  }
  if (validation) {
    return <p className="text-sm text-ink/70">The delivery has been validated, so the trade can no longer be financed.</p>;
  }
  if (Date.now() / 1000 >= Number(config.deadline)) {
    return <p className="text-sm text-ink/70">The deadline has passed, so the trade can no longer be financed.</p>;
  }
  return <AdvanceRequest trade={trade} farmer={address} onDone={onDone} />;
}

function AdvanceRequest({ trade, farmer, onDone }: { trade: Trade; farmer: string; onDone: () => void }) {
  const run = useTx();
  const { config } = trade;
  const [room, setRoom] = useState<{ limit: bigint | null; exposure: bigint } | null>(null);
  const [value, setValue] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const pool = network.contracts.pool;
    Promise.all([
      read<bigint | undefined>(pool, "farmer_limit", { farmer }),
      read<bigint>(pool, "exposure", { farmer }),
    ]).then(
      ([limit, exposure]) => setRoom({ limit: limit ?? null, exposure }),
      () => setRoom(null),
    );
  }, [farmer]);

  if (!room) return <p className="text-sm text-ink/70">Checking your financing limit…</p>;
  if (room.limit === null) {
    return (
      <p className="text-sm text-ink/70">
        You are not onboarded for advances yet. Avocate sets each farmer's financing limit after reviewing them.
      </p>
    );
  }

  const cap = bps(config.amount, network.maxAdvanceBps);
  const available = room.limit - room.exposure;
  const max = cap < available ? cap : available;
  const principal = toUnits(value);
  const repay = principal ? principal + bps(principal, config.pool_yield_bps) : null;
  const fee = principal ? bps(principal, config.financing_fee_bps) : null;
  const problem =
    max <= 0n
      ? "You have reached your financing limit."
      : !principal || principal <= 0n
        ? "Enter the amount you need now."
        : principal > max
          ? `The most you can ask for on this trade is ${formatUsdc(max)}.`
          : null;

  async function sign() {
    if (problem || !principal) return;
    const out = await run({
      title: "Request an advance",
      detail: `${formatUsdc(principal)} from the financing pool`,
      kind: "pool",
      execute: async (_source, onStep) => ({
        hash: "",
        result: await signAdvanceRequest({ escrow: trade.id, principal, buyer: config.buyer, farmer }, onStep),
      }),
    });
    if (out && typeof out.result === "string") {
      setLink(`${window.location.origin}/buyer?trade=${trade.id}#advance=${out.result}`);
      setCopied(false);
    }
  }

  if (link) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-brand-dark">Step 1 of 2 done: you signed the request.</p>
        <p className="text-sm text-ink/70">
          Step 2: send this link to the buyer. They review it and complete it with their signature; the advance is paid
          to you at that moment. The link is valid for one hour.
        </p>
        <div className="flex gap-2">
          <input className="input font-mono text-xs" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Advance request link" />
          <button
            className="btn-brand shrink-0"
            onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <button className="text-sm text-brand-dark hover:underline" onClick={onDone}>
          I have sent it — check whether the buyer completed it
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Get paid now with an advance</h3>
        <p className="mt-1 text-sm text-ink/70">
          The financing pool can pay you part of the price today. You sign first; then the buyer completes it.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="border-t border-ink/10 pt-2">
          <dt className="label">Your limit left</dt>
          <dd className="font-semibold">{formatUsdc(available)}</dd>
        </div>
        <div className="border-t border-ink/10 pt-2">
          <dt className="label">Max on this trade ({pct(network.maxAdvanceBps)})</dt>
          <dd className="font-semibold">{formatUsdc(cap)}</dd>
        </div>
      </dl>
      <div>
        <label className="label" htmlFor="advance">
          Amount (USDC)
        </label>
        <div className="flex gap-2">
          <input id="advance" className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="btn-ghost shrink-0" onClick={() => setValue(toInput(max > 0n ? max : 0n))}>
            Max
          </button>
        </div>
      </div>
      {principal && repay !== null && fee !== null && !problem && (
        <dl className="border-t border-ink/10 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink/70">You receive now</dt>
            <dd className="font-semibold">{formatUsdc(principal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink/70">Repaid to the pool at settlement ({pct(config.pool_yield_bps)} yield)</dt>
            <dd>{formatUsdc(repay)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink/70">Avocate financing fee ({pct(config.financing_fee_bps)})</dt>
            <dd>{formatUsdc(fee)}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-ink/5 pt-1">
            <dt className="text-ink/70">Paid to you at settlement</dt>
            <dd>{formatUsdc(config.amount - repay - fee)}</dd>
          </div>
          <p className="mt-2 text-xs text-ink/70">The repayment and the fee are taken from the price when the trade settles.</p>
        </dl>
      )}
      <button className="btn-brand w-full" onClick={sign} disabled={!!problem}>
        Sign advance request
      </button>
      {problem && <p className="text-sm text-ink/70">{problem}</p>}
    </div>
  );
}
