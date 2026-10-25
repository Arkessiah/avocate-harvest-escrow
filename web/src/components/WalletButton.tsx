"use client";

import { useWallet } from "@/components/WalletProvider";
import { short } from "@/lib/format";

export function WalletButton() {
  const { address, connecting, connect, disconnect } = useWallet();

  if (address) {
    return (
      <button
        className="card-glass inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-brand-dark hover:bg-white"
        onClick={disconnect}
        title="Disconnect wallet"
      >
        <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
        <span className="font-mono">{short(address, 4)}</span>
        <span className="sr-only">Disconnect wallet</span>
      </button>
    );
  }

  return (
    <button className="btn-brand" onClick={connect} disabled={connecting}>
      {connecting ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
