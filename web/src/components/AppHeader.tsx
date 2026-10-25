"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WalletButton } from "@/components/WalletButton";
import { ROLES, type Role } from "@/lib/roles";

const NAV: { href: string; label: string }[] = [
  { href: "/overview", label: "Overview" },
  ...(Object.keys(ROLES) as Role[]).map((r) => ({ href: `/${r}`, label: ROLES[r].label })),
];

export function AppHeader() {
  const path = usePathname();
  const router = useRouter();
  // The trade being looked at travels with the navigation, so each role sees the same one.
  const trade = useSearchParams().get("trade");
  const query = trade ? `?trade=${trade}` : "";

  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="flex items-center" aria-label="Avocate Harvest Escrow, home">
          <span className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-wide text-ink">AVOCATE</span>
            <span className="font-condensed text-[1.7rem] font-light leading-none text-brand-dark">Harvest Escrow</span>
          </span>
        </Link>
        <WalletButton />
      </div>

      {/* On phones the seven screens are one native picker instead of a block of wrapped chips. */}
      <div className="relative mt-5 sm:hidden">
        <label htmlFor="screen" className="sr-only">
          Screen
        </label>
        <select
          id="screen"
          className="input appearance-none pr-10 font-medium"
          value={NAV.some((n) => n.href === path) ? path : ""}
          onChange={(e) => router.push(e.target.value + query)}
        >
          {!NAV.some((n) => n.href === path) && <option value="">Choose a screen</option>}
          {NAV.map(({ href, label }) => (
            <option key={href} value={href}>
              {label}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/70"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="m5 8 5 5 5-5" />
        </svg>
      </div>

      <nav aria-label="Roles" className="mt-5 hidden flex-wrap gap-2 sm:flex">
        {NAV.map(({ href, label }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href + query}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active ? "bg-brand-dark text-white" : "bg-mist/70 text-ink/70 hover:bg-mist hover:text-ink"
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
