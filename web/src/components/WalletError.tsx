"use client";

import { useWallet } from "@/components/WalletProvider";

export function WalletError() {
  const { error } = useWallet();
  if (!error) return null;
  return (
    <div role="alert" className="mb-6 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-rose-700">
      {error}
    </div>
  );
}
