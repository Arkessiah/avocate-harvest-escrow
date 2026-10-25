export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://avocate-harvest-escrow.vercel.app";

export const SITE_NAME = "Avocate Harvest Escrow";

export const SITE_DESCRIPTION =
  "USDC escrow on Stellar for agricultural trade: farmers are paid in seconds once delivery is confirmed, and can get an advance from a financing pool.";

export const REPO_URL = "https://github.com/Arkessiah/avocate-harvest-escrow";

// One source for the landing page's FAQ section and its FAQPage structured data.
export const FAQ: { q: string; a: string }[] = [
  {
    q: "What is Avocate Harvest Escrow?",
    a: "A USDC escrow on the Stellar network for agricultural trade. Each trade between a buyer and a farmer gets its own smart contract that holds the price until the delivery is checked, then pays the farmer in seconds.",
  },
  {
    q: "How does the farmer get paid?",
    a: "The buyer locks the price in the trade's contract. Once an independent validator confirms the delivery, the buyer, or a limited agent acting for them, releases the payment and the farmer receives it in USDC within seconds.",
  },
  {
    q: "What happens if the delivery is wrong or never arrives?",
    a: "If the validator rejects the delivery, the buyer can take the whole deposit back, fee included. If the trade simply reaches its deadline without being settled, the buyer can also take the money back.",
  },
  {
    q: "How does an advance work, and what does it cost?",
    a: "While a trade is funded, a farmer onboarded by Avocate can ask a financing pool for up to 80% of the price. The farmer signs first and the buyer completes the request. When the trade settles, the pool is repaid the advance plus 2% for its depositors, and Avocate charges 0.2% of the advance.",
  },
  {
    q: "What stops a buyer and a farmer from teaming up against the pool?",
    a: "If a financed trade lapses at its deadline, the pool is repaid first and the buyer only gets the rest, so letting a trade expire gains them nothing. Only a rejection by the independent validator refunds the buyer in full, and that loss is shared by all depositors.",
  },
  {
    q: "Who can move the money?",
    a: "Only the trade's own rules. The buyer can pay or, under the conditions above, take a refund. The agent can only trigger the payout agreed when the trade was created, after a conforming validation. Avocate's admin sets fees for new trades but cannot touch the money held in a trade.",
  },
  {
    q: "Is this real money?",
    a: "No. This is a beta running on the Stellar test network with test USDC. Nothing on this site moves real funds.",
  },
];
