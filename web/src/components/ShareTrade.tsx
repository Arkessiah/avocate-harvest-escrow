"use client";

import { useEffect, useState } from "react";
import { ShareLink } from "@/components/ShareLink";
import { ROLES } from "@/lib/roles";

const FOR = ["buyer", "farmer", "validator", "agent"] as const;

// A link that opens this trade on another role's screen: the farmer sends it to the buyer to
// fund, the buyer to the validator to inspect, and so on. Reading a trade needs no wallet.
export function ShareTrade({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<(typeof FOR)[number]>("buyer");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  if (!open) {
    return (
      <button type="button" className="text-sm font-medium text-brand-dark hover:underline" onClick={() => setOpen(true)}>
        Share this trade
      </button>
    );
  }

  const url = `${origin}/${role}?trade=${id}`;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Share this trade</h3>
        <button type="button" className="text-xs text-ink/70 hover:text-ink hover:underline" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <div className="flex flex-wrap gap-1 rounded-lg bg-mist/70 p-1 text-xs font-medium" role="group" aria-label="Open it as">
        {FOR.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={role === r}
            onClick={() => setRole(r)}
            className={`rounded-md px-3 py-1.5 ${role === r ? "bg-surface text-ink shadow-sm" : "text-ink/70 hover:text-ink"}`}
          >
            For the {ROLES[r].label.toLowerCase()}
          </button>
        ))}
      </div>
      {origin && (
        <ShareLink
          url={url}
          subject="A trade on Avocate"
          message={`Open this trade on Avocate as the ${ROLES[role].label.toLowerCase()}:`}
          qrLabel={`QR code that opens the trade for the ${ROLES[role].label.toLowerCase()}`}
        />
      )}
    </div>
  );
}
