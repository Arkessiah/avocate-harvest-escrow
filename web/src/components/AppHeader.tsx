"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { WalletButton } from "@/components/WalletButton";
import { ROLES, type Role } from "@/lib/roles";

const NAV: { href: string; label: string }[] = [
  { href: "/overview", label: "Overview" },
  ...(Object.keys(ROLES) as Role[]).map((r) => ({ href: `/${r}`, label: ROLES[r].label })),
];

export function AppHeader() {
  const path = usePathname();
  // The trade being looked at travels with the navigation, so each role sees the same one.
  const trade = useSearchParams().get("trade");
  const query = trade ? `?trade=${trade}` : "";

  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={`/overview${query}`} className="flex items-center">
          <span className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-wide text-ink">AVOCATE</span>
            <span className="font-condensed text-[1.7rem] font-light leading-none text-brand-dark">Harvest Escrow</span>
          </span>
        </Link>
        <WalletButton />
      </div>

      <nav aria-label="Roles" className="mt-5 flex flex-wrap gap-2">
        {NAV.map(({ href, label }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href + query}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active ? "bg-brand-dark text-white" : "bg-white/60 text-ink/70 hover:bg-white hover:text-ink"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
