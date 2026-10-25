"use client";

import { useWallet } from "@/components/WalletProvider";

export function WalletError() {
  const { error } = useWallet();
  if (!error) return null;
  return (
    <div role="alert" className="mb-6 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
      {error}
    </div>
  );
}
