"use client";

import { useEffect, useMemo, useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import { useWallet } from "@/components/WalletProvider";
import { useTx } from "@/components/TxProvider";
import { network } from "@/lib/network";
import { read, type Fees } from "@/lib/chain";
import { pct } from "@/lib/format";
import { bps, formatUsdc, toUnits } from "@/lib/usdc";

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function CreateTrade({ onCreated }: { onCreated: (id: string) => void }) {
  const { address, connect } = useWallet();
  const run = useTx();
  const [fees, setFees] = useState<Fees | null>(null);
  const [seller, setSeller] = useState("");
  const [price, setPrice] = useState("1000");
  const [deadline, setDeadline] = useState(() => isoDay(Date.now() + 30 * DAY));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    read<Fees>(network.contracts.platform, "fees").then(setFees, () => setFees(null));
  }, []);

  const amount = toUnits(price);
  // The deadline is the end of the chosen day, in the buyer's own time zone.
  const deadlineTs = Math.floor(new Date(`${deadline}T23:59:59`).getTime() / 1000);
  const fee = amount && fees ? bps(amount, fees.trade_fee_bps) : null;

  const problem = useMemo(() => {
    if (!StrKey.isValidEd25519PublicKey(seller.trim())) return "Enter the farmer's Stellar address (G…).";
    if (seller.trim() === address) return "The farmer must be a different account from yours.";
    if (!amount || amount <= 0n) return "Enter a price above zero.";
    if (!(deadlineTs > Date.now() / 1000)) return "Pick a deadline in the future.";
    return null;
  }, [seller, address, amount, deadlineTs]);

  async function create() {
    if (!address) return void connect();
    if (problem || !amount) return;
    setBusy(true);
    const out = await run({
      title: "Create trade",
      detail: `${formatUsdc(amount)} with ${seller.slice(0, 6)}…, deadline ${deadline}`,
      kind: "platform",
      contractId: network.contracts.platform,
      method: "create_escrow",
      args: { buyer: address, seller: seller.trim(), amount, deadline: BigInt(deadlineTs) },
    });
    setBusy(false);
    if (out && typeof out.result === "string") onCreated(out.result);
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">New trade</h2>
      <p className="mt-1 text-sm text-ink/70">
        Agree a price with the farmer. Creating the trade costs only the network fee; the money is locked in the next step.
      </p>

      <div className="mt-5 grid gap-4">
        <div>
          <label className="label" htmlFor="seller">
            Farmer's address
          </label>
          <input
            id="seller"
            className="input font-mono"
            placeholder="G…"
            value={seller}
            onChange={(e) => setSeller(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="price">
              Price (USDC)
            </label>
            <input id="price" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="deadline">
              Deadline
            </label>
            <input
              id="deadline"
              className="input"
              type="date"
              min={isoDay(Date.now() + DAY)}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        {amount && fee !== null && fees && (
          <dl className="border-t border-ink/10 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/70">Price</dt>
              <dd>{formatUsdc(amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/70">Trade fee ({pct(fees.trade_fee_bps)})</dt>
              <dd>{formatUsdc(fee)}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-ink/5 pt-1 font-semibold">
              <dt>You will deposit</dt>
              <dd>{formatUsdc(amount + fee)}</dd>
            </div>
            <p className="mt-2 text-xs text-ink/70">The fee comes back to you if the trade is refunded.</p>
          </dl>
        )}
      </div>

      <button className="btn-brand mt-5 w-full" onClick={create} disabled={busy || (!!address && !!problem)}>
        {address ? "Create trade" : "Connect wallet to create"}
      </button>
      {address && problem && <p className="mt-2 text-sm text-ink/70">{problem}</p>}
    </section>
  );
}
