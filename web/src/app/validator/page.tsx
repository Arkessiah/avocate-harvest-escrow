import { AppShell } from "@/components/AppShell";
import { ComingNext } from "@/components/ComingNext";

export const metadata = { title: "Validator · Avocate Harvest Escrow" };

export default function Page() {
  return (
    <AppShell role="validator">
      <ComingNext />
    </AppShell>
  );
}
