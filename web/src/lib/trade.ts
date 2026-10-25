import { network } from "@/lib/network";
import { read, variant } from "@/lib/chain";
import { bps } from "@/lib/usdc";

export type TradeState = "Pending" | "Funded" | "Released" | "Refunded";

export interface TradeConfig {
  buyer: string;
  seller: string;
  platform: string;
  agent: string;
  validator: string;
  pool: string;
  token: string;
  amount: bigint;
  trade_fee_bps: number;
  financing_fee_bps: number;
  pool_yield_bps: number;
  deadline: bigint;
}

export interface Trade {
  id: string;
  config: TradeConfig;
  state: TradeState;
  validation: { ok: boolean; report_hash: Uint8Array } | null;
  advance: { principal: bigint; repay: bigint } | null;
  tradeFee: bigint;
}

export class NotAvocateTrade extends Error {
  constructor() {
    super("This address is not a trade created on the Avocate platform.");
  }
}

// The platform's registry is checked first: any contract can mimic the escrow's methods,
// and only the registry proves the terms were set by Avocate.
// `registered` skips the registry check for ids that were just read from the registry.
export async function readTrade(id: string, registered = false): Promise<Trade> {
  if (!registered && !(await read<boolean>(network.contracts.platform, "is_escrow", { escrow: id }))) {
    throw new NotAvocateTrade();
  }
  const [config, state, validation, advance] = await Promise.all([
    read<TradeConfig>(id, "config"),
    read<unknown>(id, "state"),
    read<Trade["validation"] | undefined>(id, "validation"),
    read<Trade["advance"] | undefined>(id, "advance"),
  ]);
  return {
    id,
    config,
    state: variant(state) as TradeState,
    validation: validation ?? null,
    advance: advance ?? null,
    tradeFee: bps(config.amount, config.trade_fee_bps),
  };
}

export const STATE_BADGE: Record<TradeState, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Funded: "bg-brand/10 text-brand-dark",
  Released: "bg-emerald-100 text-emerald-800",
  Refunded: "bg-rose-100 text-rose-800",
};

export const STATE_TEXT: Record<TradeState, string> = {
  Pending: "Waiting for the buyer's deposit",
  Funded: "Money locked, waiting for delivery",
  Released: "Paid to the farmer",
  Refunded: "Returned to the buyer",
};

export const formatDate = (unixSeconds: bigint) =>
  new Date(Number(unixSeconds) * 1000).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
