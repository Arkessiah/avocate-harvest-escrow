import { AppShell } from "@/components/AppShell";
import { PoolView } from "@/components/PoolView";

export const metadata = { title: "Pool · Avocate Harvest Escrow" };

export default function Page() {
  return (
    <AppShell role="pool">
      <PoolView />
    </AppShell>
  );
}
