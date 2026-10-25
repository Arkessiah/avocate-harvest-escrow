"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { TradeLoader } from "@/components/TradeLoader";
import { listTrades } from "@/lib/registry";
import { short } from "@/lib/format";
import { formatUsdc } from "@/lib/usdc";
import { STATE_BADGE, type Trade } from "@/lib/trade";
import { describeError } from "@/lib/errors";

type Party = "buyer" | "seller";

export interface Focus {
  label: string;
  test: (t: Trade) => boolean;
}

// Lists the platform's trades so nobody has to copy an address to follow one. It can
// narrow to the trades where the connected wallet is `party`, or to a role's `focus`
// (for instance, the trades waiting for the validator).
export function TradePicker({
  current,
  onSelect,
  party,
  focus,
  version = 0,
}: {
  current: string | null;
  onSelect: (id: string) => void;
  party?: Party;
  focus?: Focus;
  version?: number;
}) {
  const { address } = useWallet();
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState(true);

  useEffect(() => {
    let live = true;
    listTrades().then(
      (t) => live && setTrades(t),
      (e) => live && setError(describeError(e)),
    );
    return () => {
      live = false;
    };
  }, [version]);

  const roleOf = (t: Trade) =>
    t.config.buyer === address ? "buyer" : t.config.seller === address ? "farmer" : null;
  const narrow: Focus | null = focus ?? (address && party ? { label: "Mine", test: (t) => t.config[party] === address } : null);
  const filtering = !!narrow && mine;
  const shown = trades?.filter((t) => !filtering || narrow!.test(t)) ?? [];

  return (
    <section className="card mb-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Trades on the platform</h2>
        {narrow && (
          <div className="flex gap-1 rounded-lg bg-mist/70 p-1 text-xs font-medium" role="group" aria-label="Filter">
            {[
              [true, narrow.label],
              [false, "All"],
            ].map(([value, label]) => (
              <button
                key={String(label)}
                aria-pressed={mine === value}
                onClick={() => setMine(value as boolean)}
                className={`rounded-md px-2.5 py-1 ${mine === value ? "bg-brand-dark text-white" : "text-ink/70 hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {!trades && !error && <p className="mt-3 text-sm text-ink/70">Reading trades from the network…</p>}
      {trades && shown.length === 0 && (
        <p className="mt-3 text-sm text-ink/70">
          {filtering ? `Nothing under "${narrow!.label}" right now. Switch to All to see every trade.` : "No trades yet."}
        </p>
      )}

      {shown.length > 0 && (
        <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
          {shown.map((t) => {
            const role = roleOf(t);
            const selected = t.id === current;
            return (
              <li key={t.id}>
                <button
                  onClick={() => onSelect(t.id)}
                  aria-current={selected ? "true" : undefined}
                  className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-left text-sm transition ${
                    selected ? "bg-brand/10 ring-1 ring-brand/30" : "hover:bg-mist"
                  }`}
                >
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATE_BADGE[t.state]}`}>{t.state}</span>
                  <span className="font-semibold">{formatUsdc(t.config.amount)}</span>
                  <span className="font-mono text-xs text-ink/70">
                    {short(t.config.buyer, 4)} → {short(t.config.seller, 4)}
                  </span>
                  {t.advance && <span className="text-xs text-brand-dark">advanced</span>}
                  {role && <span className="ml-auto text-xs font-medium text-brand-dark">you: {role}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink/70 hover:text-ink">Open a trade by its address</summary>
        <div className="mt-2">
          <TradeLoader current={current} onLoad={onSelect} />
        </div>
      </details>
    </section>
  );
}
