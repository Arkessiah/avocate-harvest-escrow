"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";
import { useTx } from "@/components/TxProvider";
import { network } from "@/lib/network";
import { short } from "@/lib/format";
import { formatUsdc, toInput, toUnits } from "@/lib/usdc";
import { formatDate } from "@/lib/trade";
import { readPool, readPosition, type Loan, type PoolState, type Position } from "@/lib/pool";
import { describeError } from "@/lib/errors";
import { Ring } from "@/components/Ring";

export function PoolView() {
  const { address } = useWallet();
  const [pool, setPool] = useState<PoolState | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    readPool().then(setPool, (e) => setError(describeError(e, "pool")));
    if (address) readPosition(address).then(setPosition, () => setPosition(null));
    else setPosition(null);
  }, [address]);

  useEffect(refresh, [refresh]);

  const lent = pool?.loans.reduce((sum, l) => sum + l.principal, 0n) ?? null;
  const change = pool ? (pool.sharePrice - 1) * 100 : 0;
  const base = pool && lent !== null ? pool.held + lent : 0n;
  const lentPct = base > 0n && lent !== null ? Math.round((Number(lent) / Number(base)) * 100) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-6">
      {error && <p className="card p-6 text-sm text-danger lg:col-span-6">{error}</p>}

      <section aria-label="Pool overview" className="card-highlight flex flex-col gap-6 p-6 sm:flex-row sm:items-center lg:col-span-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-ink/70">Pool value</h2>
          <p className="figure-xl mt-2">
            {pool ? amountOf(pool.totalAssets) : "…"} <span className="text-2xl text-ink/70">USDC</span>
          </p>
          <p className="mt-3 text-sm text-ink/70">Cash plus advances and the yield they have accrued.</p>
          <p className="mt-4 text-sm">
            Share price <span className="font-semibold">{pool ? pool.sharePrice.toFixed(4) : "…"}</span>
            <span className="text-ink/70"> · started at 1.0000 · </span>
            <span className={change < 0 ? "font-semibold text-danger" : "font-semibold text-brand-dark"}>
              {pool ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : ""}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative h-32 w-32 shrink-0">
            <Ring part={lent !== null ? Number(lent) : 0} total={Number(base)} label={`${lentPct}% of the pool is lent to farmers`} />
            <span className="absolute inset-0 flex flex-col items-center justify-center leading-none" aria-hidden>
              <span className="font-condensed text-3xl">{lentPct}%</span>
              <span className="mt-1 text-xs text-ink/70">lent out</span>
            </span>
          </div>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="flex items-center gap-1.5 text-ink/70">
                <span className="h-2 w-2 rounded-full bg-brand-dark" aria-hidden /> Lent to farmers
              </dt>
              <dd className="font-semibold">{lent !== null ? formatUsdc(lent) : "…"}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-ink/70">
                <span className="h-2 w-2 rounded-full bg-surface ring-1 ring-ink/20" aria-hidden /> Cash available
              </dt>
              <dd className="font-semibold">{pool ? formatUsdc(pool.held) : "…"}</dd>
            </div>
            <p className="max-w-[12rem] text-xs text-ink/70">
              {lentPct === 0
                ? "Nothing is lent right now: all of it is ready to advance to farmers."
                : pool?.loans.length === 1
                  ? "1 advance earning yield until its trade settles."
                  : `${pool?.loans.length} advances earning yield until their trades settle.`}
            </p>
          </dl>
        </div>
      </section>

      <div className="lg:col-span-2">
        <YourPosition position={position} pool={pool} onDone={refresh} />
      </div>

      <section className="card p-6 lg:col-span-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Open advances</h2>
          <p className="text-sm text-ink/70">{pool ? `${pool.loans.length} open` : ""}</p>
        </div>
        <p className="mt-1 text-sm text-ink/70">
          Money the pool has paid to farmers ahead of delivery. Each is repaid with its yield when the trade settles.
        </p>
        <Loans loans={pool?.loans ?? null} />
      </section>
    </div>
  );
}

const amountOf = (units: bigint) => formatUsdc(units).replace(" USDC", "");

