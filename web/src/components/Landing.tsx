// The landing page, rendered once per language (see lib/landing-copy).
import Image from "next/image";
import Link from "next/link";
import { LiveStats } from "@/components/LiveStats";
import { HarvestFigure } from "@/components/harvest-figure";
import { REPO_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { LANDING, LANGS, LANG_NAME, LANG_PATH, type Lang } from "@/lib/landing-copy";

export function Landing({ lang }: { lang: Lang }) {
  const t = LANDING[lang];
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
        softwareVersion: "0.0.5",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": `${SITE_URL}/#org` },
        codeRepository: REPO_URL,
      },
      {
        "@type": "FAQPage",
        mainEntity: t.faq.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };

  return (
    <div lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="bg-ink text-xs font-medium text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <p role="note" className="min-w-0">
            {t.betaNote}
          </p>
          <nav aria-label="Language" className="flex shrink-0 gap-1">
            {LANGS.map((l) => (
              <Link
                key={l}
                href={LANG_PATH[l]}
                hrefLang={l}
                lang={l}
                aria-current={l === lang ? "page" : undefined}
                title={LANG_NAME[l]}
                className={`rounded px-1.5 py-0.5 uppercase ${l === lang ? "bg-white/20 text-white" : "text-white/70 hover:text-white"}`}
              >
                {l}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-8">
        <Link href={LANG_PATH[lang]} className="flex min-w-0 items-baseline gap-2" aria-label={t.homeLabel}>
          <span className="text-lg font-bold tracking-wide text-ink sm:text-2xl">AVOCATE</span>
          <span className="whitespace-nowrap font-condensed text-[1.2rem] font-light leading-none text-brand-dark sm:text-[1.7rem]">
            Harvest Escrow
          </span>
        </Link>
        <Link href="/app" className="btn-brand shrink-0 whitespace-nowrap px-3 py-2 text-sm sm:px-4 sm:py-2.5 sm:text-base">
          {t.openApp}
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="max-w-3xl pt-12">
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            {t.headline}
          </h1>
          <p className="mt-5 text-lg text-ink/70">
            {t.lead}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/app" className="btn-brand">
              {t.startTrade}
            </Link>
            <a href="#how-it-works" className="btn-ghost">
              {t.howItWorks}
            </a>
          </div>
        </section>

        <section aria-label={t.figureSection} className="mt-10 grid gap-4 lg:grid-cols-6">
          <div className="min-w-0 lg:col-span-4 lg:row-span-2">
            <HarvestFigure copy={t.figure} locale={lang} />
          </div>
          <div className="lg:col-span-2">
            <LiveStats copy={t.stats} />
          </div>
          <div className="card p-6 lg:col-span-2">
            <h2 className="font-semibold">{t.earlyTitle}</h2>
            <p className="mt-2 text-sm text-ink/70">{t.earlyText}</p>
          </div>
        </section>

        <section aria-labelledby="problem" className="mt-16 grid gap-4 md:grid-cols-5">
          <div className="card p-7 md:col-span-2">
            <h2 id="problem" className="text-2xl font-semibold tracking-tight">
              {t.problemTitle}
            </h2>
            {t.problem.map((p) => (
              <p key={p} className="mt-3 text-ink/70">
                {p}
              </p>
            ))}
          </div>
          <div id="how-it-works" className="card scroll-mt-6 p-7 md:col-span-3">
            <h2 className="text-2xl font-semibold tracking-tight">{t.stepsTitle}</h2>
            <ol className="mt-6 space-y-5">
              {t.steps.map(([title, text], i) => (
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
            {t.rulesTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-ink/70">
            {t.rulesIntro[0]}
            <a href={`${REPO_URL}#security-and-anti-fraud-rules`} className="text-brand-dark hover:underline">
              {t.rulesIntro[1]}
            </a>
            .
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {t.rules.map(([title, text], i) => (
              <div key={title} className={`card p-6 ${i < 2 ? "lg:col-span-3" : "lg:col-span-2"}`}>
                <dt className="font-semibold">{title}</dt>
                <dd className="mt-2 text-sm text-ink/70">{text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="faq" className="mt-16 grid gap-8 lg:grid-cols-3">
          <h2 id="faq" className="text-2xl font-semibold tracking-tight">
            {t.faqTitle}
          </h2>
          <div className="divide-y divide-ink/10 lg:col-span-2">
            {t.faq.map(({ q, a }) => (
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
            {t.builtTitle}
          </h2>
          <div className="lg:col-span-2">
            <ul className="flex flex-wrap items-center gap-x-12 gap-y-6">
              <li>
                <Image src="/logos/stellar.svg" alt="Stellar" width={122} height={30} />
                <p className="mt-1 text-xs text-ink/70">{t.builtStellar}</p>
              </li>
              <li>
                <Image src="/logos/usdc.svg" alt="USDC" width={104} height={30} />
                <p className="mt-1 text-xs text-ink/70">{t.builtUsdc}</p>
              </li>
              <li>
                <Image src="/logos/openzeppelin.svg" alt="OpenZeppelin" width={200} height={30} />
                <p className="mt-1 text-xs text-ink/70">{t.builtOz}</p>
              </li>
            </ul>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Image src="/logos/hackmeridian.png" alt="HackMeridian" width={150} height={47} />
              <p className="text-sm text-ink/70">{t.builtEvent}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/10">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-xs text-ink/70">
          <p>
            Avocate Harvest Escrow v0.0.5 {t.footerBy}{" "}
            <a href="https://avocate.io" className="text-brand-dark hover:underline">
              Avocate
            </a>{" "}
            ·{" "}
            <a href={REPO_URL} className="text-brand-dark hover:underline">
              {t.footerSource}
            </a>{" "}
            · {t.footerBeta}
          </p>
          <p>{t.footerStellar}</p>
          <p>{t.footerMarks}</p>
        </div>
      </footer>
    </div>
  );
}
