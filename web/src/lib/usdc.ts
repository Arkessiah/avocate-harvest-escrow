// USDC on Stellar has 7 decimals. Amounts are bigint base units everywhere except the
// screen, which always shows 2 decimals.
const DECIMALS = 7;
const UNIT = 10n ** BigInt(DECIMALS);

export function toUnits(input: string): bigint | null {
  const m = /^\s*(\d+)(?:[.,](\d{0,7}))?\s*$/.exec(input);
  if (!m) return null;
  return BigInt(m[1]) * UNIT + BigInt((m[2] ?? "").padEnd(DECIMALS, "0"));
}

export function formatUsdc(units: bigint): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  // Round half up to cents for display only; the chain keeps the exact amount.
  const cents = (abs + UNIT / 200n) / (UNIT / 100n);
  const whole = (cents / 100n).toLocaleString("en");
  return `${negative ? "−" : ""}${whole}.${String(cents % 100n).padStart(2, "0")} USDC`;
}

export const bps = (amount: bigint, rateBps: number) => (amount * BigInt(rateBps)) / 10_000n;
