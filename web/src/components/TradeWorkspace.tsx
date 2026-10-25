"use client";

import { useState, type ComponentType } from "react";
import { TradeCard } from "@/components/TradeCard";
import { TradePicker, type Focus } from "@/components/TradePicker";
import { useTrade, useTradeParam } from "@/components/useTrade";
import type { Trade } from "@/lib/trade";

export type ActionsProps = { trade: Trade; onDone: () => void };

// Trade list on top, the selected trade below with the role's actions in its footer.
export function TradeWorkspace({ focus, Actions }: { focus?: Focus; Actions: ComponentType<ActionsProps> }) {
  const [tradeId, setTradeId] = useTradeParam();
  const { trade, error, loading, refresh } = useTrade(tradeId);
  const [version, setVersion] = useState(0);
  const changed = () => {
    refresh();
    setVersion((v) => v + 1);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <TradePicker current={tradeId} onSelect={setTradeId} focus={focus} version={version} />
      {error && <p className="card-glass p-6 text-sm text-rose-700">{error}</p>}
      {!tradeId && !error && <p className="card-glass p-6 text-sm text-ink/70">Pick a trade from the list.</p>}
      {loading && !trade && <p className="card-glass p-6 text-sm text-ink/70">Reading the trade from the network…</p>}
      {trade && (
        <TradeCard trade={trade}>
          <Actions trade={trade} onDone={changed} />
        </TradeCard>
      )}
    </div>
  );
}
