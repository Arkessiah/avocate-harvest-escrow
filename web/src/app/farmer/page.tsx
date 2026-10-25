import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { FarmerView } from "@/components/FarmerView";

export const metadata = { title: "Farmer · Avocate Harvest Escrow" };

export default function Page() {
  return (
    <AppShell role="farmer">
      <Suspense>
        <FarmerView />
      </Suspense>
    </AppShell>
  );
}
