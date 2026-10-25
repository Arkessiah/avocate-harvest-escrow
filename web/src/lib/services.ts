"use client";

// Calls one of the app's service routes, where Avocate's agent (or the demo validator)
// signs on the server. The route checks everything again before signing.
export async function callService(
  path: string,
  body: Record<string, unknown>,
  onStep: (step: string) => void,
): Promise<{ hash: string; result: unknown }> {
  onStep("Send the request to the service");
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { hash?: string; paymentTx?: string; error?: string };
  if (res.status === 404 && path.includes("validator")) {
    throw new Error("The demo validator is switched off on this deployment. Sign with the validator's wallet instead.");
  }
  if (!res.ok || !data.hash) throw new Error(data.error ?? `The service answered ${res.status}.`);
  if (data.paymentTx) onStep(`Delivery check paid over x402 (tx ${data.paymentTx.slice(0, 6)}…)`);
  onStep("Signed and submitted by the service");
  onStep("Confirmed on the ledger");
  return { hash: data.hash, result: data };
}
