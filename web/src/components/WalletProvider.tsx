"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { connectWallet, disconnectWallet } from "@/lib/wallet";
import { demoKeypair } from "@/lib/demo-wallet";
import { closedByUser, describeError } from "@/lib/errors";

interface WalletState {
  address: string | null;
  // True when a prepared test account signs in this browser instead of a wallet extension.
  demo: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<string | null>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  // A demo wallet opened from a link stays connected across pages and reloads.
  useEffect(() => {
    const kp = demoKeypair();
    if (kp) {
      setAddress(kp.publicKey());
      setDemo(true);
    }
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const a = await connectWallet();
      setAddress(a);
      return a;
    } catch (e) {
      if (!closedByUser(e)) setError(describeError(e));
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectWallet().catch(() => undefined);
    setAddress(null);
    setDemo(false);
  }, []);

  return (
    <WalletContext.Provider value={{ address, demo, connecting, error, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
