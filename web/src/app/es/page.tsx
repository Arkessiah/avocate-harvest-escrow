import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { landingMetadata } from "@/lib/landing-meta";

export const metadata: Metadata = landingMetadata("es");

export default function Page() {
  return <Landing lang="es" />;
}
