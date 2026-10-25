"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StrKey } from "@stellar/stellar-sdk";
import { NotAvocateTrade, readTrade, type Trade } from "@/lib/trade";
import { describeError } from "@/lib/errors";

// The trade on screen lives in the URL (?trade=C...), so a link opens the same trade in
// any role and the browser's back button works as expected.
export function useTradeParam(): [string | null, (id: string | null) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const id = params.get("trade");
  const set = useCallback(
    (next: string | null) => router.replace(next ? `${path}?trade=${next}` : path, { scroll: false }),
    [router, path],
  );
  return [id, set];
}

export function useTrade(id: string | null) {
  const [trade, setTrade] = useState<Trade | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    if (!StrKey.isValidContract(id)) {
      setError("That is not a contract address. Trade addresses start with C.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setTrade(await readTrade(id));
    } catch (e) {
      setTrade(null);
      setError(e instanceof NotAvocateTrade ? e.message : describeError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setTrade(null);
    setError(null);
    refresh();
  }, [refresh]);

  return { trade, error, loading, refresh };
}
