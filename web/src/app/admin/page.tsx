import { AppShell } from "@/components/AppShell";
import { AdminView } from "@/components/AdminView";

export const metadata = { title: "Admin · Avocate Harvest Escrow" };

export default function Page() {
  return (
    <AppShell role="admin">
      <AdminView />
    </AppShell>
  );
}
