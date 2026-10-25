"use client";

import type { ReactNode } from "react";
import { useWallet } from "@/components/WalletProvider";
import { network } from "@/lib/network";
import { pct, short } from "@/lib/format";
import { formatUsdc } from "@/lib/usdc";
import { STATE_BADGE, STATE_TEXT, formatDate, type Trade } from "@/lib/trade";

export function TradeCard({ trade, children }: { trade: Trade; children?: ReactNode }) {
  const { address } = useWallet();
  const { config, state, validation, advance } = trade;
  const you = (a: string) => (a === address ? " (you)" : "");

  return (
    <article className="card-glass overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/5 px-6 py-4">
        <div>
          <p className="label">Trade</p>
          <a
            href={`${network.explorerContract}${trade.id}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sm text-brand-dark hover:underline"
          >
            {short(trade.id)} ↗
          </a>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATE_BADGE[state]}`}>
          {state} · {STATE_TEXT[state]}
        </span>
      </header>

      <dl className="grid gap-x-6 gap-y-4 px-6 py-5 text-sm sm:grid-cols-2">
        <Row label="Price" value={formatUsdc(config.amount)} strong />
        <Row label={`Trade fee (${pct(config.trade_fee_bps)})`} value={formatUsdc(trade.tradeFee)} />
        <Row label="Buyer" value={short(config.buyer) + you(config.buyer)} mono />
        <Row label="Farmer" value={short(config.seller) + you(config.seller)} mono />
        <Row label="Deadline" value={formatDate(config.deadline)} />
        <Row
          label="Delivery check"
          value={!validation ? "Not validated yet" : validation.ok ? "Conforming" : "Rejected"}
        />
        {advance && (
          <>
            <Row label="Advance paid to the farmer" value={formatUsdc(advance.principal)} />
            <Row label="Owed to the pool" value={formatUsdc(advance.repay)} />
          </>
        )}
      </dl>

      {children && <div className="border-t border-ink/5 bg-white/40 px-6 py-5">{children}</div>}
    </article>
  );
}

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className={`${strong ? "text-lg font-semibold" : ""} ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
