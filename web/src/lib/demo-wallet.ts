"use client";

import { Keypair, Networks, StrKey, contract } from "@stellar/stellar-sdk";
import { network } from "@/lib/network";

// Demo wallets let someone try every role without installing a wallet: a link carries the
// secret of a prepared testnet account, kept in this browser and used to sign here. They
// only exist on test networks, where the accounts hold test assets with no value. The
// secret travels in the URL fragment, which browsers never send to a server.

const KEY = "avocate.demo-wallet.v1";

// Checked on the passphrase, so a future mainnet entry in lib/network can never enable it.
export const demoAllowed = () => network.passphrase !== Networks.PUBLIC;

export function demoKeypair(): Keypair | null {
  if (!demoAllowed()) return null;
  try {
    const secret = window.localStorage.getItem(KEY);
    return secret && StrKey.isValidEd25519SecretSeed(secret) ? Keypair.fromSecret(secret) : null;
  } catch {
    return null;
  }
}

export function rememberDemoWallet(secret: string): string {
  if (!demoAllowed()) throw new Error("Demo wallets exist only on the test network.");
  if (!StrKey.isValidEd25519SecretSeed(secret)) throw new Error("This demo link is damaged.");
  window.localStorage.setItem(KEY, secret);
  return Keypair.fromSecret(secret).publicKey();
}

export function forgetDemoWallet(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}

// Same result shapes as the wallet kit, so callers do not care which one signed.
export const demoSigner = (kp: Keypair) => contract.basicNodeSigner(kp, network.passphrase);

// Asks the app for a demo account, by role or by address, and keeps it in this browser.
export async function openDemoWallet(query: { role: string } | { address: string }): Promise<string> {
  const res = await fetch("/api/demo/wallet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(query),
  });
  const body = (await res.json().catch(() => ({}))) as { secret?: string; error?: string };
  if (!res.ok || !body.secret) throw new Error(body.error ?? "Demo wallets are not available right now.");
  return rememberDemoWallet(body.secret);
}
