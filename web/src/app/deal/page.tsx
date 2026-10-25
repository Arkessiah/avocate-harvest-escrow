import { AppShell } from "@/components/AppShell";
import { DealView } from "@/components/DealView";

export const metadata = { title: "Trade proposal · Avocate Harvest Escrow" };

export default function Page() {
  return (
    <AppShell>
      <DealView />
    </AppShell>
  );
}
