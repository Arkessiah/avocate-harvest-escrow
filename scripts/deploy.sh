#!/usr/bin/env bash
# Deploys the platform and the financing pool to a network, from a clean checkout:
#   scripts/deploy.sh testnet
# Writes the resulting addresses to deploy/deployments/<network>.json.
source "$(dirname "$0")/lib.sh" "$@"

command -v stellar >/dev/null || { echo "stellar CLI not found (https://developers.stellar.org/docs/tools/cli)" >&2; exit 1; }
rustup target list --installed | grep -q wasm32v1-none || rustup target add wasm32v1-none

# Floor kept on the admin account; calls that cost more top it up on demand (lib.sh).
MIN_XLM=15000

echo "== identities ($NETWORK)"
for role in admin treasury agent validator; do
  ensure_identity "$role"
  echo "   $role  $(addr "$role")"
done
ensure_trustline treasury

echo "== build"
(cd "$ROOT/contract" && stellar contract build >/dev/null 2>&1) || { echo "build failed: run stellar contract build in contract/" >&2; exit 1; }
WASM="$ROOT/contract/target/wasm32v1-none/release"

upload() {
  ensure_xlm admin "$MIN_XLM"
  local out
  out="$(with_fee_retry stellar contract upload --wasm "$WASM/$1.wasm" --source-account "$(id_name admin)" "${NET[@]}")" \
    || { echo "upload of $1 failed" >&2; exit 1; }
  tail -1 <<<"$out"
}

deploy() {
  local hash="$1"; shift
  ensure_xlm admin "$MIN_XLM"
  local out
  out="$(with_fee_retry stellar contract deploy --wasm-hash "$hash" --source-account "$(id_name admin)" "${NET[@]}" -- "$@")" \
    || { echo "deploy failed" >&2; exit 1; }
  tail -1 <<<"$out"
}

echo "== upload"
ESCROW_WASM="$(upload escrow)"
PLATFORM_WASM="$(upload platform)"
POOL_WASM="$(upload pool)"
for h in "$ESCROW_WASM" "$PLATFORM_WASM" "$POOL_WASM"; do
  [[ "$h" =~ ^[0-9a-f]{64}$ ]] || { echo "upload failed: $h" >&2; exit 1; }
done
echo "   escrow $ESCROW_WASM"

USDC="$(cfg usdc.contract)"
FEES="$(python3 -c 'import json,sys; print(json.dumps(json.load(open(sys.argv[1]))["fees"]))' "$CONFIG")"

echo "== deploy"
PLATFORM="$(deploy "$PLATFORM_WASM" --admin "$(addr admin)" --token "$USDC" --treasury "$(addr treasury)" \
  --agent "$(addr agent)" --validator "$(addr validator)" --escrow_wasm "$ESCROW_WASM" --fees "$FEES")"
[[ "$PLATFORM" =~ ^C[A-Z2-7]{55}$ ]] || { echo "platform deploy failed: $PLATFORM" >&2; exit 1; }
echo "   platform $PLATFORM"

POOL="$(deploy "$POOL_WASM" --admin "$(addr admin)" --asset "$USDC" --platform "$PLATFORM")"
[[ "$POOL" =~ ^C[A-Z2-7]{55}$ ]] || { echo "pool deploy failed: $POOL" >&2; exit 1; }
echo "   pool     $POOL"

echo "== configure"
ensure_xlm admin "$MIN_XLM"
echo "   link pool        $(invoke admin "$PLATFORM" set_pool --pool "$POOL")"
ensure_xlm admin "$MIN_XLM"
echo "   max advance      $(invoke admin "$POOL" set_max_advance_bps --max_advance_bps "$(cfg max_advance_bps)")"

python3 - "$DEPLOYMENT" <<EOF
import json, sys, datetime
json.dump({
  "network": "$NETWORK",
  "deployed_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
  "contracts": {"platform": "$PLATFORM", "pool": "$POOL", "usdc": "$USDC"},
  "wasm": {"escrow": "$ESCROW_WASM", "platform": "$PLATFORM_WASM", "pool": "$POOL_WASM"},
  "accounts": {"admin": "$(addr admin)", "treasury": "$(addr treasury)", "agent": "$(addr agent)", "validator": "$(addr validator)"},
}, open(sys.argv[1], "w"), indent=2)
open(sys.argv[1], "a").write("\n")
EOF
echo "== written $DEPLOYMENT"
