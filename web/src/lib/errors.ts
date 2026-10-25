// Mirror the `#[contracterror]` enums in contract/contracts/*/src/lib.rs
// (discriminant = index + 1). Keep in the same order when a contract adds an error.
const CONTRACT_ERRORS: Record<string, string[]> = {
  escrow: [
    "InvalidState",
    "NotExpired",
    "InvalidAmount",
    "InvalidFee",
    "InvalidDeadline",
    "AlreadyValidated",
    "NotValidated",
    "AlreadyAdvanced",
    "AdvanceTooLarge",
    "NotAParty",
    "DeliveryConforming",
  ],
  platform: ["InvalidFee", "PoolNotSet"],
  pool: [
    "InvalidAmount",
    "OperatorNotOwner",
    "ZeroShares",
    "ExceedsMax",
    "NotAnAvocateTrade",
    "WrongPool",
    "NotFunded",
    "FarmerNotOnboarded",
    "AdvanceOverLimit",
    "ExposureOverLimit",
    "InsufficientCash",
    "TooManyLoans",
    "UnknownLoan",
    "Expired",
    "InvalidFee",
    "DepositsPaused",
    "InvalidRepayment",
  ],
};

export type ContractKind = keyof typeof CONTRACT_ERRORS;

// Simulation and submission failures carry the whole diagnostic log. The user needs one
// line: the contract error name when there is one, or the common wallet and account cases.
// The wallet kit rejects with plain objects such as { code: -1, message: "..." }, not Errors.
const messageOf = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === "string" ? m : JSON.stringify(e);
};

// Closing the wallet's own window is a choice, not a failure.
export const closedByUser = (e: unknown) => /closed the modal|user closed/i.test(messageOf(e));

export function describeError(e: unknown, kind?: ContractKind): string {
  const raw = messageOf(e);
  if (closedByUser(e)) return "The wallet window was closed before confirming.";
  const code = /Error\(Contract, #(\d+)\)/.exec(raw)?.[1];
  if (code) {
    const name = kind ? CONTRACT_ERRORS[kind][Number(code) - 1] : undefined;
    return `The contract rejected the call (${name ?? `error #${code}`}).`;
  }
  if (/reject|declin|denied|cancel/i.test(raw)) return "The request was cancelled in the wallet.";
  if (/trustline entry is missing|resulting balance is not within the allowed range|insufficient/i.test(raw)) {
    return "Not enough balance for this operation (USDC, or XLM for the network fee).";
  }
  if (/Account not found|does not exist/i.test(raw)) {
    return "This account is not funded on the network yet. Fund it with XLM first.";
  }
  if (/txBadSeq/.test(raw)) return "The account sent another transaction in the meantime. Start this action again.";
  if (/txTooLate/.test(raw)) return "This transaction expired before it was submitted. Start it again.";
  if (/Error\(Auth, /.test(raw)) return "This wallet is not allowed to make this call.";
  return raw.split("\n")[0].slice(0, 200);
}
