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

  return (
    <div className="space-y-6">
      {error && <p className="card-glass p-6 text-sm text-rose-700">{error}</p>}

      <section aria-label="Pool overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pool value" value={pool ? formatUsdc(pool.totalAssets) : "…"} hint="Cash plus loans and their accrued yield" />
        <Stat label="Lent to farmers" value={lent !== null ? formatUsdc(lent) : "…"} hint={pool ? `${pool.loans.length} open advances` : ""} />
        <Stat label="Cash available" value={pool ? formatUsdc(pool.held) : "…"} hint="What depositors can withdraw now" />
        <Stat
          label="Share price"
          value={pool ? `${pool.sharePrice.toFixed(4)} USDC` : "…"}
          hint={pool ? `Started at 1.0000 · ${((pool.sharePrice - 1) * 100).toFixed(2)}% so far` : ""}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <YourPosition position={position} pool={pool} onDone={refresh} />
        </div>
        <section className="card-glass p-6 lg:col-span-3">
          <h2 className="text-lg font-semibold">Open advances</h2>
          <p className="mt-1 text-sm text-ink/70">
            Money the pool has paid to farmers ahead of delivery. Each is repaid with its yield when the trade settles.
          </p>
          <Loans loans={pool?.loans ?? null} />
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card-glass px-4 py-3">
      <p className="label">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink/70">{hint}</p>}
    </div>
  );
}

function YourPosition({ position, pool, onDone }: { position: Position | null; pool: PoolState | null; onDone: () => void }) {
  const { address, connect } = useWallet();

  if (!address) {
    return (
      <section className="card-glass p-6">
        <h2 className="text-lg font-semibold">Your position</h2>
        <p className="mt-1 text-sm text-ink/70">Connect your wallet to deposit USDC and earn the yield farmers pay on advances.</p>
        <button className="btn-brand mt-4 w-full" onClick={connect}>
          Connect wallet
        </button>
      </section>
    );
  }
  if (!position) return <section className="card-glass p-6 text-sm text-ink/70">Reading your position…</section>;

  const ownership =
    pool && pool.totalShares > 0n ? Number((position.shares * 10_000n) / pool.totalShares) / 100 : 0;

  return (
    <section className="card-glass p-6">
      <h2 className="text-lg font-semibold">Your position</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-white/60 px-3 py-2">
          <dt className="label">Value</dt>
          <dd className="text-lg font-semibold">{formatUsdc(position.value)}</dd>
        </div>
        <div className="rounded-xl bg-white/60 px-3 py-2">
          <dt className="label">Share of the pool</dt>
          <dd className="text-lg font-semibold">{ownership.toFixed(2)}%</dd>
        </div>
      </dl>
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
      <p className={`mt-1 text-xs ${problem ? "text-rose-700" : "text-ink/70"}`}>{problem ?? help}</p>
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
                overdue ? "bg-rose-100 text-rose-800" : "bg-brand/10 text-brand-dark"
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
