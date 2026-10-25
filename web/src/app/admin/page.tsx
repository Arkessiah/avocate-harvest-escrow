import { AppShell } from "@/components/AppShell";
import { ComingNext } from "@/components/ComingNext";

export const metadata = { title: "Admin · Avocate Harvest Escrow" };

export default function Page() {
  return (
    <AppShell role="admin">
      <ComingNext />
    </AppShell>
  );
}
