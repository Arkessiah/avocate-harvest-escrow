import testnetConfig from "@deploy/networks/testnet.json";
import testnetDeployment from "@deploy/deployments/testnet.json";

// One entry per network the app can target. Values come from the same files the deploy
// scripts read and write, so a redeploy updates the app without touching code. Adding
// mainnet later means adding its two files here.
const NETWORKS = {
  testnet: { config: testnetConfig, deployment: testnetDeployment },
} as const;

export type NetworkName = keyof typeof NETWORKS;

function select(): (typeof NETWORKS)[NetworkName] & { name: NetworkName } {
  const name = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet") as NetworkName;
  const entry = NETWORKS[name];
  if (!entry) throw new Error(`Unknown network "${name}". Known: ${Object.keys(NETWORKS).join(", ")}`);
  return { ...entry, name };
}

const selected = select();

export const network = {
  name: selected.name,
  rpcUrl: selected.config.rpc_url,
  horizonUrl: selected.config.horizon_url,
  passphrase: selected.config.network_passphrase,
  explorerTx: selected.config.explorer_tx,
  explorerContract: selected.config.explorer_tx.replace(/\/tx\/$/, "/contract/"),
  usdc: selected.config.usdc,
  contracts: selected.deployment.contracts,
  accounts: selected.deployment.accounts,
  deployedAt: selected.deployment.deployed_at,
};
