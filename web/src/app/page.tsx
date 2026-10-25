import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { landingMetadata } from "@/lib/landing-meta";

export const metadata: Metadata = landingMetadata("en");

export default function Page() {
  return <Landing lang="en" />;
}
