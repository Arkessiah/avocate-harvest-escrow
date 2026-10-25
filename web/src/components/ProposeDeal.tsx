"use client";

import { useEffect, useMemo, useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import { useWallet } from "@/components/WalletProvider";
import { useTx } from "@/components/TxProvider";
import { QrCode } from "@/components/QrCode";
import { network } from "@/lib/network";
import { read, type Fees } from "@/lib/chain";
import { pct } from "@/lib/format";
import { bps, formatUsdc, toUnits } from "@/lib/usdc";
import { proposeDeal } from "@/lib/deal";

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// The connected wallet proposes a sale as `side`; the counterparty completes it from a link
// or by scanning the QR code with their phone.
export function ProposeDeal({ side }: { side: "buyer" | "farmer" }) {
  const { address, connect } = useWallet();
  const run = useTx();
  const other = side === "buyer" ? "farmer" : "buyer";
  const [fees, setFees] = useState<Fees | null>(null);
  const [counterparty, setCounterparty] = useState("");
  const [price, setPrice] = useState("1000");
  const [deadline, setDeadline] = useState(() => isoDay(Date.now() + 30 * DAY));
  const [link, setLink] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    read<Fees>(network.contracts.platform, "fees").then(setFees, () => setFees(null));
  }, []);

  const amount = toUnits(price);
  const deadlineTs = Math.floor(new Date(`${deadline}T23:59:59`).getTime() / 1000);
  const problem = useMemo(() => {
    if (!StrKey.isValidEd25519PublicKey(counterparty.trim())) return `Enter the ${other}'s Stellar address (G…).`;
    if (counterparty.trim() === address) return `The ${other} must be a different account from yours.`;
    if (!amount || amount <= 0n) return "Enter a price above zero.";
    if (!(deadlineTs > Date.now() / 1000)) return "Pick a deadline in the future.";
    return null;
  }, [counterparty, address, amount, deadlineTs, other]);

  async function propose() {
    if (!address) return void connect();
    if (problem || !amount) return;
    const me = address;
    const them = counterparty.trim();
    const terms = {
      buyer: side === "buyer" ? me : them,
      seller: side === "buyer" ? them : me,
      amount,
      deadline: BigInt(deadlineTs),
    };
    const out = await run({
      title: "Propose a trade",
      detail: `${formatUsdc(amount)} with ${them.slice(0, 6)}…, deadline ${deadline}`,
      kind: "platform",
      execute: async (_s, onStep) => ({ hash: "", result: await proposeDeal(terms, me, onStep) }),
    });
    if (out && typeof out.result === "string") {
      setLink(`${window.location.origin}/deal#d=${out.result}`);
      setValidUntil(new Date(Date.now() + 3600_000));
      setCopied(false);
    }
  }

  if (link) {
    return (
      <section className="card p-6">
        <p className="label">Step 1 of 2 done</p>
        <h2 className="text-lg font-semibold">Show this to the {other}</h2>
        <p className="mt-1 text-sm text-ink/70">
          They scan the code with their phone camera, or open the link, review the terms and sign. The trade is created at
          that moment. Valid until {validUntil?.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}.
        </p>
        <div className="mt-4">
          <QrCode value={link} label={`QR code with the trade proposal for the ${other}`} />
        </div>
        <div className="mt-4 flex gap-2">
          <input className="input font-mono text-xs" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Proposal link" />
          <button className="btn-brand shrink-0" onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <button className="mt-3 text-sm text-brand-dark hover:underline" onClick={() => setLink(null)}>
          Propose another trade
        </button>
      </section>
    );
  }

  const fee = amount && fees ? bps(amount, fees.trade_fee_bps) : null;

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Agree a trade on the spot</h2>
      <p className="mt-1 text-sm text-ink/70">
        Both of you sign the terms. You propose and sign first; the {other} completes it from a link, or by scanning a QR
        code if you are together.
      </p>
      <div className="mt-5 grid gap-4">
        <div>
          <label className="label" htmlFor={`deal-${side}-other`}>
            The {other}'s address
          </label>
          <input
            id={`deal-${side}-other`}
            className="input font-mono"
            placeholder="G…"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor={`deal-${side}-price`}>
              Price (USDC)
            </label>
            <input id={`deal-${side}-price`} className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor={`deal-${side}-deadline`}>
              Deadline
            </label>
            <input
              id={`deal-${side}-deadline`}
              className="input"
              type="date"
              min={isoDay(Date.now() + DAY)}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>
        {amount && fee !== null && fees && (
          <p className="text-xs text-ink/70">
            The buyer will deposit {formatUsdc(amount + fee)}: the price plus the {pct(fees.trade_fee_bps)} trade fee.
          </p>
        )}
      </div>
      <button className="btn-brand mt-5 w-full" onClick={propose} disabled={!!address && !!problem}>
        {address ? "Sign and create the QR code" : "Connect wallet to propose"}
      </button>
      {address && problem && <p className="mt-2 text-sm text-ink/70">{problem}</p>}
    </section>
  );
}
