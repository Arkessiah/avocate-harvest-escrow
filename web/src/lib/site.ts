import { LANDING } from "@/lib/landing-copy";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://avocate-harvest-escrow.vercel.app";

export const SITE_NAME = "Avocate Harvest Escrow";

export const SITE_DESCRIPTION =
  "USDC escrow on Stellar for agricultural trade: farmers are paid in seconds once delivery is confirmed, and can get an advance from a financing pool.";

export const REPO_URL = "https://github.com/Arkessiah/avocate-harvest-escrow";

// The English FAQ, also used for structured data; every language lives in lib/landing-copy.
export const FAQ = LANDING.en.faq;
