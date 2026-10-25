// Two-part progress ring: `part` of `total`, drawn as SVG so it scales and needs no library.
export function Ring({ part, total, label }: { part: number; total: number; label: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? Math.min(1, Math.max(0, part / total)) : 0;
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={label}>
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" className="stroke-surface" />
      {/* A zero-length arc with round caps would still paint a dot, so it is left out. */}
      {share > 0 && (
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${share * c} ${c}`}
          className="stroke-brand-dark transition-[stroke-dasharray] duration-700"
        />
      )}
    </svg>
  );
}
