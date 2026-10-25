"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useWallet } from "@/components/WalletProvider";
import { TxDialog, type TxState } from "@/components/TxDialog";
import { describeError, type ContractKind } from "@/lib/errors";
import { invoke, type Invocation } from "@/lib/tx";

export interface TxRequest extends Invocation {
  title: string;
  detail: string;
  kind: ContractKind;
}

type Run = (request: TxRequest) => Promise<{ hash: string; result: unknown } | null>;

const TxContext = createContext<Run | null>(null);

// Every on-chain action goes through here, so none of them happens without the dialog
// listing its steps and, at the end, the transaction on the explorer.
export function TxProvider({ children }: { children: ReactNode }) {
  const { address, connect } = useWallet();
  const [state, setState] = useState<TxState | null>(null);

  const run = useCallback<Run>(
    async ({ title, detail, kind, ...call }) => {
      const source = address ?? (await connect());
      if (!source) return null;

      setState({ title, detail, steps: [], status: "running" });
      const onStep = (step: string) => setState((s) => s && { ...s, steps: [...s.steps, step] });
      try {
        const out = await invoke(call, source, onStep);
        setState((s) => s && { ...s, status: "ok", hash: out.hash });
        return out;
      } catch (e) {
        setState((s) => s && { ...s, status: "error", error: describeError(e, kind) });
        return null;
      }
    },
    [address, connect],
  );

  return (
    <TxContext.Provider value={run}>
      {children}
      <TxDialog state={state} onClose={() => setState(null)} />
    </TxContext.Provider>
  );
}

export function useTx(): Run {
  const ctx = useContext(TxContext);
  if (!ctx) throw new Error("useTx must be used inside TxProvider");
  return ctx;
}
