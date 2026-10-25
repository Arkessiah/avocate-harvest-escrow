export const ROLES = {
  buyer: {
    label: "Buyer",
    intro:
      "Create a trade with a farmer, lock the price in USDC, and confirm delivery to pay them. If delivery fails validation or the deadline passes, the money comes back to you.",
  },
  farmer: {
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
    label: "Validator",
    intro:
      "Inspect the delivery of a funded trade and record the result on chain: conforming lets the trade settle, rejected refunds the buyer.",
  },
  agent: {
    label: "Agent",
    intro:
      "Settles a trade for the buyer once the validator has confirmed delivery. It can only trigger the payout agreed when the trade was created.",
  },
  admin: {
    label: "Admin",
    intro:
      "Avocate's console: set the fees for new trades, onboard farmers with their advance limit, and watch every trade and the pool.",
  },
} as const;

export type Role = keyof typeof ROLES;
