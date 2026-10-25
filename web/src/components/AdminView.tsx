"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StrKey } from "@stellar/stellar-sdk";
import { useWallet } from "@/components/WalletProvider";
import { useTx } from "@/components/TxProvider";
import { network } from "@/lib/network";
import { read, type Fees } from "@/lib/chain";
import { pct, pctToBps, short } from "@/lib/format";
import { formatUsdc, toUnits } from "@/lib/usdc";
import { STATE_BADGE, formatDate, type Trade, type TradeState } from "@/lib/trade";
import { listTrades } from "@/lib/registry";
import { readPool, type PoolState } from "@/lib/pool";
import { describeError } from "@/lib/errors";

interface Farmer {
  address: string;
  limit: bigint | null;
  exposure: bigint;
}

interface Console {
  admin: string;
  fees: Fees;
  treasury: string;
  earned: bigint;
  trades: Trade[];
  pool: PoolState;
  farmers: Farmer[];
}

async function readConsole(): Promise<Console> {
  const platform = network.contracts.platform;
  const [admin, fees, treasury, trades, pool] = await Promise.all([
    read<string>(platform, "admin"),
    read<Fees>(platform, "fees"),
    read<string>(platform, "treasury"),
    listTrades(),
    readPool(),
  ]);
  const earned = await read<bigint>(network.contracts.usdc, "balance", { id: treasury }).catch(() => 0n);
  // The pool keeps no list of onboarded farmers, so the console shows every farmer who
  // appears in a trade, plus any address the admin looks up or onboards.
  const sellers = Array.from(new Set(trades.map((t) => t.config.seller)));
  const farmers = await Promise.all(sellers.map(readFarmer));
  return { admin, fees, treasury, earned, trades, pool, farmers };
}

async function readFarmer(address: string): Promise<Farmer> {
  const pool = network.contracts.pool;
  const [limit, exposure] = await Promise.all([
    read<bigint | undefined>(pool, "farmer_limit", { farmer: address }),
    read<bigint>(pool, "exposure", { farmer: address }),
  ]);
  return { address, limit: limit ?? null, exposure };
}

export function AdminView() {
  const { address } = useWallet();
  const [data, setData] = useState<Console | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    readConsole().then(setData, (e) => setError(describeError(e)));
  }, []);
  useEffect(refresh, [refresh]);

  if (error) return <p className="card p-6 text-sm text-danger">{error}</p>;
  if (!data) return <p className="card p-6 text-sm text-ink/70">Reading the platform from the network…</p>;

  const isAdmin = address === data.admin;
  const sum = (states: TradeState[]) =>
    data.trades.filter((t) => states.includes(t.state)).reduce((s, t) => s + t.config.amount, 0n);

  return (
    <div className="space-y-4">
      {!isAdmin && (
        <p className="text-sm text-ink/70">
          Read-only view. Changes need Avocate&apos;s admin wallet ({short(data.admin)}).
        </p>
      )}

      <section aria-label="Platform overview" className="grid gap-4 lg:grid-cols-6">
        <div className="card-highlight p-6 lg:col-span-4">
          <h2 className="text-sm font-medium text-ink/70">Paid to farmers</h2>
          <p className="figure-xl mt-2">
            {amountOf(sum(["Released"]))} <span className="text-2xl text-ink/70">USDC</span>
          </p>
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="text-ink/70">Trades</dt>
              <dd className="font-semibold">{data.trades.length}</dd>
            </div>
            <div>
              <dt className="text-ink/70">In progress</dt>
              <dd className="font-semibold">{data.trades.filter((t) => t.state === "Funded").length}</dd>
            </div>
            <div>
              <dt className="text-ink/70">Locked now</dt>
              <dd className="font-semibold">{formatUsdc(sum(["Funded"]))}</dd>
            </div>
          </dl>
        </div>
        <div className="card flex flex-col justify-between gap-4 p-6 lg:col-span-2">
          <div>
            <h2 className="text-sm font-medium text-ink/70">Fees earned</h2>
            <p className="mt-2 font-condensed text-4xl leading-none">
              {amountOf(data.earned)} <span className="text-lg text-ink/70">USDC</span>
            </p>
            <p className="mt-2 text-xs text-ink/70">Treasury {short(data.treasury, 4)}</p>
          </div>
          <Link href="/pool" className="text-sm text-brand-dark hover:underline">
            Pool value {formatUsdc(data.pool.totalAssets)} · {data.pool.loans.length} open advance{data.pool.loans.length === 1 ? "" : "s"} →
          </Link>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <FeesCard fees={data.fees} isAdmin={isAdmin} onDone={refresh} />
        <FarmersCard farmers={data.farmers} isAdmin={isAdmin} onDone={refresh} />
      </div>

      <Registry trades={data.trades} />
    </div>
  );
}

