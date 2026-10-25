import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

// Condensed face for the product name only; served from the app itself by next/font.
const condensed = Barlow_Condensed({ subsets: ["latin"], weight: ["300", "400"], variable: "--font-condensed" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { type: "website", siteName: SITE_NAME, title: SITE_NAME, description: SITE_DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={condensed.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
