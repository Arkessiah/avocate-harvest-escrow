import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LiveStats } from "@/components/LiveStats";
import { HarvestFigure } from "@/components/harvest-figure";
import { FAQ, REPO_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Avocate Harvest Escrow: farmers paid in seconds",
  description:
    "USDC escrow on Stellar for farm trade. The farmer is paid in seconds once delivery is checked, and can get an advance from a financing pool.",
  alternates: { canonical: "/" },
};

const STEPS = [
  ["The buyer locks the price", "The trade gets its own contract on Stellar. The buyer deposits the price in USDC plus a 0.1% fee; nobody can change the amount or the recipient afterwards."],
  ["The farmer can get paid early", "While the money is locked, an onboarded farmer can ask the financing pool for up to 80% of the price. The farmer signs first and sends the request to the buyer, who completes it."],
  ["An independent validator checks the delivery", "The validator records one verdict on chain with the fingerprint of the inspection report. It can never be rewritten."],
  ["The farmer is paid in seconds", "With a conforming delivery the buyer, or a limited agent acting for them, releases the payment. The pool is repaid first if it advanced money, and the farmer gets the rest."],
  ["Or the buyer gets the money back", "A rejected delivery refunds the buyer in full, fee included. A trade that reaches its deadline also comes back to the buyer, after the pool is repaid."],
];

const RULES = [
  ["Only Avocate trades", "A trade counts only if the platform's registry created it. The pool and the app refuse look-alike contracts."],
  ["Collusion gains nothing", "If a financed trade lapses at its deadline, the pool is repaid first, so a buyer and a farmer cannot split an advance by letting the trade expire."],
  ["Real disputes are shared", "When the independent validator rejects a delivery, the buyer is refunded in full and depositors share the loss in proportion to their shares."],
  ["Fair to depositors", "The pool's yield accrues over each loan's term, and a loan past its deadline counts as zero until repaid, so nobody can time a deposit or an exit to take value from others."],
  ["A bounded agent", "The agent can only trigger the payout fixed when the trade was created, and only after a conforming validation."],
];