function YourPosition({ position, pool, onDone }: { position: Position | null; pool: PoolState | null; onDone: () => void }) {
  const { address, connect } = useWallet();

  if (!address) {
    return (
      <section className="card h-full p-6">
        <h2 className="text-lg font-semibold">Your position</h2>
        <p className="mt-1 text-sm text-ink/70">Connect your wallet to deposit USDC and earn the yield farmers pay on advances.</p>
        <button className="btn-brand mt-4 w-full" onClick={connect}>
          Connect wallet
        </button>
      </section>
    );
  }
  if (!position) return <section className="card p-6 text-sm text-ink/70">Reading your position…</section>;

  const ownership =
    pool && pool.totalShares > 0n ? Number((position.shares * 10_000n) / pool.totalShares) / 100 : 0;

  return (
    <section className="card h-full p-6">
      <h2 className="text-sm font-medium text-ink/70">Your position</h2>
      <p className="figure-xl mt-2 sm:text-5xl">
        {amountOf(position.value)} <span className="text-xl text-ink/70">USDC</span>
      </p>
      <p className="mt-2 text-sm text-ink/70">{ownership.toFixed(2)}% of the pool</p>
      <Amount
        title="Deposit"
        help={position.wallet !== null ? `Wallet balance: ${formatUsdc(position.wallet)}` : "Your wallet holds no USDC yet."}
        max={position.wallet ?? 0n}
        action="Deposit"
        method="deposit"
        onDone={onDone}
      />
      <Amount
        title="Withdraw"
        help={`Available now: ${formatUsdc(position.maxWithdraw)}. Money lent to farmers comes back as trades settle.`}
        max={position.maxWithdraw}
        action="Withdraw"
        method="withdraw"
        onDone={onDone}
      />
    </section>
  );
}

function Amount({
  title,
  help,
  max,
  action,
  method,
  onDone,
}: {
  title: string;
  help: string;
  max: bigint;
  action: string;
  method: "deposit" | "withdraw";
  onDone: () => void;
}) {
  const { address } = useWallet();
  const run = useTx();
  const [value, setValue] = useState("");
  const amount = toUnits(value);
  const problem = !amount || amount <= 0n ? null : amount > max ? `More than the ${formatUsdc(max)} available.` : null;
  const id = `pool-${method}`;

  async function submit() {
    if (!address || !amount || problem) return;
    const me = address;
    const args =
      method === "deposit"
        ? { assets: amount, receiver: me, from: me, operator: me }
        : { assets: amount, receiver: me, owner: me, operator: me };
    const out = await run({
      title: method === "deposit" ? "Deposit into the pool" : "Withdraw from the pool",
      detail: formatUsdc(amount),
      kind: "pool",
      contractId: network.contracts.pool,
      method,
      args,
    });
    if (out) {
      setValue("");
      onDone();
    }
  }

  return (
    <div className="mt-5 border-t border-ink/5 pt-4">
      <label className="label" htmlFor={id}>
        {title} (USDC)
      </label>
      <div className="flex gap-2">
        <input id={id} className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="btn-ghost shrink-0 px-3" onClick={() => setValue(toInput(max))} disabled={max <= 0n}>
          Max
        </button>
        <button className="btn-brand shrink-0" onClick={submit} disabled={!amount || amount <= 0n || !!problem}>
          {action}
        </button>
      </div>
      <p className={`mt-1 text-xs ${problem ? "text-danger" : "text-ink/70"}`}>{problem ?? help}</p>
    </div>
  );
}

function Loans({ loans }: { loans: Loan[] | null }) {
  if (!loans) return <p className="mt-4 text-sm text-ink/70">Reading advances…</p>;
  if (loans.length === 0) return <p className="mt-4 text-sm text-ink/70">No advances open right now.</p>;
  const now = Date.now() / 1000;

  return (
    <ul className="mt-4 divide-y divide-ink/5">
      {loans.map((l) => {
        const overdue = now > Number(l.deadline);
        return (
          <li key={l.escrow} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <div>
              <p className="font-semibold">
                {formatUsdc(l.principal)} <span className="font-normal text-ink/70">→ repays {formatUsdc(l.repay)}</span>
              </p>
              <p className="font-mono text-xs text-ink/70">
                Farmer {short(l.farmer, 4)} ·{" "}
                <Link href={`/farmer?trade=${l.escrow}`} className="text-brand-dark hover:underline">
                  trade {short(l.escrow, 4)}
                </Link>
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                overdue ? "bg-danger-tint text-danger-strong" : "bg-brand/10 text-brand-dark"
              }`}
            >
              {overdue ? "Overdue · counted as 0" : `Due ${formatDate(l.deadline)}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
