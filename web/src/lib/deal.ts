"use client";

import { Address, TransactionBuilder, contract, rpc, scValToNative, type Transaction } from "@stellar/stellar-sdk";
import { network } from "@/lib/network";
import { pack, unpack } from "@/lib/pack";
import { signAuthEntry, signTransaction } from "@/lib/wallet";

// A sale agreed on the spot. Whoever proposes signs their authorization of `create_trade`
// with the other party set as the transaction source; the other party opens the link (or
// scans the QR), reviews it, signs the envelope and submits. One hand-off, either direction.

export interface DealTerms {
  buyer: string;
  seller: string;
  amount: bigint;
  deadline: bigint;
}

const VALID_LEDGERS = 720; // the proposer's signature lasts about an hour
const VALID_SECONDS = 3600;

type CreateTrade = (
  args: DealTerms,
  opts: { timeoutInSeconds: number },
) => Promise<contract.AssembledTransaction<string>>;

export async function proposeDeal(terms: DealTerms, proposer: string, onStep: (s: string) => void): Promise<string> {
  const receiver = proposer === terms.buyer ? terms.seller : terms.buyer;
  onStep("Build and simulate the trade");
  const platform = (await contract.Client.from({
    contractId: network.contracts.platform,
    rpcUrl: network.rpcUrl,
    networkPassphrase: network.passphrase,
    publicKey: receiver,
  })) as unknown as { create_trade: CreateTrade };
  const tx = await platform.create_trade(terms, { timeoutInSeconds: VALID_SECONDS });

  const signers = tx.needsNonInvokerSigningBy();
  if (signers.length !== 1 || signers[0] !== proposer) throw new Error("This wallet is not a party to the deal.");

  onStep("Sign your part in the wallet");
  const { sequence } = await new rpc.Server(network.rpcUrl).getLatestLedger();
  await tx.signAuthEntries({
    address: proposer,
    expiration: sequence + VALID_LEDGERS,
    signAuthEntry: (entry) => signAuthEntry(entry, proposer),
  });

  onStep("Proposal ready to share");
  // Only the transaction travels: it already carries the simulated resources and the
  // proposer's signature, so the receiver can sign and submit it as it is.
  return pack(Uint8Array.from(atob(tx.built!.toXDR()), (c) => c.charCodeAt(0)));
}

export interface Deal extends DealTerms {
  proposer: string;
  receiver: string;
  expiresAt: Date;
  xdr: string;
}

const get = (obj: unknown, key: string): unknown => {
  if (obj == null) return undefined;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "function" ? (v as () => unknown).call(obj) : v;
};

// Everything shown is read back from the transaction the receiver is about to sign. A
// tampered link either fails these checks or no longer carries a valid signature.
export async function readDeal(code: string, me: string): Promise<Deal> {
  let tx: Transaction;
  try {
    const bytes = await unpack(code);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    tx = TransactionBuilder.fromXDR(btoa(binary), network.passphrase) as Transaction;
  } catch {
    throw new Error("This link is damaged. Ask for it to be sent again.");
  }
  const op = tx.operations[0] as { type: string; func?: unknown } | undefined;
  if (tx.operations.length !== 1 || op?.type !== "invokeHostFunction") {
    throw new Error("This link does not contain a trade proposal.");
  }
  const call = get(op.func, "invokeContract");
  const target = Address.fromScAddress(get(call, "contractAddress") as never).toString();
  const fn = String(get(call, "functionName"));
  const args = (get(call, "args") as never[]).map((a) => scValToNative(a));
  if (target !== network.contracts.platform || fn !== "create_trade" || args.length !== 4) {
    throw new Error("This link asks for something other than an Avocate trade.");
  }
  const [buyer, seller, amount, deadline] = [String(args[0]), String(args[1]), BigInt(args[2]), BigInt(args[3])];
  if (tx.source !== me || (me !== buyer && me !== seller)) {
    throw new Error("This proposal was prepared for another account. Connect the wallet it was sent to.");
  }
  return {
    buyer,
    seller,
    amount,
    deadline,
    proposer: me === buyer ? seller : buyer,
    receiver: me,
    expiresAt: new Date(Number(tx.timeBounds?.maxTime ?? 0) * 1000),
    xdr: tx.toXDR(),
  };
}

export async function completeDeal(deal: Deal, onStep: (s: string) => void): Promise<{ hash: string; result: string }> {
  onStep("Sign in your wallet");
  const { signedTxXdr } = await signTransaction(deal.xdr, deal.receiver);
  onStep("Submit to the network");
  const server = new rpc.Server(network.rpcUrl);
  const sent = await server.sendTransaction(TransactionBuilder.fromXDR(signedTxXdr, network.passphrase));
  if (sent.status === "ERROR" || sent.status === "TRY_AGAIN_LATER") {
    const code = (get(get(sent.errorResult, "result"), "switch") as { name?: string } | undefined)?.name;
    throw new Error(`The network refused the transaction (${code ?? sent.status}).`);
  }
  const done = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (done.status !== "SUCCESS") throw new Error(`The trade was not created (${done.status}).`);
  onStep("Confirmed on the ledger");
  return { hash: sent.hash, result: String(done.returnValue ? scValToNative(done.returnValue) : "") };
}
