"use client";

import type { Networks } from "@creit.tech/stellar-wallets-kit/types";
import { network } from "@/lib/network";
import { demoKeypair, demoSigner, forgetDemoWallet } from "@/lib/demo-wallet";

type Kit = typeof import("@creit.tech/stellar-wallets-kit/sdk").StellarWalletsKit;

let kit: Promise<Kit> | null = null;

// The kit touches `window` as soon as it is imported, so it is loaded on first use in the
// browser rather than at module load (which would also run during server rendering).
function getKit(): Promise<Kit> {
  kit ??= Promise.all([
    import("@creit.tech/stellar-wallets-kit/sdk"),
    import("@creit.tech/stellar-wallets-kit/modules/utils"),
  ]).then(([{ StellarWalletsKit }, { defaultModules }]) => {
    StellarWalletsKit.init({ modules: defaultModules(), network: network.passphrase as Networks });
    return StellarWalletsKit;
  });
  return kit;
}

export async function connectWallet(): Promise<string> {
  const demo = demoKeypair();
  if (demo) return demo.publicKey();
  const { address } = await (await getKit()).authModal();
  return address;
}

export async function disconnectWallet(): Promise<void> {
  if (demoKeypair()) return forgetDemoWallet();
  await (await getKit()).disconnect();
}

// A wallet left on another network would sign for the wrong passphrase and the network
// would reject the transaction with an opaque error, so this is checked before any signing.
async function readyToSign(): Promise<Kit> {
  const k = await getKit();
  const { networkPassphrase } = await k.getNetwork().catch(() => ({ networkPassphrase: network.passphrase }));
  if (networkPassphrase !== network.passphrase) {
    throw new Error(`Your wallet is on another network. Switch it to Stellar ${network.name} and try again.`);
  }
  return k;
}

// A demo wallet signs in this browser; any other address goes to the wallet extension.
const demoFor = (address: string) => {
  const kp = demoKeypair();
  return kp && kp.publicKey() === address ? demoSigner(kp) : null;
};

export async function signTransaction(xdr: string, address: string) {
  const demo = demoFor(address);
  if (demo) return demo.signTransaction(xdr);
  return (await readyToSign()).signTransaction(xdr, { address, networkPassphrase: network.passphrase });
}

export async function signAuthEntry(entry: string, address: string) {
  const demo = demoFor(address);
  if (demo) return demo.signAuthEntry(entry);
  return (await readyToSign()).signAuthEntry(entry, { address, networkPassphrase: network.passphrase });
}
