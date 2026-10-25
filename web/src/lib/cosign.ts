"use client";

import { Address, contract, rpc, scValToNative } from "@stellar/stellar-sdk";
import { network } from "@/lib/network";
import { signAuthEntry, signTransaction } from "@/lib/wallet";

// An advance needs two signatures in one transaction: the farmer's (they receive the cash)
// and the buyer's (they accept that the pool is repaid first if the trade lapses). The
// buyer is the transaction source, so the farmer signs only their authorization entry and
// hands the transaction over once; the buyer reviews it, signs the envelope and submits.

// How long the farmer's signature stays valid: one hour of ledgers (~5 s each).
const VALID_LEDGERS = 720;
const VALID_SECONDS = 3600;

const poolClient = (source: string) =>
  contract.Client.from({
    contractId: network.contracts.pool,
    rpcUrl: network.rpcUrl,
    networkPassphrase: network.passphrase,
    publicKey: source,
  });

type AdvanceCall = (
  args: { escrow: string; principal: bigint },
  opts: { timeoutInSeconds: number },
) => Promise<contract.AssembledTransaction<null>>;

export async function signAdvanceRequest(
  { escrow, principal, buyer, farmer }: { escrow: string; principal: bigint; buyer: string; farmer: string },
  onStep: (step: string) => void,
): Promise<string> {
  onStep("Build and simulate the advance");
  const pool = (await poolClient(buyer)) as unknown as { advance: AdvanceCall };
  const tx = await pool.advance({ escrow, principal }, { timeoutInSeconds: VALID_SECONDS });

  const signers = tx.needsNonInvokerSigningBy();
  if (signers.length !== 1 || signers[0] !== farmer) {
    throw new Error("This wallet is not the farmer of this trade.");
  }

  onStep("Sign your part in the wallet");
  const { sequence } = await new rpc.Server(network.rpcUrl).getLatestLedger();
  await tx.signAuthEntries({
    address: farmer,
    expiration: sequence + VALID_LEDGERS,
    signAuthEntry: (entry) => signAuthEntry(entry, farmer),
  });

  onStep("Request ready to share");
  return toLink(tx.toJSON());
}

const toLink = (json: string) => btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromLink = (code: string) => atob(code.replace(/-/g, "+").replace(/_/g, "/"));

export interface AdvanceRequest {
  escrow: string;
  principal: bigint;
  source: string;
  expiresAt: Date;
  tx: contract.AssembledTransaction<null>;
}

// XDR accessors are methods in some SDK builds and plain properties in others.
const get = (obj: unknown, key: string): unknown => {
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "function" ? (v as () => unknown).call(obj) : v;
};

// Everything shown to the buyer is read back from the transaction they are about to sign,
// never from extra fields in the link: a tampered link can only produce a transaction
// that fails these checks or that the buyer can see for what it is.
export async function readAdvanceRequest(code: string, buyer: string): Promise<AdvanceRequest> {
  let json: string;
  try {
    json = fromLink(code);
  } catch {
    throw new Error("This advance link is damaged. Ask the farmer to send it again.");
  }
  const pool = await poolClient(buyer);
  const tx = pool.txFromJSON<null>(json);
  const built = tx.built;
  const op = built?.operations[0] as { type: string; func: unknown } | undefined;
  if (!built || built.operations.length !== 1 || op?.type !== "invokeHostFunction") {
    throw new Error("This link does not contain an advance request.");
  }
  const call = get(op.func, "invokeContract");
  const target = Address.fromScAddress(get(call, "contractAddress") as never).toString();
  const fn = String(get(call, "functionName"));
  const args = (get(call, "args") as never[]).map((a) => scValToNative(a));
  if (target !== network.contracts.pool || fn !== "advance" || args.length !== 2) {
    throw new Error("This link asks for something other than an advance from the Avocate pool.");
  }
  if (built.source !== buyer) {
    throw new Error("This request was prepared for another buyer's account.");
  }
  return {
    escrow: String(args[0]),
    principal: BigInt(args[1] as bigint),
    source: built.source,
    expiresAt: new Date(Number(built.timeBounds?.maxTime ?? 0) * 1000),
    tx,
  };
}

export async function submitAdvance(request: AdvanceRequest, buyer: string, onStep: (step: string) => void) {
  onStep("Sign in your wallet");
  await request.tx.sign({ signTransaction: (xdr) => signTransaction(xdr, buyer) });
  onStep("Submit to the network");
  const sent = await request.tx.send();
  onStep("Confirmed on the ledger");
  return { hash: sent.sendTransactionResponse?.hash ?? "", result: null };
}
