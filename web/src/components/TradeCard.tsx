"use client";

import type { ReactNode } from "react";
import { useWallet } from "@/components/WalletProvider";
import { network } from "@/lib/network";
import { pct, short } from "@/lib/format";
import { formatUsdc } from "@/lib/usdc";
import { STATE_BADGE, STATE_TEXT, formatDate, owedNow, type Trade } from "@/lib/trade";
import { TradeTimeline } from "@/components/TradeTimeline";
import { ShareTrade } from "@/components/ShareTrade";

export function TradeCard({ trade, children }: { trade: Trade; children?: ReactNode }) {
  const { address } = useWallet();
  const { config, state, validation, advance } = trade;
  const you = (a: string) => (a === address ? " (you)" : "");

  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6">
        <div>
          <p className="text-sm text-ink/70">
            Trade{" "}
            <a
              href={`${network.explorerContract}${trade.id}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-brand-dark hover:underline"
            >
              {short(trade.id)} ↗
            </a>
          </p>
          <p className="mt-1 font-condensed text-4xl leading-none">
            {formatUsdc(config.amount).replace(" USDC", "")} <span className="text-lg text-ink/70">USDC</span>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATE_BADGE[state]}`}>
          {state} · {STATE_TEXT[state]}
        </span>
      </header>

      <div className="px-6 py-5">
        <TradeTimeline trade={trade} />
      </div>

      <dl className="grid gap-x-6 gap-y-3 border-t border-ink/5 px-6 py-5 text-sm sm:grid-cols-3">
        <Row label={`Trade fee (${pct(config.trade_fee_bps)})`} value={formatUsdc(trade.tradeFee)} />
        <Row label="Buyer" value={short(config.buyer, 4) + you(config.buyer)} mono />
        <Row label="Farmer" value={short(config.seller, 4) + you(config.seller)} mono />
        <Row label="Deadline" value={formatDate(config.deadline)} />
        {advance && (
          <>
            <Row label="Advance paid to the farmer" value={formatUsdc(advance.principal)} />
            <Row
              label={advance.start !== undefined ? "Owed to the pool today" : "Owed to the pool"}
              value={
                advance.start !== undefined && state === "Funded"
                  ? `${formatUsdc(owedNow(trade))} (up to ${formatUsdc(advance.repay)})`
                  : formatUsdc(advance.repay)
              }
            />
          </>
        )}
        {validation && <Row label="Delivery check" value={validation.ok ? "Conforming" : "Rejected"} />}
      </dl>

      {children && <div className="border-t border-ink/5 px-6 py-5">{children}</div>}

      <div className="border-t border-ink/5 px-6 py-4">
        <ShareTrade id={trade.id} />
      </div>
    </article>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink/70">{label}</dt>
      <dd className={mono ? "font-mono" : undefined}>{value}</dd>
    </div>
  );
}
