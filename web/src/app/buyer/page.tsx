import { AppShell } from "@/components/AppShell";
import { ComingNext } from "@/components/ComingNext";

export const metadata = { title: "Buyer · Avocate Harvest Escrow" };

export default function Page() {
  return (
    <AppShell role="buyer">
      <ComingNext />
    </AppShell>
  );
}
