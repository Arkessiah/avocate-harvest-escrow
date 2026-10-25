import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer, type HTTPAdapter } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import { network } from "@/lib/network";

// The validator sells delivery checks over x402: an agent pays a small USDC fee per query,
// settled on Stellar by the facilitator, which also sponsors the network fee.
export const X402_NETWORK = network.name === "testnet" ? "stellar:testnet" : "stellar:pubnet";
export const CHECK_PRICE = "$0.01";
export const CHECK_PATH = "/api/x402/delivery-check";
const FACILITATOR_URL = process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";

let ready: Promise<x402HTTPResourceServer> | null = null;

// Initialising asks the facilitator what it supports, so it happens once per instance and
// is retried on the next request if the facilitator was unreachable.
export function deliveryCheckServer(): Promise<x402HTTPResourceServer> {
  ready ??= (async () => {
    const resources = new x402ResourceServer(new HTTPFacilitatorClient({ url: FACILITATOR_URL })).register(
      X402_NETWORK,
      new ExactStellarScheme(),
    );
    const server = new x402HTTPResourceServer(resources, {
      [`GET ${CHECK_PATH}`]: {
        accepts: { scheme: "exact", price: CHECK_PRICE, network: X402_NETWORK, payTo: network.accounts.validator },
        description: "Validator's delivery check for an Avocate trade: the recorded verdict and report fingerprint.",
      },
    });
    await server.initialize();
    return server;
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

export function adapterFor(req: Request): HTTPAdapter {
  const url = new URL(req.url);
  return {
    getHeader: (name) => req.headers.get(name) ?? undefined,
    getMethod: () => req.method,
    getPath: () => url.pathname,
    getUrl: () => req.url,
    getAcceptHeader: () => req.headers.get("accept") ?? "",
    getUserAgent: () => req.headers.get("user-agent") ?? "",
    getQueryParams: () => Object.fromEntries(url.searchParams),
    getQueryParam: (name) => url.searchParams.get(name) ?? undefined,
  };
}
