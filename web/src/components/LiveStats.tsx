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

  const rows: [string, string][] = [
    ["Trades created", stats ? String(stats.trades) : "…"],
    ["Financing pool", stats ? formatUsdc(stats.poolValue) : "…"],
    ["Trade fee (buyer)", stats ? pct(stats.fees.trade_fee_bps) : "…"],
    ["Advance cost (farmer)", stats ? `${pct(stats.fees.pool_yield_bps)} + ${pct(stats.fees.financing_fee_bps)}` : "…"],
  ];

  return (
    <div className="card-glass p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="label">Live on Stellar {network.name}</p>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink/70">
          <span className={`h-2 w-2 rounded-full ${failed ? "bg-rose-500" : "bg-brand"}`} aria-hidden />
          {failed ? "Network unreachable" : "Read from the contracts"}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white/60 px-3 py-2">
            <dt className="text-xs text-ink/70">{label}</dt>
            <dd className="text-lg font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <a
        className="mt-3 inline-block text-xs text-brand-dark hover:underline"
        href={`${network.explorerContract}${network.contracts.platform}`}
        target="_blank"
        rel="noreferrer"
      >
        See the platform contract on the explorer ↗
      </a>
    </div>
  );
}
