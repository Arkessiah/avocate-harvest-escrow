import { AppShell } from "@/components/AppShell";
import { ComingNext } from "@/components/ComingNext";

export const metadata = { title: "Farmer · Avocate Harvest Escrow" };

export default function Page() {
  return (
    <AppShell role="farmer">
      <ComingNext />
    </AppShell>
  );
}
