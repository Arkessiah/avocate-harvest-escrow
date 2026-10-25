"use client";

import type { ReactNode } from "react";
import { WalletProvider } from "@/components/WalletProvider";
import { TxProvider } from "@/components/TxProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <TxProvider>{children}</TxProvider>
    </WalletProvider>
  );
}
