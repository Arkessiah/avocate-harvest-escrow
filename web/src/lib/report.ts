// Hash recorded on chain for an inspection report. The report itself stays off-chain;
// whoever holds it can recompute this and check it against the trade. Without a report the
// hash still binds the verdict to the trade. Shared by the browser and the demo route so
// both record the same value for the same input.
export async function reportHash(report: string, escrowId: string, ok: boolean): Promise<Uint8Array> {
  const text = report || `${escrowId}:${ok}`;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

export const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export const MAX_REPORT = 1_000;
