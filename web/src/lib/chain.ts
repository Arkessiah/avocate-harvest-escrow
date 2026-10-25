import { contract } from "@stellar/stellar-sdk";
import { network } from "@/lib/network";

// Typed clients are generated from the spec each contract stores on chain, so arguments
// and results always match the deployed code. Cached per contract for the session.
const clients = new Map<string, Promise<contract.Client>>();

export function clientFor(contractId: string, publicKey?: string): Promise<contract.Client> {
  const key = `${contractId}:${publicKey ?? ""}`;
  let client = clients.get(key);
  if (!client) {
    client = contract.Client.from({
      contractId,
      rpcUrl: network.rpcUrl,
      networkPassphrase: network.passphrase,
      publicKey,
    });
    clients.set(key, client);
  }
  return client;
}

// Read-only call: simulated by the RPC, nothing is signed or paid.
export async function read<T>(contractId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  const client = (await clientFor(contractId)) as unknown as Record<
    string,
    (a: Record<string, unknown>) => Promise<{ result: T }>
  >;
  const tx = await client[method](args);
  return tx.result;
}

export interface Fees {
  trade_fee_bps: number;
  financing_fee_bps: number;
  pool_yield_bps: number;
}

// Unit enum variants decode as a string, a one-element array or `{ tag }` depending on how
// they were read; callers only ever need the variant name.
export function variant(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return String(value[0]);
  if (value && typeof value === "object" && "tag" in value) return String((value as { tag: unknown }).tag);
  return String(value);
}
