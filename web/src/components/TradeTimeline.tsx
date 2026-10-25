import type { Trade } from "@/lib/trade";
import { formatUsdc } from "@/lib/usdc";

type Status = "done" | "current" | "todo" | "skipped" | "bad";

interface Step {
  label: string;
  detail: string;
  status: Status;
}

// Where the trade stands in its life, read from its on-chain state. An advance is optional,
// so a closed trade without one shows that step as skipped rather than missing.
export function stepsOf(trade: Trade): Step[] {
  const { state, validation, advance } = trade;
  if (state === "Cancelled") {
    return [
      { label: "Created", detail: "Terms fixed on chain", status: "done" },
      { label: "Cancelled", detail: "Dropped before any deposit", status: "bad" },
    ];
  }
  const funded = state !== "Pending";
  const closed = state === "Released" || state === "Refunded";
  const settle: Step =
    state === "Released"
      ? { label: "Paid", detail: "Farmer paid", status: "done" }
      : state === "Refunded"
        ? { label: "Refunded", detail: "Money back to the buyer", status: "bad" }
        : { label: "Settle", detail: "Pay the farmer or refund", status: validation ? "current" : "todo" };
  return [
    { label: "Created", detail: "Terms fixed on chain", status: "done" },
    {
      label: "Funded",
      detail: funded ? "Price locked" : "Waiting for the deposit",
      status: funded ? "done" : "current",
    },
    {
      label: "Advance",
      detail: advance ? `${formatUsdc(advance.principal)} paid early` : closed ? "Not used" : "Optional",
      status: advance ? "done" : closed || validation ? "skipped" : "todo",
    },
    {
      label: "Validated",
      detail: !validation ? "Delivery not checked yet" : validation.ok ? "Delivery conforms" : "Delivery rejected",
      status: !validation ? (funded && !closed ? "current" : closed ? "skipped" : "todo") : validation.ok ? "done" : "bad",
    },
    settle,
  ];
}

const DOT: Record<Status, string> = {
  done: "bg-brand-dark",
  current: "bg-surface ring-4 ring-brand/30 outline outline-2 outline-brand-dark",
  todo: "bg-surface ring-1 ring-ink/20",
  skipped: "bg-ink/15",
  bad: "bg-danger",
};

export function TradeTimeline({ trade }: { trade: Trade }) {
  const steps = stepsOf(trade);
  return (
    <ol className="grid gap-3 sm:flex sm:gap-0" aria-label="Trade progress">
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex items-start gap-3 sm:flex-1 sm:flex-col sm:gap-2">
          {/* Connector to the next step; drawn behind the dots on wide screens only. */}
          {i < steps.length - 1 && (
            <span
              className={`absolute left-[5px] top-4 hidden h-0.5 w-full sm:left-3 sm:top-[5px] sm:block ${
                s.status === "done" ? "bg-brand-dark" : "bg-ink/10"
              }`}
              aria-hidden
            />
          )}
          <span className={`relative mt-1 h-3 w-3 shrink-0 rounded-full sm:mt-0 ${DOT[s.status]}`} aria-hidden />
          <div className="min-w-0 sm:pr-3">
            <p className={`text-sm font-semibold ${s.status === "skipped" || s.status === "todo" ? "text-ink/70" : ""}`}>
              {s.label}
              <span className="sr-only">
                {" "}
                ({s.status === "current" ? "in progress" : s.status === "bad" ? "stopped here" : s.status})
              </span>
            </p>
            <p className="text-xs text-ink/70">{s.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
