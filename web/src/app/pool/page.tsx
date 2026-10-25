import { AppShell } from "@/components/AppShell";
import { ComingNext } from "@/components/ComingNext";

export const metadata = { title: "Pool · Avocate Harvest Escrow" };

export default function Page() {
  return (
    <AppShell role="pool">
      <ComingNext />
    </AppShell>
  );
}
