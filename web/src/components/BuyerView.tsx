"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { useTx } from "@/components/TxProvider";
import { CreateTrade } from "@/components/CreateTrade";
import { CancelTrade } from "@/components/CancelTrade";
import { ProposeDeal } from "@/components/ProposeDeal";
import { TradeCard } from "@/components/TradeCard";
import { TradePicker } from "@/components/TradePicker";
import { AdvanceApproval, useAdvanceCode } from "@/components/AdvanceApproval";
import { useTrade, useTradeParam } from "@/components/useTrade";
import { network } from "@/lib/network";
import { read } from "@/lib/chain";
import { bps, formatUsdc } from "@/lib/usdc";
import { formatDate, type Trade } from "@/lib/trade";

export function BuyerView() {
  const [tradeId, setTradeId] = useTradeParam();
  const { trade, error, loading, refresh } = useTrade(tradeId);
  const [advanceCode, clearAdvance] = useAdvanceCode();
  const [version, setVersion] = useState(0);
  const changed = () => {
    refresh();
    setVersion((v) => v + 1);
  };

  return (
    <>
      {advanceCode && (
        <AdvanceApproval
          code={advanceCode}
          trade={trade}
          onDismiss={clearAdvance}
          onDone={() => {
            clearAdvance();
            changed();
          }}
        />
      )}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="order-2 space-y-6 lg:order-none lg:col-span-2">
          <CreateTrade
            onCreated={(id) => {
              setTradeId(id);
              setVersion((v) => v + 1);
            }}
          />
          <ProposeDeal side="buyer" />
        </div>
        <div className="order-1 lg:order-none lg:col-span-3">
          <TradePicker current={tradeId} onSelect={setTradeId} party="buyer" version={version} />
          {error && <p className="card p-6 text-sm text-danger">{error}</p>}
          {loading && !trade && <p className="card p-6 text-sm text-ink/70">Reading the trade from the network…</p>}
          {trade && (
            <TradeCard trade={trade}>
              <BuyerActions trade={trade} onDone={changed} />
            </TradeCard>
          )}
        </div>
      </div>
    </>
  );
}

function BuyerActions({ trade, onDone }: { trade: Trade; onDone: () => void }) {
  const { address } = useWallet();
  const run = useTx();
  const balance = useUsdcBalance(address, trade.state);
  const { config, state, validation, advance } = trade;
  const total = config.amount + trade.tradeFee;

  if (state === "Cancelled") {
    return <p className="text-sm text-ink/70">This trade was cancelled before any deposit. Create a new one if needed.</p>;
  }
  if (state === "Released" || state === "Refunded") {
    return <p className="text-sm text-ink/70">This trade is closed. Nothing else can happen to it.</p>;
  }
  if (address !== config.buyer) {
    return <p className="text-sm text-ink/70">Connect the buyer's wallet to act on this trade.</p>;
  }

  const act = async (title: string, detail: string, method: string) => {
    const out = await run({ title, detail, kind: "escrow", contractId: trade.id, method });
    if (out) onDone();
  };

  if (state === "Pending") {
    const short = balance !== null && balance < total;
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink/70">
          Lock {formatUsdc(total)} in the trade: the price plus the trade fee. Nobody can move it except under the
          trade's rules.
        </p>
        {balance !== null && (
          <p className={`text-sm ${short ? "text-danger" : "text-ink/70"}`}>
            Your balance: {formatUsdc(balance)}
            {short && " — not enough for this deposit."}
          </p>
        )}
        <button
          className="btn-brand w-full"
          disabled={short}
          onClick={() => act("Deposit payment", `${formatUsdc(total)} locked in the trade`, "fund")}
        >
          Deposit {formatUsdc(total)}
        </button>
        <CancelTrade trade={trade} me={address} onDone={onDone} />
      </div>
    );
  }

  const financingFee = advance ? bps(advance.principal, config.financing_fee_bps) : 0n;
  const toFarmer = config.amount - (advance ? advance.repay + financingFee : 0n);
  const rejected = validation?.ok === false;
  const expired = Date.now() / 1000 > Number(config.deadline);
  const canRefund = rejected || expired;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-sm text-ink/70">
          When the goods arrive as agreed, confirm the delivery. The farmer receives {formatUsdc(toFarmer)}
          {advance && ` (the price minus the ${formatUsdc(advance.repay)} owed to the pool and the financing fee)`}.
        </p>
        <button
          className="btn-brand w-full"
          onClick={() => act("Confirm delivery", `Pay the farmer ${formatUsdc(toFarmer)}`, "confirm_delivery")}
        >
          Confirm delivery and pay
        </button>
      </div>

      <div className="space-y-3 border-t border-ink/5 pt-4">
        <p className="text-sm text-ink/70">
          {rejected
            ? "The validator rejected the delivery: you can take your full deposit back."
            : expired
              ? advance
                ? `The deadline has passed. The pool is repaid ${formatUsdc(advance.repay)} first and you get the rest.`
                : "The deadline has passed: you can take your deposit back."
              : `Refund is available if the validator rejects the delivery or after the deadline (${formatDate(config.deadline)}).`}
        </p>
        <button
          className="btn-ghost w-full"
          disabled={!canRefund}
          onClick={() => act("Refund", "Return the deposit to the buyer", "refund")}
        >
          Refund
        </button>
      </div>
    </div>
  );
}

// Re-read whenever the trade changes state, since funding and refunds move the balance.
function useUsdcBalance(address: string | null, key: string): bigint | null {
  const [balance, setBalance] = useState<bigint | null>(null);
  useEffect(() => {
    if (!address) return setBalance(null);
    read<bigint>(network.contracts.usdc, "balance", { id: address }).then(setBalance, () => setBalance(null));
  }, [address, key]);
  return balance;
}
