"use client";

import { useEffect, useState } from "react";
import { rememberDemoWallet } from "@/lib/demo-wallet";
import { ROLES, type Role } from "@/lib/roles";

// Landing point of a demo link (/demo#role=farmer&k=S…): keeps the test account in this
// browser, drops the secret from the address bar and opens the role's screen.
export default function DemoEntry() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const role = params.get("role") ?? "";
    try {
      rememberDemoWallet(params.get("k") ?? "");
      window.history.replaceState(null, "", "/demo");
      // A full load, so every screen starts with the demo wallet connected.
      window.location.replace(role in ROLES ? `/${role as Role}` : "/overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "This demo link could not be opened.");
    }
  }, []);

  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">{error ? "Demo wallet not opened" : "Opening the demo wallet…"}</h1>
      <p className="mt-2 text-sm text-ink/70">
        {error ?? "A prepared test account with test USDC. Nothing here moves real money."}
      </p>
    </main>
  );
}