const amountOf = (units: bigint) => formatUsdc(units).replace(" USDC", "");

const FEE_FIELDS: { key: keyof Fees; label: string; who: string }[] = [
  { key: "trade_fee_bps", label: "Trade fee", who: "Paid by the buyer on top of the price; refunded if the trade is refunded." },
  { key: "financing_fee_bps", label: "Financing fee", who: "Paid by the farmer to Avocate on each advance." },
  { key: "pool_yield_bps", label: "Pool yield", who: "Paid by the farmer to the pool's depositors on each advance." },
];

const toInputs = (fees: Fees) =>
  Object.fromEntries(FEE_FIELDS.map((f) => [f.key, String(fees[f.key] / 100)])) as Record<keyof Fees, string>;

function FeesCard({ fees, isAdmin, onDone }: { fees: Fees; isAdmin: boolean; onDone: () => void }) {
  const run = useTx();
  const [values, setValues] = useState(() => toInputs(fees));
  useEffect(() => setValues(toInputs(fees)), [fees]);

  const parsed = FEE_FIELDS.map((f) => pctToBps(values[f.key]));
  const valid = parsed.every((v) => v !== null);
  const changed = valid && FEE_FIELDS.some((f, i) => parsed[i] !== fees[f.key]);

  async function save() {
    if (!valid) return;
    const next = Object.fromEntries(FEE_FIELDS.map((f, i) => [f.key, parsed[i]])) as unknown as Fees;
    const out = await run({
      title: "Update fees",
      detail: FEE_FIELDS.map((f) => `${f.label} ${pct(next[f.key])}`).join(" · "),
      kind: "platform",
      contractId: network.contracts.platform,
      method: "set_fees",
      args: { fees: next },
    });
    if (out) onDone();
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Fees</h2>
      <p className="mt-1 text-sm text-ink/70">
        Each trade keeps the fees it was created with. A change applies to new trades only.
      </p>
      <div className="mt-4 space-y-4">
        {FEE_FIELDS.map((f, i) => (
          <div key={f.key}>
            <label className="label" htmlFor={f.key}>
              {f.label} (%) · now {pct(fees[f.key])}
            </label>
            <input
              id={f.key}
              className="input"
              inputMode="decimal"
              disabled={!isAdmin}
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              aria-invalid={parsed[i] === null}
            />
            <p className={`mt-1 text-xs ${parsed[i] === null ? "text-danger" : "text-ink/70"}`}>
              {parsed[i] === null ? "Enter a percent between 0 and 100, with up to two decimals." : f.who}
            </p>
          </div>
        ))}
      </div>
      {isAdmin && (
        <button className="btn-brand mt-5 w-full" disabled={!changed} onClick={save}>
          Save fees for new trades
        </button>
      )}
    </section>
  );
}

