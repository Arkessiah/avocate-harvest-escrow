import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avocate Harvest Escrow",
  description:
    "Stablecoin escrow for agricultural trade on Stellar: farmers are paid in seconds once delivery is confirmed, and can be advanced cash by a financing pool.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
