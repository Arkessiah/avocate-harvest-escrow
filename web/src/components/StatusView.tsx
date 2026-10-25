"use client";

import { useEffect, useState } from "react";
import { network } from "@/lib/network";
import { read, type Fees } from "@/lib/chain";
import { AppShell } from "@/components/AppShell";
import { pct, short } from "@/lib/format";

export function StatusView() {
  const [fees, setFees] = useState<Fees | null>(null);
  const [trades, setTrades] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { platform } = network.contracts;
    Promise.all([read<Fees>(platform, "fees"), read<number>(platform, "escrow_count")])
      .then(([f, n]) => {
        setFees(f);
        setTrades(n);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const contracts = [
    ["Platform", network.contracts.platform],
    ["Financing pool", network.contracts.pool],
    ["USDC", network.contracts.usdc],
  ] as const;

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Farmers paid in seconds. Buyers pay only for what arrives.</h1>

      <div className="mt-6 grid gap-4 lg:grid-cols-6">
        <section className="card-highlight p-6 lg:col-span-3">
          <h2 className="text-sm font-medium text-ink/70">Trades on the platform</h2>
          <p className="figure-xl mt-2">{trades ?? "…"}</p>
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="text-ink/70">Harvest fee (buyer)</dt>
              <dd className="font-semibold">{fees ? pct(fees.trade_fee_bps) : "…"}</dd>
            </div>
            <div>
              <dt className="text-ink/70">Financing fee</dt>
              <dd className="font-semibold">{fees ? pct(fees.financing_fee_bps) : "…"}</dd>
            </div>
            <div>
              <dt className="text-ink/70">Pool yield</dt>
              <dd className="font-semibold">{fees ? pct(fees.pool_yield_bps) : "…"}</dd>
            </div>
          </dl>
          {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        </section>

        <section className="card p-6 lg:col-span-3">
          <h2 className="text-sm font-medium text-ink/70">Network</h2>
          <p className="mt-1 font-medium">
            Stellar {network.name} · deployed {new Date(network.deployedAt).toLocaleDateString("en", { dateStyle: "medium" })}
          </p>
          <ul className="mt-4 divide-y divide-ink/5 text-sm">
            {contracts.map(([label, id]) => (
              <li key={id} className="flex items-center justify-between gap-4 py-2">
                <span className="text-ink/70">{label}</span>
                <a
                  className="font-mono text-brand-dark hover:underline"
                  href={`${network.explorerContract}${id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {short(id)} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
