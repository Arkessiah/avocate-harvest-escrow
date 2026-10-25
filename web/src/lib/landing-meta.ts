import type { Metadata } from "next";
import { LANDING, LANGS, LANG_PATH, type Lang } from "@/lib/landing-copy";

// Each language version names the others, so search engines serve the right one.
export function landingMetadata(lang: Lang): Metadata {
  const t = LANDING[lang];
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: LANG_PATH[lang],
      languages: Object.fromEntries(LANGS.map((l) => [l, LANG_PATH[l]])),
    },
  };
}
