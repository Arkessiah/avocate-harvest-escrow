#!/usr/bin/env bash
# Replaces the code of the deployed platform in place, keeping its address, fees and registry:
#   scripts/upgrade-platform.sh testnet
# Records the new code hash in deploy/deployments/<network>.json.
source "$(dirname "$0")/lib.sh" "$@"

MIN_XLM=15000
PLATFORM="$(json "$DEPLOYMENT" contracts.platform)"
[[ "$PLATFORM" =~ ^C[A-Z2-7]{55}$ ]] || { echo "no platform in $DEPLOYMENT: run scripts/deploy.sh $NETWORK first" >&2; exit 1; }

echo "== build"
(cd "$ROOT/contract" && stellar contract build >/dev/null 2>&1) || { echo "build failed: run stellar contract build in contract/" >&2; exit 1; }

COUNT_BEFORE="$(read_call "$PLATFORM" escrow_count)"

echo "== upload"
ensure_xlm admin "$MIN_XLM"
out="$(with_fee_retry stellar contract upload --wasm "$ROOT/contract/target/wasm32v1-none/release/platform.wasm" \
  --source-account "$(id_name admin)" "${NET[@]}")" || { echo "upload failed" >&2; exit 1; }
HASH="$(tail -1 <<<"$out")"
[[ "$HASH" =~ ^[0-9a-f]{64}$ ]] || { echo "upload failed: $HASH" >&2; exit 1; }
echo "   platform $HASH"

echo "== upgrade $PLATFORM"
ensure_xlm admin "$MIN_XLM"
echo "   tx $(invoke admin "$PLATFORM" upgrade --new_wasm "$HASH")"

# The registry must survive the upgrade untouched.
COUNT_AFTER="$(read_call "$PLATFORM" escrow_count)"
[[ "$COUNT_AFTER" == "$COUNT_BEFORE" ]] || { echo "registry changed: $COUNT_BEFORE -> $COUNT_AFTER" >&2; exit 1; }
echo "   registry intact ($COUNT_AFTER trades)"

python3 - "$DEPLOYMENT" "$HASH" <<'EOF'
import json, sys, datetime
path, wasm = sys.argv[1], sys.argv[2]
d = json.load(open(path))
d["wasm"]["platform"] = wasm
d["upgraded_at"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
json.dump(d, open(path, "w"), indent=2)
open(path, "a").write("\n")
EOF
echo "== written $DEPLOYMENT"
