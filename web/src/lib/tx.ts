"use client";

import { contract } from "@stellar/stellar-sdk";
import { network } from "@/lib/network";
import { signTransaction } from "@/lib/wallet";

export interface Invocation {
  contractId: string;
  method: string;
  args?: Record<string, unknown>;
}

type Methods = Record<string, (args: Record<string, unknown>) => Promise<contract.AssembledTransaction<unknown>>>;

// Runs one contract call signed by the connected wallet, reporting each stage so the
// transaction dialog can show it as it happens. Simulation happens while building: a call
// the contract would reject fails there, before the wallet is asked to sign anything.
export async function invoke(
  { contractId, method, args = {} }: Invocation,
  source: string,
  onStep: (step: string) => void,
): Promise<{ hash: string; result: unknown }> {
  onStep("Build and simulate the transaction");
  const client = await contract.Client.from({
    contractId,
    rpcUrl: network.rpcUrl,
    networkPassphrase: network.passphrase,
    publicKey: source,
  });
  const tx = await (client as unknown as Methods)[method](args);

  onStep("Sign in your wallet");
  await tx.sign({ signTransaction: (xdr) => signTransaction(xdr, source) });

  onStep("Submit to the network");
  const sent = await tx.send();
  const hash = sent.sendTransactionResponse?.hash ?? "";

  onStep("Confirmed on the ledger");
  return { hash, result: sent.result };
}
