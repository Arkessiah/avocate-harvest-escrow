import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

// Condensed face for the product name only; served from the app itself by next/font.
const condensed = Barlow_Condensed({ subsets: ["latin"], weight: ["300", "400"], variable: "--font-condensed" });

export const metadata: Metadata = {
  title: "Avocate Harvest Escrow",
  description:
    "Stablecoin escrow for agricultural trade on Stellar: farmers are paid in seconds once delivery is confirmed, and can be advanced cash by a financing pool.",
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
