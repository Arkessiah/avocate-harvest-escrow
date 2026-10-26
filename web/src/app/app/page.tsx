import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { RolePicker } from "@/components/RolePicker";

export const metadata: Metadata = {
  title: "Choose your role · Avocate Harvest Escrow",
  description: "Enter Avocate Harvest Escrow as a professional buyer, farmer, pool investor, validator or Avocate admin.",
  alternates: { canonical: "/app" },
};

export default function Page() {
  return (
    <AppShell>
      <RolePicker />
    </AppShell>
  );
}
