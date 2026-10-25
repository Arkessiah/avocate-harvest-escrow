"use client";

import { useEffect, useRef } from "react";
import { network } from "@/lib/network";
import { short } from "@/lib/format";

export interface TxState {
  title: string;
  detail: string;
  steps: string[];
  status: "running" | "ok" | "error";
  hash?: string;
  error?: string;
}

export function TxDialog({ state, onClose }: { state: TxState | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const running = state?.status === "running";

  useEffect(() => {
    if (!state || running) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, running, onClose]);

  if (!state) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={running ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-title"
        className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-ink/5 px-5 py-4">
          <p className="label">On-chain action</p>
          <h3 id="tx-title" className="text-lg font-semibold">
            {state.title}
          </h3>
          <p className="mt-0.5 text-sm text-ink/70">{state.detail}</p>
        </div>

        <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4" aria-live="polite">
          {state.steps.map((step, i) => {
            const failed = state.status === "error" && i === state.steps.length - 1;
            const pending = running && i === state.steps.length - 1;
            return (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                    failed ? "bg-danger-tint text-danger" : pending ? "bg-brand/20 text-brand-dark" : "bg-brand-dark text-white"
                  }`}
                  aria-hidden
                >
                  {failed ? "✕" : pending ? <Spinner /> : "✓"}
                </span>
                <span className={pending ? "text-ink" : "text-ink/70"}>{step}</span>
              </li>
            );
          })}
        </ol>

        <div className="shrink-0 border-t border-ink/5 px-5 py-4">
          {state.status === "ok" && !state.hash && <p className="mb-3 text-sm font-medium text-brand-dark">Done.</p>}
          {state.status === "ok" && state.hash && (
            <div className="mb-3 space-y-1">
              <p className="text-sm font-medium text-brand-dark">Done.</p>
              <a
                href={`${network.explorerTx}${state.hash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 break-all text-sm text-brand-dark hover:underline"
              >
                View on the explorer · {short(state.hash)} ↗
              </a>
            </div>
          )}
          {state.status === "error" && (
            <p className="mb-3 rounded-xl border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}
          {running && <p className="mb-3 text-sm text-ink/70">Keep this window open until it finishes.</p>}
          <button ref={closeRef} className="btn-ghost w-full" disabled={running} onClick={onClose}>
            {running ? "Working…" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />;
}
