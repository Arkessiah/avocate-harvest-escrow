"use client";

import { useEffect, useState } from "react";

const CHECK_EVERY_MS = 5 * 60 * 1000;

async function currentVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    return res.ok ? ((await res.json()) as { version: string }).version : null;
  } catch {
    return null;
  }
}

// A tab opened before a deployment keeps running the old code until it is reloaded. This
// notices a newer deployment when the tab comes back into view (and every few minutes) and
// offers the reload instead of forcing it, so a signature in progress is never cut off.
export function UpdateNotice() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let loaded: string | null = null;
    const check = async () => {
      const v = await currentVersion();
      if (!v) return;
      if (loaded === null) loaded = v;
      else if (v !== loaded) setStale(true);
    };
    check();
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  if (!stale) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-xl border border-ink/10 bg-surface px-4 py-3 text-sm shadow-lg">
        <span>A new version of the app is available.</span>
        <button type="button" className="btn-brand px-3 py-1.5 text-sm" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    </div>
  );
}
