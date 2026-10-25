#!/usr/bin/env bash
# End-to-end check on a deployed network: two financed trades with real USDC.
#   A: advance -> conforming validation -> agent settles  (pool repaid with yield)
#   B: advance -> rejected delivery     -> buyer refunded (pool books the loss)
#   scripts/smoke.sh testnet
# Writes the transaction links to deploy/deployments/<network>-smoke.md.
source "$(dirname "$0")/lib.sh" "$@"

[[ -f "$DEPLOYMENT" ]] || { echo "deploy first: scripts/deploy.sh $NETWORK" >&2; exit 1; }
[[ -d "$ROOT/scripts/node_modules" ]] || (cd "$ROOT/scripts" && pnpm install --frozen-lockfile >/dev/null)

PLATFORM="$(json "$DEPLOYMENT" contracts.platform)"
POOL="$(json "$DEPLOYMENT" contracts.pool)"
USDC="$(cfg usdc.contract)"
UNIT=10000000          # 7 decimals
PRICE=$((10 * UNIT))
ADVANCE=$((8 * UNIT))  # 80% of the price, the pool's cap
REPORT="$ROOT/deploy/deployments/$NETWORK-smoke.md"

usdc_of() { read_call "$USDC" balance --id "$(addr "$1")" | tr -d '"'; }
fmt() { python3 -c "import sys; print(f'{int(sys.argv[1])/1e7:.4f}')" "$1"; }
log() { echo "$1"; echo "$1" >>"$REPORT"; }
step() { log "| $1 | ${2:-} |"; }

# USDC on testnet comes from the DEX (XLM -> USDC path payment), no faucet needed.
fund_usdc() {
  local who="$1" need="$2"
  (( $(usdc_of "$who") >= need )) && return 0
  ensure_xlm "$who" 2000
  stellar tx new path-payment-strict-receive --source-account "$(id_name "$who")" "${NET[@]}" \
    --send-asset native --send-max $((need / UNIT * 3 * UNIT)) --destination "$(addr "$who")" \
    --dest-asset "$(cfg usdc.asset)" --dest-amount "$need" >/dev/null 2>&1
}

# Farmer submits, buyer co-signs only their authorization (scripts/cosign-advance.mjs).
advance() {
  FARMER_SECRET="$(stellar keys show "$(id_name farmer)")" \
  BUYER_SECRET="$(stellar keys show "$(id_name buyer)")" \
    node "$ROOT/scripts/cosign-advance.mjs" "$CONFIG" "$POOL" "$1" "$ADVANCE"
}

open_trade() {
  local out
  out="$(with_fee_retry stellar contract invoke --id "$PLATFORM" --source-account "$(id_name buyer)" "${NET[@]}" \
    -- create_escrow --buyer "$(addr buyer)" --seller "$(addr farmer)" --amount "$PRICE" \
    --deadline $(( $(date +%s) + 3600 )))"
  tail -1 <<<"$out" | tr -d '"'
}

report_hash() { python3 -c "import os; print(os.urandom(32).hex())"; }

echo "== accounts"
for role in depositor buyer farmer; do
  ensure_identity "$role"
  ensure_trustline "$role"
done
fund_usdc depositor $((20 * UNIT))
fund_usdc buyer $((25 * UNIT))

{
  echo "# Smoke test on $NETWORK"
  echo
  echo "Run on $(date -u +%Y-%m-%dT%H:%M:%SZ) against platform \`$PLATFORM\` and pool \`$POOL\`."
  echo "Price 10 USDC per trade, advance 8 USDC (80%), yield 2%, financing fee 0.2%, trade fee 0.1%."
  echo
  echo "| Step | Transaction |"
  echo "|---|---|"
} >"$REPORT"

step "Admin onboards the farmer (limit 50 USDC)" "$(invoke admin "$POOL" onboard --farmer "$(addr farmer)" --limit $((50 * UNIT)))"
step "Depositor puts 20 USDC in the pool" "$(invoke depositor "$POOL" deposit --assets $((20 * UNIT)) \
  --receiver "$(addr depositor)" --from "$(addr depositor)" --operator "$(addr depositor)")"
POOL_START="$(read_call "$POOL" total_assets | tr -d '"')"

A="$(open_trade)"
step "**A** buyer opens trade \`$A\`" ""
step "A: buyer funds 10 + 0.1%" "$(invoke buyer "$A" fund)"
step "A: farmer requests 8 USDC, buyer co-signs" "$(advance "$A")"
step "A: validator attests a conforming delivery" "$(invoke validator "$A" validate --ok true --report_hash "$(report_hash)")"
step "A: agent settles" "$(invoke agent "$A" agent_release)"
POOL_AFTER_A="$(read_call "$POOL" total_assets | tr -d '"')"

B="$(open_trade)"
step "**B** buyer opens trade \`$B\`" ""
step "B: buyer funds 10 + 0.1%" "$(invoke buyer "$B" fund)"
step "B: farmer requests 8 USDC, buyer co-signs" "$(advance "$B")"
step "B: validator rejects the delivery" "$(invoke validator "$B" validate --ok false --report_hash "$(report_hash)")"
step "B: buyer is refunded in full" "$(invoke buyer "$B" refund)"
POOL_AFTER_B="$(read_call "$POOL" total_assets | tr -d '"')"

{
  echo
  echo "| Pool value | USDC |"
  echo "|---|---|"
  echo "| Before the trades | $(fmt "$POOL_START") |"
  echo "| After A (repaid 8 + 2%) | $(fmt "$POOL_AFTER_A") |"
  echo "| After B (8 written off) | $(fmt "$POOL_AFTER_B") |"
  echo
  echo "The pool value also includes the yield accruing on any other loan still open on this"
  echo "deployment, so the changes can differ from the round figures by that accrual."
  echo
  echo "Trade A ended \`$(read_call "$A" state | tr -d '[]"')\`, trade B \`$(read_call "$B" state | tr -d '[]"')\`."
} >>"$REPORT"
echo "== written $REPORT"
cat "$REPORT"
