// What a scanned QR code means to the app. Wallets show an account as a bare G… address or
// as a SEP-7 URI (web+stellar:pay?destination=G…); our own codes are links to a proposal
// (/deal#d=…) or to a trade (?trade=C…).
export type Scanned = { kind: "address"; address: string } | { kind: "link"; path: string };

const ACCOUNT = /\bG[A-Z2-7]{55}\b/;
const TRADE = /^C[A-Z2-7]{55}$/;

// Only links to one of `origins` are followed, and only as a path inside the app: a code
// printed by someone else must not be able to send the user to another site.
export function readScan(text: string, origins: string[]): Scanned | null {
  const value = text.trim();
  let url: URL | null = null;
  try {
    url = new URL(value);
  } catch {
    // Not a URL: a bare address, or a stellar: URI below.
  }

  if (url && (url.protocol === "http:" || url.protocol === "https:")) {
    if (!origins.includes(url.origin)) return null;
    const trade = url.searchParams.get("trade");
    const isDeal = url.pathname === "/deal" && url.hash.startsWith("#d=");
    if (!isDeal && !(trade && TRADE.test(trade))) return null;
    return { kind: "link", path: url.pathname + url.search + url.hash };
  }

  const account = value.match(ACCOUNT);
  return account ? { kind: "address", address: account[0] } : null;
}
