"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useWallet } from "@/components/WalletProvider";
import { TxDialog, type TxState } from "@/components/TxDialog";
import { describeError, type ContractKind } from "@/lib/errors";
import { invoke, type Invocation } from "@/lib/tx";
import { addHistory } from "@/lib/history";

type Executor = (source: string, onStep: (step: string) => void) => Promise<{ hash: string; result: unknown }>;

// Either a plain contract call, or a custom sequence of steps (such as a co-signed advance).
// `trade` links the history entry to a trade when the call is not made on the escrow itself.
export type TxRequest = { title: string; detail: string; kind: ContractKind; trade?: string } & (
  | (Invocation & { execute?: undefined })
  | { execute: Executor; wallet?: false }
);

type Run = (request: TxRequest) => Promise<{ hash: string; result: unknown } | null>;

const TxContext = createContext<Run | null>(null);

// Every on-chain action goes through here, so none of them happens without the dialog
// listing its steps and, at the end, the transaction on the explorer.
export function TxProvider({ children }: { children: ReactNode }) {
  const { address, connect } = useWallet();
  const [state, setState] = useState<TxState | null>(null);

  const run = useCallback<Run>(
    async (request) => {
      const { title, detail, kind } = request;
      // Calls signed by a server-side service account need no wallet from the user.
      const needsWallet = !("wallet" in request && request.wallet === false);
      const source = needsWallet ? address ?? (await connect()) : "";
      if (source === null) return null;

      setState({ title, detail, steps: [], status: "running" });
      const onStep = (step: string) => setState((s) => s && { ...s, steps: [...s.steps, step] });
      try {
        const out = request.execute ? await request.execute(source, onStep) : await invoke(request, source, onStep);
        setState((s) => s && { ...s, status: "ok", hash: out.hash });
        // A call on the escrow is about that trade; creating a trade returns the new one's address.
        const created = typeof out.result === "string" && /^C[A-Z2-7]{55}$/.test(out.result) ? out.result : undefined;
        const trade = request.trade ?? (!request.execute && kind === "escrow" ? request.contractId : created);
        addHistory({ ts: Date.now(), title, detail, hash: out.hash || undefined, trade });
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
