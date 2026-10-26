"use client";

import { useWallet } from "@/components/WalletProvider";
import { short } from "@/lib/format";
import { setEntryRole } from "@/lib/entry-role";

export function WalletButton() {
  const { address, demo, connecting, connect, disconnect } = useWallet();

  // Leaving also forgets the role picked on entry, so the role screen offers every option
  // again, with any wallet.
  async function leave() {
    await disconnect();
    setEntryRole(null);
    window.location.assign("/app");
  }

  if (address) {
    return (
      <div className="card inline-flex items-center gap-2 py-1.5 pl-3 pr-1.5 text-sm font-medium">
        <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
        {demo && <span className="chip">Demo</span>}
        <span className="font-mono text-brand-dark" title={address}>
          {short(address, 4)}
        </span>
        <button className="rounded-lg px-2 py-1 text-xs text-ink/70 hover:bg-mist hover:text-ink" onClick={leave}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button className="btn-brand" onClick={connect} disabled={connecting}>
      {connecting ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