function FarmersCard({ farmers, isAdmin, onDone }: { farmers: Farmer[]; isAdmin: boolean; onDone: () => void }) {
  const run = useTx();
  const [extra, setExtra] = useState<Farmer[]>([]);
  const [who, setWho] = useState("");
  const [limit, setLimit] = useState("");
  const all = useMemo(() => {
    const seen = new Set(farmers.map((f) => f.address));
    return [...farmers, ...extra.filter((f) => !seen.has(f.address))];
  }, [farmers, extra]);

  const addressOk = StrKey.isValidEd25519PublicKey(who.trim());
  const limitUnits = toUnits(limit);

  async function onboard() {
    if (!addressOk || !limitUnits || limitUnits <= 0n) return;
    const farmer = who.trim();
    const out = await run({
      title: "Onboard farmer",
      detail: `${short(farmer)} with a limit of ${formatUsdc(limitUnits)}`,
      kind: "pool",
      contractId: network.contracts.pool,
      method: "onboard",
      args: { farmer, limit: limitUnits },
    });
    if (out) {
      setExtra([...extra.filter((f) => f.address !== farmer), await readFarmer(farmer)]);
      setWho("");
      setLimit("");
      onDone();
    }
  }

  async function offboard(farmer: string) {
    const out = await run({
      title: "Offboard farmer",
      detail: `${short(farmer)} gets no new advances; open ones run their course`,
      kind: "pool",
      contractId: network.contracts.pool,
      method: "offboard",
      args: { farmer },
    });
    if (out) {
      setExtra(extra.filter((f) => f.address !== farmer));
      onDone();
    }
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Farmers</h2>
      <p className="mt-1 text-sm text-ink/70">
        Only onboarded farmers can ask the pool for advances, up to their limit across all their open advances.
      </p>
      <ul className="mt-4 divide-y divide-ink/5">
        {all.length === 0 && <li className="py-2 text-sm text-ink/70">No farmers yet.</li>}
        {all.map((f) => (
          <li key={f.address} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div>
              <p className="font-mono">{short(f.address)}</p>
              <p className="text-xs text-ink/70">
                {f.limit === null ? "Not onboarded" : `Limit ${formatUsdc(f.limit)} · owes ${formatUsdc(f.exposure)}`}
              </p>
            </div>
            {isAdmin && f.limit !== null && (
              <button className="text-sm text-danger hover:underline" onClick={() => offboard(f.address)}>
                Offboard
              </button>
            )}
          </li>
        ))}
      </ul>
      {isAdmin && (
        <div className="mt-4 space-y-3 border-t border-ink/5 pt-4">
          <div>
            <label className="label" htmlFor="farmer-address">
              Onboard or change a limit
            </label>
            <input
              id="farmer-address"
              className="input font-mono"
              placeholder="Farmer's address (G…)"
              value={who}
              onChange={(e) => setWho(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="farmer-limit">
              Limit (USDC)
            </label>
            <input
              id="farmer-limit"
              className="input"
              inputMode="decimal"
              placeholder="Limit (USDC)"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
            <button className="btn-brand shrink-0" disabled={!addressOk || !limitUnits || limitUnits <= 0n} onClick={onboard}>
              Save
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const FILTERS: ("All" | TradeState)[] = ["All", "Pending", "Funded", "Released", "Refunded", "Cancelled"];

function Registry({ trades }: { trades: Trade[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const shown = trades.filter((t) => filter === "All" || t.state === filter);
  const count = (f: (typeof FILTERS)[number]) => (f === "All" ? trades.length : trades.filter((t) => t.state === f).length);

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">All trades</h2>
        <div className="flex flex-wrap gap-1 rounded-lg bg-mist/70 p-1 text-xs font-medium" role="group" aria-label="Filter by state">
          {FILTERS.map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 ${filter === f ? "bg-brand-dark text-white" : "text-ink/70 hover:text-ink"}`}
            >
              {f} {count(f)}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-ink/70">
              {["State", "Price", "Buyer → Farmer", "Advance", "Deadline", "Trade"].map((h) => (
                <th key={h} scope="col" className="py-2 pr-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5 whitespace-nowrap">
            {shown.map((t) => (
              <tr key={t.id}>
                <td className="py-2 pr-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATE_BADGE[t.state]}`}>{t.state}</span>
                </td>
                <td className="py-2 pr-3 font-semibold">{formatUsdc(t.config.amount)}</td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {short(t.config.buyer, 4)} → {short(t.config.seller, 4)}
                </td>
                <td className="py-2 pr-3">{t.advance ? formatUsdc(t.advance.principal) : "—"}</td>
                <td className="py-2 pr-3 text-ink/70">{formatDate(t.config.deadline)}</td>
                <td className="py-2">
                  <Link href={`/buyer?trade=${t.id}`} className="font-mono text-xs text-brand-dark hover:underline">
                    {short(t.id, 4)}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="py-3 text-sm text-ink/70">No trades in this state.</p>}
      </div>
    </section>
  );
}
