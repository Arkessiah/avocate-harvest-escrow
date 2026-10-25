"use client";

import { Asset, BASE_FEE, Horizon, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { network } from "@/lib/network";
import { read } from "@/lib/chain";
import { invoke } from "@/lib/tx";
import { signTransaction } from "@/lib/wallet";

// Paying a trade in XLM: Soroswap's router swaps exactly the USDC still missing, then the
// buyer funds the trade as usual. Two transactions, because Soroban allows one contract
// call per transaction.

const PATH = () => [network.xlm.contract, network.usdc.contract];
// Accept up to 1% more XLM than quoted, so a small price move between quote and signature
// does not make the swap fail, and a large one does.
const SLIPPAGE_BPS = 100n;

// The router returns a contract `Result`; the client decodes it as an object with
// `unwrap()`, which throws the router's error if the quote failed.
export async function quoteXlmFor(usdcOut: bigint): Promise<bigint> {
  const result = await read<{ unwrap(): bigint[] }>(network.soroswap.router, "router_get_amounts_in", {
    amount_out: usdcOut,
    path: PATH(),
  });
  return result.unwrap()[0];
}

export const withSlippage = (xlm: bigint) => xlm + (xlm * SLIPPAGE_BPS) / 10_000n;

export async function xlmBalance(owner: string): Promise<bigint> {
  return read<bigint>(network.xlm.contract, "balance", { id: owner });
}

// USDC is a classic asset: an account must hold a trustline before it can receive it.
export async function hasUsdcTrustline(owner: string): Promise<boolean> {
  try {
    await read<bigint>(network.usdc.contract, "balance", { id: owner });
    return true;
  } catch {
    return false;
  }
}

async function addUsdcTrustline(owner: string): Promise<string> {
  const [code, issuer] = network.usdc.asset.split(":");
  const horizon = new Horizon.Server(network.horizonUrl);
  const account = await horizon.loadAccount(owner);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: network.passphrase })
    .addOperation(Operation.changeTrust({ asset: new Asset(code, issuer) }))
    .setTimeout(180)
    .build();
  const { signedTxXdr } = await signTransaction(tx.toXDR(), owner);
  const res = await horizon.submitTransaction(TransactionBuilder.fromXDR(signedTxXdr, network.passphrase));
  return res.hash;
}

export async function swapThenFund(
  { buyer, escrow, usdcNeeded, xlmMax }: { buyer: string; escrow: string; usdcNeeded: bigint; xlmMax: bigint },
  onStep: (s: string) => void,
): Promise<{ hash: string; result: unknown }> {
  if (!(await hasUsdcTrustline(buyer))) {
    onStep("Add a USDC trustline to your account");
    await addUsdcTrustline(buyer);
  }
  if (usdcNeeded > 0n) {
    onStep("Swap XLM for USDC on Soroswap");
    await invoke(
      {
        contractId: network.soroswap.router,
        method: "swap_tokens_for_exact_tokens",
        args: {
          amount_out: usdcNeeded,
          amount_in_max: xlmMax,
          path: PATH(),
          to: buyer,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
        },
      },
      buyer,
      (s) => onStep(`Swap · ${s}`),
    );
  }
  onStep("Deposit the payment into the trade");
  return invoke({ contractId: escrow, method: "fund" }, buyer, (s) => onStep(`Deposit · ${s}`));
}
