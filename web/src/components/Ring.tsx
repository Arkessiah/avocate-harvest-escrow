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

export interface RingPart {
  label: string;
  value: number;
  // Written out in full (not derived) so Tailwind generates both classes.
  stroke: string;
  dot: string;
}

// Concentric rings, one per part, each showing its share of `total` on its own track.
export function Rings({ parts, total, label }: { parts: RingPart[]; total: number; label: string }) {
  const width = 6;
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={label}>
      {parts.map((p, i) => {
        const r = 46 - i * (width + 2);
        const c = 2 * Math.PI * r;
        const share = total > 0 ? Math.min(1, p.value / total) : 0;
        return (
          <g key={p.label}>
            <circle cx="50" cy="50" r={r} fill="none" strokeWidth={width} className="stroke-surface" />
            {share > 0 && (
              <circle
                cx="50"
                cy="50"
                r={r}
                fill="none"
                strokeWidth={width}
                strokeLinecap="round"
                strokeDasharray={`${share * c} ${c}`}
                className={`${p.stroke} transition-[stroke-dasharray] duration-700`}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
