"use client";

import { useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { forgetDemoWallet, openDemoWallet } from "@/lib/demo-wallet";
import { setEntryRole, type EntryRole } from "@/lib/entry-role";

interface Card {
  role: EntryRole;
  path: string;
  title: string;
  line: string;
  does: string[];
  // Roles that act with a prepared demo account; the others need none to look around.
  demo: "wallet" | "enter";
  span: string;
}

const CARDS: Card[] = [
  {
    role: "buyer",
    path: "/buyer",
    title: "Professional buyer",
    line: "Lock the price. Pay only for what arrives.",
    does: ["Agree a trade online or face to face with a QR code", "Lock USDC, or pay in XLM", "Approve a farmer's advance"],
    demo: "wallet",
    span: "lg:col-span-3",
  },
  {
    role: "farmer",
    path: "/farmer",
    title: "Farmer",
    line: "Paid in seconds, or up to 80% before delivery.",
    does: ["Propose a trade to a buyer", "Request an advance from the investor pool", "Receive USDC the moment delivery is confirmed"],
    demo: "wallet",
    span: "lg:col-span-3",
  },
  {
    role: "pool",
    path: "/pool",
    title: "Pool investor",
    line: "Fund farmers' advances and earn the yield.",
    does: ["Deposit and withdraw USDC", "Follow every open advance"],
    demo: "wallet",
    span: "lg:col-span-2",
  },
  {
    role: "validator",
    path: "/validator",
    title: "Validator",
    line: "Inspect the delivery, record one verdict on-chain.",
    does: ["Mark a delivery conforming or rejected", "A demo inspector signs for you"],
    demo: "enter",
    span: "lg:col-span-2",
  },
  {
    role: "admin",
    path: "/admin",
    title: "Avocate admin",
    line: "Every trade, the pool and the AI agent.",
    does: ["Fees, farmer onboarding and the registry", "Run the agent that settles over x402"],
    demo: "enter",
    span: "lg:col-span-2",
  },
];

export function RolePicker() {
  const { connect } = useWallet();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A full load, so the header and the wallet start from the chosen role.
  const go = (card: Card) => window.location.assign(card.path);

  async function tryDemo(card: Card) {
    setBusy(card.role);
    setError(null);
    try {
      await openDemoWallet({ role: card.role });
      setEntryRole(card.role);
      go(card);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demo wallets are not available right now.");
      setBusy(null);
    }
  }

  async function useOwn(card: Card) {
    setError(null);
    forgetDemoWallet();
    setEntryRole(card.role);
    if (await connect()) go(card);
  }

  function enter(card: Card) {
    setEntryRole(card.role);
    go(card);
  }

  return (
    <div>
      <section className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Choose your role</h1>
        <p className="mt-2 text-ink/70">
          Each role sees its own screen. Try any of them with a demo wallet: a test account with test USDC, ready to use
          without installing anything.
        </p>
      </section>

      {error && (
        <p className="mt-5 rounded-xl border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-6">
        {CARDS.map((card, i) => (
          <article key={card.role} className={`${i < 2 ? "card-highlight" : "card"} flex flex-col p-6 sm:p-7 ${card.span}`}>
            <h2 className={`font-semibold tracking-tight ${i < 2 ? "text-2xl" : "text-xl"}`}>{card.title}</h2>
            <p className="mt-1 text-ink/70">{card.line}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-ink/70">
              {card.does.map((d) => (
                <li key={d} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  {d}
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-wrap gap-2 pt-6">
              {card.demo === "wallet" ? (
                <>
                  <button className="btn-brand" onClick={() => tryDemo(card)} disabled={busy !== null}>
                    {busy === card.role ? "Opening…" : "Try with a demo wallet"}
                  </button>
                  <button className="btn-ghost" onClick={() => useOwn(card)} disabled={busy !== null}>
                    Use my wallet
                  </button>
                </>
              ) : (
                <button className="btn-brand" onClick={() => enter(card)}>
                  Enter
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <p className="mt-6 text-xs text-ink/70">
        Demo wallets are shared test accounts on Stellar testnet. Anyone with the same demo can use them, and they hold no
        real money.
      </p>
    </div>
  );
}
