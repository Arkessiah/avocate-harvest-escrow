"use client";

import { useTx } from "@/components/TxProvider";
import type { Trade } from "@/lib/trade";

// Either party can drop a trade while nothing has been deposited.
export function CancelTrade({ trade, me, onDone }: { trade: Trade; me: string; onDone: () => void }) {
  const run = useTx();
  if (trade.state !== "Pending" || !trade.canCancel) return null;

  async function cancel() {
    if (!window.confirm("Cancel this trade? It cannot be reopened; you would create a new one instead.")) return;
    const out = await run({
      title: "Cancel trade",
      detail: "Nothing has been deposited, so no money moves",
      kind: "escrow",
      contractId: trade.id,
      method: "cancel",
      args: { by: me },
    });
    if (out) onDone();
  }

  return (
    <button className="btn-ghost w-full text-rose-700" onClick={cancel}>
      Cancel trade
    </button>
  );
}
