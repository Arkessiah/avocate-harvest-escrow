"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearHistory, onHistoryChange, readHistory, type HistoryEntry } from "@/lib/history";
import { network } from "@/lib/network";
import { short } from "@/lib/format";

const WHEN = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// `tradePath` is the screen a trade link opens: the current role when it works with trades.
export function HistoryPanel({ tradePath }: { tradePath: string }) {
  // Read after mount: the server has no localStorage, and the first render must match it.
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    const load = () => setEntries(readHistory());
    load();
    return onHistoryChange(load);
  }, []);

  return (
    <section className="card mt-10 p-5 sm:p-6" aria-labelledby="history-title">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="history-title" className="text-sm font-semibold">
          Your activity in this browser
        </h2>
        {entries && entries.length > 0 && (
          <button type="button" onClick={clearHistory} className="text-xs text-ink/70 hover:text-ink hover:underline">
            Clear
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-ink/70">Kept only on this device. The chain keeps the real record.</p>

      {entries && entries.length === 0 && (
        <p className="mt-4 text-sm text-ink/70">
          Nothing yet. Each action you complete here appears in this list, linked to its trade and transaction.
        </p>
      )}

      {entries && entries.length > 0 && (
        <ol className="mt-4 divide-y divide-ink/10">
          {entries.map((e) => (
            <li key={`${e.ts}-${e.hash ?? e.title}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5 text-sm">
              <time dateTime={new Date(e.ts).toISOString()} className="shrink-0 text-xs sm:w-28 tabular-nums text-ink/70">
                {WHEN.format(e.ts)}
              </time>
              <span className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                <span className="font-medium">{e.title}</span>
                <span className="text-ink/70"> · {e.detail}</span>
              </span>
              <span className="flex shrink-0 gap-3 whitespace-nowrap text-xs">
                {e.trade && (
                  <Link href={`${tradePath}?trade=${e.trade}`} className="font-mono text-brand-dark hover:underline">
                    Trade {short(e.trade, 4)}
                  </Link>
                )}
                {e.hash && (
                  <a
                    href={`${network.explorerTx}${e.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-brand-dark hover:underline"
                  >
                    Tx {short(e.hash, 4)} ↗
                  </a>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
