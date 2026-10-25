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
      <h1 className="text-lg font-semibold">Farmers get paid in seconds once delivery is confirmed.</h1>

      <section className="card mt-4 p-6">
        <p className="label">Network</p>
        <p className="font-medium">
          Stellar {network.name} · deployed {new Date(network.deployedAt).toLocaleString("en")}
        </p>

        <ul className="mt-4 space-y-2 text-sm">
          {contracts.map(([label, id]) => (
            <li key={id} className="flex items-center justify-between gap-4">
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

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <Stat label="Trade fee" value={fees ? pct(fees.trade_fee_bps) : "…"} />
          <Stat label="Financing fee" value={fees ? pct(fees.financing_fee_bps) : "…"} />
          <Stat label="Pool yield" value={fees ? pct(fees.pool_yield_bps) : "…"} />
          <Stat label="Trades" value={trades ?? "…"} />
        </div>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-mist/70 px-4 py-3">
      <p className="label">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
