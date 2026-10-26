"use client";

import { useEffect, useState } from "react";
import { network } from "@/lib/network";
import { read } from "@/lib/chain";
import { pct, short } from "@/lib/format";
import { bps, formatUsdc } from "@/lib/usdc";
import { listTrades } from "@/lib/registry";
import { canAdvance, type Trade } from "@/lib/trade";

interface Room {
  limit: bigint | null;
  exposure: bigint;
}

// The farmer's way in to an advance: whether they are onboarded and for how much, and the
// trades they could finance right now, one click from the request form.
export function AdvanceFinder({ farmer, onPick, version }: { farmer: string; onPick: (id: string) => void; version: number }) {
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const pool = network.contracts.pool;
    Promise.all([
      listTrades(),
      read<bigint | undefined>(pool, "farmer_limit", { farmer }),
      read<bigint>(pool, "exposure", { farmer }),
    ]).then(
      ([all, limit, exposure]) => {
        if (!live) return;
        setTrades(all.filter((t) => t.config.seller === farmer && canAdvance(t)));
        setRoom({ limit: limit ?? null, exposure });
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [farmer, version]);

  const available = room?.limit != null ? room.limit - room.exposure : null;

  return (
    <section className="card-highlight mb-4 p-6">
      <h2 className="text-lg font-semibold">Get paid early</h2>
      <p className="mt-1 text-sm text-ink/70">
        While a buyer's payment is locked and before the delivery is checked, the financing pool can advance you up to{" "}
        {pct(network.maxAdvanceBps)} of the price. You sign the request and send it to the buyer, who completes it.
      </p>

      {failed && <p className="mt-3 text-sm text-danger">Could not read your trades from the network.</p>}
      {!failed && (!trades || !room) && <p className="mt-3 text-sm text-ink/70">Reading your trades and financing limit…</p>}

      {room && room.limit === null && (
        <p className="mt-3 text-sm font-medium">
          You are not onboarded for advances yet. Avocate sets each farmer's financing limit after reviewing them.
        </p>
      )}

      {room && room.limit !== null && trades && (
        <>
          <p className="mt-3 text-sm">
            Your limit <span className="font-semibold">{formatUsdc(room.limit)}</span> · in use{" "}
            <span className="font-semibold">{formatUsdc(room.exposure)}</span> · available{" "}
            <span className="font-semibold">{formatUsdc(available! > 0n ? available! : 0n)}</span>
          </p>
          {trades.length === 0 ? (
            <p className="mt-3 text-sm text-ink/70">
              None of your trades can take an advance right now. You need a trade where the buyer has already deposited the
              payment, with no advance yet and the delivery not checked.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-ink/10">
              {trades.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <span className="text-sm">
                    <span className="font-semibold">{formatUsdc(t.config.amount)}</span>
                    <span className="text-ink/70">
                      {" "}
                      · up to {formatUsdc(bps(t.config.amount, network.maxAdvanceBps))} · buyer{" "}
                      <span className="font-mono text-xs">{short(t.config.buyer, 4)}</span>
                    </span>
                  </span>
                  <button type="button" className="btn-brand px-3 py-1.5 text-sm" onClick={() => onPick(t.id)}>
                    Request an advance
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
