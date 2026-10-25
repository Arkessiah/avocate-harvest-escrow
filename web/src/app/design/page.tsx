// Living style guide: renders the tokens and components defined in DESIGN.md.

const COLOURS = [
  ["brand", "#009E63", "bg-brand"],
  ["brand-dark", "#007A4D", "bg-brand-dark"],
  ["brand-deep", "#00653F", "bg-brand-deep"],
  ["brand-light", "#4FD1A5", "bg-brand-light"],
  ["ink", "#0B1F17", "bg-ink"],
  ["mist", "#E8F5EF", "bg-mist"],
] as const;

const STATES = [
  ["Pending", "bg-amber-100 text-amber-800"],
  ["Funded", "bg-brand/10 text-brand-dark"],
  ["Released", "bg-emerald-100 text-emerald-800"],
  ["Refunded", "bg-rose-100 text-rose-800"],
  ["Cancelled", "bg-ink/10 text-ink/80"],
] as const;

export const metadata = { title: "Design · Avocate Harvest Escrow" };

export default function Design() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Avocate <span className="text-brand">Harvest Escrow</span>
        </h1>
        <p className="mt-1 text-sm text-ink/70">Design tokens and components, as defined in DESIGN.md.</p>
      </header>

      <section className="card-glass p-6">
        <p className="label">Colour</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLOURS.map(([name, hex, bg]) => (
            <div key={name} className="overflow-hidden rounded-xl border border-ink/10 bg-white">
              <div className={`h-14 ${bg}`} />
              <div className="px-3 py-2 text-sm">
                <p className="font-medium">{name}</p>
                <p className="font-mono text-xs text-ink/70">{hex}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card-glass p-6">
        <p className="label">Typography</p>
        <p className="mt-3 text-2xl font-bold tracking-tight">App title</p>
        <p className="text-lg font-semibold">Section title</p>
        <p>Body text in ink. A farmer is paid the moment delivery is confirmed.</p>
        <p className="text-ink/70">Secondary text at the 70% floor.</p>
        <p className="mt-2 font-mono text-sm text-brand-dark">CBHU4N…PZNXBF ↗</p>
      </section>

      <section className="card-glass p-6">
        <p className="label">Buttons and inputs</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button className="btn-brand">Fund trade</button>
          <button className="btn-ghost">Load trade</button>
          <button className="btn-brand" disabled>
            Disabled
          </button>
        </div>
        <div className="mt-4 max-w-sm">
          <label className="label" htmlFor="amount">
            Price (USDC)
          </label>
          <input id="amount" className="input" placeholder="1,000.00" />
        </div>
      </section>

      <section className="card-glass p-6">
        <p className="label">Trade states</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATES.map(([state, tone]) => (
            <span key={state} className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
              {state}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-brand/20 bg-brand/5 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Role intro</p>
        <p className="mt-1 text-sm text-ink/70">
          Each role page opens with this panel: who you are and what you can do here.
        </p>
      </section>

      <section className="card-glass p-6">
        <p className="label">Error message (sample)</p>
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-rose-700">
          The contract rejected the call (NotValidated).
        </div>
        <p className="mt-2 text-xs text-ink/70">
          Shown when an on-chain call fails, with the contract error name.
        </p>
      </section>
    </main>
  );
}
