"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { useTx } from "@/components/TxProvider";
import { read } from "@/lib/chain";
import { network } from "@/lib/network";
import { toUnits } from "@/lib/usdc";
import { minReceived, quoteOut, swapExact, xlmBalance, type Direction } from "@/lib/swap";

// XLM pays the network fees and the account's minimum balance, so a swap never spends the
// last couple of lumens.
const XLM_KEEP = 2n * 10_000_000n;

// Up to four decimals: small swaps would otherwise show the quote and the minimum as the same
// two-decimal figure.
const amountIn = (symbol: string) => (units: bigint) =>
  `${(Number(units) / 1e7).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${symbol}`;
const formatXlm = amountIn("XLM");
const formatUsdc = amountIn("USDC");

// Get USDC before trading, or turn USDC into XLM after being paid, through Soroswap. The
// escrow is not involved; this is a convenience next to it.
export function SwapCard() {
  const { address, connect } = useWallet();
  const run = useTx();
  const [dir, setDir] = useState<Direction>("xlm-to-usdc");
  const [input, setInput] = useState("");
  const [quote, setQuote] = useState<bigint | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [balances, setBalances] = useState<{ xlm: bigint | null; usdc: bigint | null }>({ xlm: null, usdc: null });
  const [version, setVersion] = useState(0);

  const amount = toUnits(input);
  const toUsdc = dir === "xlm-to-usdc";
  const fmtIn = toUsdc ? formatXlm : formatUsdc;
  const fmtOut = toUsdc ? formatUsdc : formatXlm;

  useEffect(() => {
    if (!address) return setBalances({ xlm: null, usdc: null });
    Promise.all([
      xlmBalance(address).catch(() => null),
      // No trustline yet reads as no USDC.
      read<bigint>(network.usdc.contract, "balance", { id: address }).catch(() => 0n),
    ]).then(([xlm, usdc]) => setBalances({ xlm, usdc }));
  }, [address, version]);

  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    if (!amount || amount <= 0n) return;
    let live = true;
    // Wait for the typing to settle before asking the router.
    const timer = window.setTimeout(() => {
      quoteOut(amount, dir).then(
        (q) => live && setQuote(q),
        () => live && setQuoteError("Soroswap has no quote for this amount right now."),
      );
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [amount, dir]);

  const available = toUsdc
    ? balances.xlm !== null
      ? balances.xlm - XLM_KEEP
      : null
    : balances.usdc;
  const problem =
    input && (!amount || amount <= 0n)
      ? "Enter an amount above zero."
      : amount && available !== null && amount > available
        ? toUsdc
          ? `You can swap up to ${formatXlm(available > 0n ? available : 0n)}: 2 XLM stay for network fees.`
          : `You have ${formatUsdc(available)}.`
        : null;

  async function swap() {
    if (!address || !amount || !quote || problem) return;
    const out = await run({
      title: toUsdc ? "Get USDC with XLM" : "Turn USDC into XLM",
      detail: `${fmtIn(amount)} for at least ${fmtOut(minReceived(quote))} on Soroswap`,
      kind: "swap",
      execute: (_s, onStep) => swapExact({ owner: address, amountIn: amount, minOut: minReceived(quote), dir }, onStep),
    });
    if (out) {
      setInput("");
      setVersion((v) => v + 1);
    }
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Swap XLM and USDC</h2>
      <p className="mt-1 text-sm text-ink/70">
        Get USDC to pay for a trade, or turn the USDC you were paid into XLM. Swapped on Soroswap at the market price.
      </p>

      <div className="mt-5 flex gap-1 rounded-lg bg-mist/70 p-1 text-sm font-medium" role="group" aria-label="Direction">
        {(
          [
            ["xlm-to-usdc", "XLM → USDC"],
            ["usdc-to-xlm", "USDC → XLM"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={dir === value}
            onClick={() => setDir(value)}
            className={`flex-1 whitespace-nowrap rounded-md px-2 py-1.5 ${dir === value ? "bg-surface text-ink shadow-sm" : "text-ink/70 hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="swap-amount">
          You send ({toUsdc ? "XLM" : "USDC"})
        </label>
        <input
          id="swap-amount"
          className="input"
          inputMode="decimal"
          placeholder="0.00"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        {address && available !== null && (
          <p className="mt-1 text-xs text-ink/70">
            Available: {toUsdc ? formatXlm(available > 0n ? available : 0n) : formatUsdc(available)}
          </p>
        )}
      </div>

      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink/70">You receive about</dt>
          <dd className="whitespace-nowrap font-semibold">{quote !== null ? fmtOut(quote) : "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink/70">At least (1% slippage)</dt>
          <dd className="whitespace-nowrap">{quote !== null ? fmtOut(minReceived(quote)) : "—"}</dd>
        </div>
      </dl>

      {(problem || quoteError) && <p className="mt-3 text-sm text-danger">{problem ?? quoteError}</p>}

      {address ? (
        <button className="btn-brand mt-5 w-full" onClick={swap} disabled={!quote || !!problem}>
          {toUsdc ? "Get USDC" : "Get XLM"}
        </button>
      ) : (
        <button className="btn-brand mt-5 w-full" onClick={connect}>
          Connect wallet to swap
        </button>
      )}
      <p className="mt-3 text-xs text-ink/70">
        Testnet liquidity is limited: small amounts swap best.
        {toUsdc && " The first swap adds a USDC trustline to your account."}
      </p>
    </section>
  );
}
