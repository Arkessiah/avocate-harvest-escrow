import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { BuyerView } from "@/components/BuyerView";

export const metadata = { title: "Buyer · Avocate Harvest Escrow" };

export default function Page() {
  return (
    <AppShell role="buyer">
      <Suspense>
        <BuyerView />
      </Suspense>
    </AppShell>
  );
}
