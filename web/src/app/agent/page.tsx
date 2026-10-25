import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { AgentView } from "@/components/AgentView";

export const metadata = { title: "Agent · Avocate Harvest Escrow" };

export default function Page() {
  return (
    <AppShell role="agent">
      <Suspense>
        <AgentView />
      </Suspense>
    </AppShell>
  );
}