export default function Landing() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: "Avocate",
        url: "https://avocate.io",
        logo: `${SITE_URL}/logos/avocate-icon.png`,
      },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        softwareVersion: "0.0.4",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": `${SITE_URL}/#org` },
        codeRepository: REPO_URL,
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <p role="note" className="bg-ink px-4 py-2 text-center text-xs font-medium text-white">
        Beta on the Stellar test network. Test USDC only: no real money moves on this site.
      </p>

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-8">
        <Link href="/" className="flex items-baseline gap-2" aria-label="Avocate Harvest Escrow, home">
          <span className="text-xl font-bold tracking-wide text-ink sm:text-2xl">AVOCATE</span>
          <span className="whitespace-nowrap font-condensed text-[1.4rem] font-light leading-none text-brand-dark sm:text-[1.7rem]">
            Harvest Escrow
          </span>
        </Link>
        <Link href="/overview" className="btn-brand shrink-0 whitespace-nowrap">
          Open app
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="max-w-3xl pt-12">
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Farmers paid in seconds when the harvest arrives.
          </h1>
          <p className="mt-5 text-lg text-ink/70">
            The buyer locks the price in USDC on Stellar. An independent validator checks the delivery, and the money
            reaches the farmer the moment it is confirmed. A financing pool can pay part of it even earlier.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/buyer" className="btn-brand">
              Start a trade
            </Link>
            <a href="#how-it-works" className="btn-ghost">
              How it works
            </a>
          </div>
        </section>

        <section aria-label="The machine and the live numbers" className="mt-10 grid gap-4 lg:grid-cols-6">
          <div className="min-w-0 lg:col-span-4 lg:row-span-2">
            <HarvestFigure />
          </div>
          <div className="lg:col-span-2">
            <LiveStats />
          </div>
          <div className="card p-6 lg:col-span-2">
            <h2 className="font-semibold">Paid early, if needed</h2>
            <p className="mt-2 text-sm text-ink/70">
              While the money is locked, an onboarded farmer can draw up to 80% of the price from a pool funded by several
              depositors. They earn 2% on it; the farmer signs first and the buyer completes the request.
            </p>
          </div>
        </section>

        <section aria-labelledby="problem" className="mt-16 grid gap-4 md:grid-cols-5">
          <div className="card p-7 md:col-span-2">
            <h2 id="problem" className="text-2xl font-semibold tracking-tight">
              The problem
            </h2>
            <p className="mt-3 text-ink/70">
              A farmer who sells a harvest abroad usually ships first and gets paid later. The money can take weeks to
              arrive, and a cross-border transfer adds fees and intermediaries. Small producers rarely have credit to cover
              the wait.
            </p>
            <p className="mt-3 text-ink/70">
              The buyer has the opposite worry: paying before the goods arrive means trusting a seller they may never have
              met. When nobody wants to move first, deals get slower and more expensive, or never happen.
            </p>
          </div>
          <div id="how-it-works" className="card scroll-mt-6 p-7 md:col-span-3">
            <h2 className="text-2xl font-semibold tracking-tight">How a trade runs</h2>
            <ol className="mt-6 space-y-5">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-2">
                  <span className="font-condensed text-3xl font-light leading-none text-brand-dark" aria-hidden>
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-ink/70">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="rules" className="mt-16">
          <h2 id="rules" className="max-w-2xl text-2xl font-semibold tracking-tight">
            Rules that make cheating pointless
          </h2>
          <p className="mt-2 max-w-2xl text-ink/70">
            Every rule is enforced by the contracts and listed in the{" "}
            <a href={`${REPO_URL}#security-and-anti-fraud-rules`} className="text-brand-dark hover:underline">
              project README
            </a>
            .
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {RULES.map(([title, text], i) => (
              <div key={title} className={`card p-6 ${i < 2 ? "lg:col-span-3" : "lg:col-span-2"}`}>
                <dt className="font-semibold">{title}</dt>
                <dd className="mt-2 text-sm text-ink/70">{text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="faq" className="mt-16 grid gap-8 lg:grid-cols-3">
          <h2 id="faq" className="text-2xl font-semibold tracking-tight">
            Questions
          </h2>
          <div className="divide-y divide-ink/10 lg:col-span-2">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group py-4">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="mr-2 inline-block text-brand-dark transition group-open:rotate-90" aria-hidden>
                    ›
                  </span>
                  {q}
                </summary>
                <p className="mt-2 pl-5 text-ink/70">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="built" className="mt-16 grid gap-8 border-t border-ink/10 pt-10 lg:grid-cols-3">
          <h2 id="built" className="text-2xl font-semibold tracking-tight">
            Built on
          </h2>
          <div className="lg:col-span-2">
            <ul className="flex flex-wrap items-center gap-x-12 gap-y-6">
              <li>
                <Image src="/logos/stellar.svg" alt="Stellar" width={122} height={30} />
                <p className="mt-1 text-xs text-ink/70">Soroban smart contracts</p>
              </li>
              <li>
                <Image src="/logos/usdc.svg" alt="USDC" width={104} height={30} />
                <p className="mt-1 text-xs text-ink/70">Settled in USDC</p>
              </li>
              <li>
                <Image src="/logos/openzeppelin.svg" alt="OpenZeppelin" width={200} height={30} />
                <p className="mt-1 text-xs text-ink/70">Follows OpenZeppelin security patterns</p>
              </li>
            </ul>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Image src="/logos/hackmeridian.png" alt="HackMeridian" width={150} height={47} />
              <p className="text-sm text-ink/70">Built during HackMeridian 2026, Lisbon.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/10">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-xs text-ink/70">
          <p>
            Avocate Harvest Escrow v0.0.4 by{" "}
            <a href="https://avocate.io" className="text-brand-dark hover:underline">
              Avocate
            </a>{" "}
            ·{" "}
            <a href={REPO_URL} className="text-brand-dark hover:underline">
              Source code
            </a>{" "}
            · Beta on Stellar testnet, no real money.
          </p>
          <p>
            This is independent software, not affiliated with, sponsored or endorsed by the Stellar Development
            Foundation. Stellar is a trademark of the Stellar Development Foundation, all rights reserved.
          </p>
          <p>
            USDC™ is a trademark of Circle Internet Group, Inc. and/or its affiliates. OpenZeppelin is a trademark of its
            owner. All trademarks shown are the property of their respective owners; their use does not imply endorsement.
          </p>
        </div>
      </footer>
    </>
  );
}
