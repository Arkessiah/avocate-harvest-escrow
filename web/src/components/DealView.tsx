"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";
import { useTx } from "@/components/TxProvider";
import { network } from "@/lib/network";
import { read, type Fees } from "@/lib/chain";
import { pct, short } from "@/lib/format";
import { bps, formatUsdc } from "@/lib/usdc";
import { formatDate } from "@/lib/trade";
import { completeDeal, readDeal, type Deal } from "@/lib/deal";
import { describeError } from "@/lib/errors";

const HASH_KEY = "#d=";

export function DealView() {
  const { address, connect } = useWallet();
  const run = useTx();
  const [code, setCode] = useState<string | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [fees, setFees] = useState<Fees | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  // The proposal sits in the URL fragment, which the browser never sends to a server.
  useEffect(() => {
    const h = window.location.hash;
    setCode(h.startsWith(HASH_KEY) ? h.slice(HASH_KEY.length) : null);
    read<Fees>(network.contracts.platform, "fees").then(setFees, () => setFees(null));
  }, []);

  useEffect(() => {
    setDeal(null);
    setError(null);
    if (!code || !address) return;
    readDeal(code, address).then(setDeal, (e) => setError(describeError(e, "platform")));
  }, [code, address]);

  if (!code) {
    return (
      <p className="card p-6 text-sm text-ink/70">
        Open this page from a trade proposal link or by scanning its QR code. To propose one, go to the{" "}
        <Link href="/buyer" className="text-brand-dark hover:underline">
          buyer
        </Link>{" "}
        or{" "}
        <Link href="/farmer" className="text-brand-dark hover:underline">
          farmer
        </Link>{" "}
        screen.
      </p>
    );
  }

  const frame = (body: React.ReactNode) => (
    <section className="card mx-auto max-w-xl p-6">
      <p className="label">Step 2 of 2</p>
      <h1 className="text-xl font-semibold">A trade proposal for you</h1>
      {body}
    </section>
  );

  if (created) {
    const isBuyer = deal?.buyer === address;
    return frame(
      <div className="mt-3 space-y-3 text-sm">
        <p className="font-medium text-brand-dark">The trade is created and both of you have signed its terms.</p>
        <p className="text-ink/70">
          {isBuyer ? "Next, deposit the payment so the farmer can deliver." : "Next, the buyer deposits the payment."}
        </p>
        <Link href={`/${isBuyer ? "buyer" : "farmer"}?trade=${created}`} className="btn-brand">
          Open the trade
        </Link>
      </div>,
    );
  }
  if (!address) {
    return frame(
      <div className="mt-3 space-y-3">
        <p className="text-sm text-ink/70">Connect the wallet this proposal was sent to.</p>
        <button className="btn-brand" onClick={connect}>
          Connect wallet
        </button>
      </div>,
    );
  }
  if (error) {
    return frame(<p className="mt-3 rounded-xl border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>);
  }
  if (!deal) return frame(<p className="mt-3 text-sm text-ink/70">Reading the proposal…</p>);

  const me = deal.receiver === deal.buyer ? "buyer" : "farmer";
  const fee = fees ? bps(deal.amount, fees.trade_fee_bps) : null;
  const expired = deal.expiresAt.getTime() < Date.now();

  async function agree() {
    const out = await run({
      title: "Agree and create the trade",
      detail: `${formatUsdc(deal!.amount)} between ${short(deal!.buyer, 4)} and ${short(deal!.seller, 4)}`,
      kind: "platform",
      execute: (_s, onStep) => completeDeal(deal!, onStep),
    });
    if (out && typeof out.result === "string" && out.result) setCreated(out.result);
  }

  return frame(
    <div className="mt-4 space-y-4">
      <p className="text-sm text-ink/70">
        {short(deal.proposer)} has signed these terms and asks you, as the {me}, to sign them too.
      </p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="col-span-2 border-t border-ink/10 pt-2">
          <dt className="label">Price</dt>
          <dd className="text-2xl font-semibold">{formatUsdc(deal.amount)}</dd>
        </div>
        <div className="border-t border-ink/10 pt-2">
          <dt className="label">Buyer</dt>
          <dd className="font-mono">
            {short(deal.buyer, 4)}
            {me === "buyer" && " (you)"}
          </dd>
        </div>
        <div className="border-t border-ink/10 pt-2">
          <dt className="label">Farmer</dt>
          <dd className="font-mono">
            {short(deal.seller, 4)}
            {me === "farmer" && " (you)"}
          </dd>
        </div>
        <div className="border-t border-ink/10 pt-2">
          <dt className="label">Deadline</dt>
          <dd>{formatDate(deal.deadline)}</dd>
        </div>
        <div className="border-t border-ink/10 pt-2">
          <dt className="label">Trade fee</dt>
          <dd>{fees && fee !== null ? `${formatUsdc(fee)} (${pct(fees.trade_fee_bps)}, paid by the buyer)` : "…"}</dd>
        </div>
      </dl>
      <p className="text-xs text-ink/70">
        Signing creates the trade on Avocate with these terms. No money moves yet: the buyer deposits the payment in the
        next step. The fees are the platform's current ones.
      </p>
      <p className="text-xs text-ink/70">
        {expired
          ? "This proposal has expired. Ask for a new one."
          : `Valid until ${deal.expiresAt.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}.`}
      </p>
      <button className="btn-brand w-full" disabled={expired} onClick={agree}>
        Agree and sign
      </button>
    </div>,
  );
}
