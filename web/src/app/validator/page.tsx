import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { ValidatorView } from "@/components/ValidatorView";

export const metadata = { title: "Validator · Avocate Harvest Escrow" };

export default function Page() {
  return (
    <AppShell role="validator">
      <Suspense>
        <ValidatorView />
      </Suspense>
    </AppShell>
  );
}
