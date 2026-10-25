import { network } from "@/lib/network";
import { read } from "@/lib/chain";
import { readTrade, type Trade } from "@/lib/trade";

const PAGE = 50; // the platform's maximum page size

// Reads every trade in the platform registry, newest first. Fine for a demo-sized registry;
// a production deployment would read this from an indexer of the platform's events.
export async function listTrades(): Promise<Trade[]> {
  const platform = network.contracts.platform;
  const count = await read<number>(platform, "escrow_count");
  const pages = await Promise.all(
    Array.from({ length: Math.ceil(count / PAGE) }, (_, i) =>
      read<string[]>(platform, "escrows", { start: i * PAGE, limit: PAGE }),
    ),
  );
  const ids = pages.flat().reverse();
  const trades = await Promise.allSettled(ids.map((id) => readTrade(id, true)));
  return trades.flatMap((t) => (t.status === "fulfilled" ? [t.value] : []));
}
