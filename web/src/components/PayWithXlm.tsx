"use client";

import { useEffect, useState } from "react";
import { useTx } from "@/components/TxProvider";
import { formatUsdc } from "@/lib/usdc";
import { quoteXlmFor, swapThenFund, withSlippage, xlmBalance } from "@/lib/swap";
import type { Trade } from "@/lib/trade";

const formatXlm = (units: bigint) =>
  `${(Number(units) / 1e7).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM`;

// A buyer without enough USDC pays the difference in XLM: Soroswap swaps exactly what is
// missing, then the trade is funded in USDC as usual. The escrow never sees XLM.
export function PayWithXlm({
  trade,
  buyer,
  total,
  usdc,
  onDone,
}: {
  trade: Trade;
  buyer: string;
  total: bigint;
  usdc: bigint | null;
  onDone: () => void;
}) {
  const run = useTx();
  const missing = total - (usdc ?? 0n) > 0n ? total - (usdc ?? 0n) : 0n;
  const [quote, setQuote] = useState<bigint | null>(null);
  const [xlm, setXlm] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (missing === 0n) return setQuote(0n);
    quoteXlmFor(missing).then(setQuote, () => setError("No quote from Soroswap right now."));
  }, [missing]);

  useEffect(() => {
    xlmBalance(buyer).then(setXlm, () => setXlm(null));
  }, [buyer]);

  if (missing === 0n) return null;
  const max = quote !== null ? withSlippage(quote) : null;
  const short = max !== null && xlm !== null && xlm < max;

  async function pay() {
    if (max === null) return;
    const out = await run({
      title: "Pay with XLM",
      detail: `Swap for ${formatUsdc(missing)} on Soroswap, then deposit ${formatUsdc(total)}`,
      kind: "escrow",
      trade: trade.id,
      execute: (_s, onStep) => swapThenFund({ buyer, escrow: trade.id, usdcNeeded: missing, xlmMax: max }, onStep),
    });
    if (out) onDone();
  }

  return (
    <div className="space-y-3 border-t border-ink/10 pt-4">
      <h3 className="text-sm font-semibold">No USDC? Pay with XLM</h3>
      <p className="text-sm text-ink/70">
        Soroswap swaps the {formatUsdc(missing)} you are missing, then the trade is funded in USDC as usual.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      {quote !== null && max !== null && (
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink/70">Estimated cost</dt>
            <dd className="font-semibold">{formatXlm(quote)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink/70">You sign for at most (1% price margin)</dt>
            <dd>{formatXlm(max)}</dd>
          </div>
          {xlm !== null && (
            <div className="flex justify-between gap-4">
              <dt className="text-ink/70">Your XLM</dt>
              <dd className={short ? "font-semibold text-danger" : undefined}>{formatXlm(xlm)}</dd>
            </div>
          )}
        </dl>
      )}
      <button className="btn-ghost w-full" disabled={max === null || short} onClick={pay}>
        Pay with XLM and deposit
      </button>
      <p className="text-xs text-ink/70">Three signatures at most: a USDC trustline if you lack one, the swap and the deposit.</p>
    </div>
  );
}
