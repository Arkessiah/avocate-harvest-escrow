"use client";

import { useEffect, useState } from "react";
import { network } from "@/lib/network";
import { read, type Fees } from "@/lib/chain";
import { pct } from "@/lib/format";
import { formatUsdc } from "@/lib/usdc";

interface Stats {
  trades: number;
  poolValue: bigint;
  fees: Fees;
}

// Read straight from the contracts on every visit, so the numbers on the landing page are
// the network's, not copy.
export function LiveStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const { platform, pool } = network.contracts;
    Promise.all([
      read<number>(platform, "escrow_count"),
      read<bigint>(pool, "total_assets"),
      read<Fees>(platform, "fees"),
    ]).then(
      ([trades, poolValue, fees]) => setStats({ trades, poolValue, fees }),
      () => setFailed(true),
    );
  }, []);

  return (
    <div className="card-highlight flex h-full flex-col p-6">
      <div className="flex items-center justify-between gap-3 text-xs text-ink/70">
        <span>Live on Stellar {network.name}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${failed ? "bg-danger" : "bg-brand"}`} aria-hidden />
          {failed ? "Network unreachable" : "Read from the contracts"}
        </span>
      </div>
      <p className="figure-xl mt-4">{stats ? stats.trades : "…"}</p>
      <p className="mt-1 text-sm text-ink/70">trades created on the platform</p>
      <dl className="mt-5 space-y-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink/70">Financing pool</dt>
          <dd className="font-semibold">{stats ? formatUsdc(stats.poolValue) : "…"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink/70">Trade fee (buyer)</dt>
          <dd className="font-semibold">{stats ? pct(stats.fees.trade_fee_bps) : "…"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink/70">Advance cost (farmer)</dt>
          <dd className="font-semibold">
            {stats ? `${pct(stats.fees.pool_yield_bps)} + ${pct(stats.fees.financing_fee_bps)}` : "…"}
          </dd>
        </div>
      </dl>
      <a
        className="mt-auto pt-4 text-xs text-brand-dark hover:underline"
        href={`${network.explorerContract}${network.contracts.platform}`}
        target="_blank"
        rel="noreferrer"
      >
        See the platform contract on the explorer ↗
      </a>
    </div>
  );
}
