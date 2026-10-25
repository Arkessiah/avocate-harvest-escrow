import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { WalletError } from "@/components/WalletError";
import { HistoryPanel } from "@/components/HistoryPanel";
import { ROLES, type Role } from "@/lib/roles";

export function AppShell({ role, children }: { role?: Role; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* useSearchParams in the header needs a Suspense boundary for static rendering. */}
      <Suspense>
        <AppHeader />
      </Suspense>
      <WalletError />

      {role && (
        <section className="mb-8 max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight">{ROLES[role].label}</h1>
          <p className="mt-1 text-sm text-ink/70">{ROLES[role].intro}</p>
          {"trades" in ROLES[role] && (
            <p className="mt-2 text-xs text-ink/70">Share this page's link to watch the same trade from another role.</p>
          )}
        </section>
      )}

      {children}

      {role && <HistoryPanel tradePath={"trades" in ROLES[role] ? `/${role}` : "/buyer"} />}

      <footer className="mt-12 text-center text-xs text-ink/70">
        Beta on Stellar testnet. No real money moves here.
      </footer>
    </main>
  );
}
