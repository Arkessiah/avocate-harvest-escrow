"use client";

import type { ReactNode } from "react";
import { WalletProvider } from "@/components/WalletProvider";
import { TxProvider } from "@/components/TxProvider";
import { UpdateNotice } from "@/components/UpdateNotice";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <TxProvider>
        {children}
        <UpdateNotice />
      </TxProvider>
    </WalletProvider>
  );
}
