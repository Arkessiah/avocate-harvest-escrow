import { network } from "@/lib/network";
import { read } from "@/lib/chain";

export interface Loan {
  escrow: string;
  farmer: string;
  principal: bigint;
  repay: bigint;
  start: bigint;
  deadline: bigint;
}

export interface PoolState {
  totalAssets: bigint;
  totalShares: bigint;
  held: bigint;
  loans: Loan[];
  // USDC value of the shares that 1 USDC bought on the first deposit; starts at 1 and
  // grows as the yield on advances accrues.
  sharePrice: number;
}

export interface Position {
  shares: bigint;
  value: bigint;
  maxWithdraw: bigint;
  wallet: bigint | null;
}

// Shares carry 3 more decimals than USDC (the vault's virtual offset), so 1 USDC first
// bought 10^10 share units.
const SHARES_PER_USDC = 10_000_000_000n;
const UNIT = 10_000_000;

export async function readPool(): Promise<PoolState> {
  const pool = network.contracts.pool;
  const [totalAssets, totalShares, held, loans, priceUnits] = await Promise.all([
    read<bigint>(pool, "total_assets"),
    read<bigint>(pool, "total_supply"),
    read<bigint>(network.contracts.usdc, "balance", { id: pool }),
    read<Loan[]>(pool, "loans"),
    read<bigint>(pool, "convert_to_assets", { shares: SHARES_PER_USDC }),
  ]);
  return { totalAssets, totalShares, held, loans, sharePrice: Number(priceUnits) / UNIT };
}

export async function readPosition(owner: string): Promise<Position> {
  const pool = network.contracts.pool;
  const shares = await read<bigint>(pool, "balance", { owner });
  const [value, maxWithdraw, wallet] = await Promise.all([
    read<bigint>(pool, "convert_to_assets", { shares }),
    read<bigint>(pool, "max_withdraw", { owner }),
    read<bigint>(network.contracts.usdc, "balance", { id: owner }).catch(() => null),
  ]);
  return { shares, value, maxWithdraw, wallet };
}
