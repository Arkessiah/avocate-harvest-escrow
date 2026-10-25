#!/usr/bin/env bash
# Prepares the accounts for the agent's x402 payments:
#   scripts/setup-x402.sh testnet
# The validator sells delivery checks and receives USDC; the agent pays for them. Both need
# a USDC trustline, and the agent needs a small USDC balance (bought on the DEX, no faucet).
source "$(dirname "$0")/lib.sh" "$@"

UNIT=10000000           # 7 decimals
WANT=$((2 * UNIT))      # enough for 200 checks at 0.01 USDC
USDC="$(cfg usdc.contract)"

usdc_of() { read_call "$USDC" balance --id "$(addr "$1")" | tr -d '"'; }

for role in agent validator; do
  ensure_identity "$role"
  ensure_xlm "$role" 100
  ensure_trustline "$role"
  echo "   $role  $(addr "$role")  trustline ok"
done

have="$(usdc_of agent || echo 0)"
if (( ${have:-0} < WANT )); then
  ensure_xlm agent 2000
  stellar tx new path-payment-strict-receive --source-account "$(id_name agent)" "${NET[@]}" \
    --send-asset native --send-max $((WANT / UNIT * 20 * UNIT)) --destination "$(addr agent)" \
    --dest-asset "$(cfg usdc.asset)" --dest-amount "$WANT" >/dev/null \
    || { echo "could not buy USDC for the agent on the DEX" >&2; exit 1; }
fi
echo "   agent USDC balance: $(usdc_of agent) (base units)"
