export const ROLES = {
  buyer: {
    trades: true,
    label: "Buyer",
    intro:
      "Create a trade with a farmer, lock the price in USDC, and confirm delivery to pay them. If delivery fails validation or the deadline passes, the money comes back to you.",
  },
  farmer: {
    trades: true,
    label: "Farmer",
    intro:
      "See the trades where you are the seller. While a trade is funded you can ask the financing pool for an advance: you sign first and the buyer completes it.",
  },
  pool: {
    label: "Pool",
    intro:
      "Deposit USDC into the financing pool. Your shares grow with the yield farmers pay on advances, and you can withdraw the cash that is not lent out.",
  },
  validator: {
    trades: true,
    label: "Validator",
    intro:
      "Inspect the delivery of a funded trade and record the result on chain: conforming lets the trade settle, rejected refunds the buyer.",
  },
  agent: {
    trades: true,
    label: "Agent",
    intro:
      "Settles trades for the buyer once the validator has confirmed delivery. Before each release it pays for the validator's delivery check over x402 and compares it with the chain. It can only trigger the payout agreed when the trade was created.",
  },
  admin: {
    label: "Admin",
    intro:
      "Avocate's console: set the fees for new trades, onboard farmers with their advance limit, and watch every trade and the pool.",
  },
} as const;

export type Role = keyof typeof ROLES;
