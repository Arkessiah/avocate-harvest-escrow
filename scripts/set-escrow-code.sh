#!/usr/bin/env bash
# Uploads the current escrow code and makes the platform use it for trades created from now
# on. Open trades keep the code they were deployed with:
#   scripts/set-escrow-code.sh testnet
# Records the new code hash in deploy/deployments/<network>.json.
source "$(dirname "$0")/lib.sh" "$@"

MIN_XLM=15000
PLATFORM="$(json "$DEPLOYMENT" contracts.platform)"
[[ "$PLATFORM" =~ ^C[A-Z2-7]{55}$ ]] || { echo "no platform in $DEPLOYMENT: run scripts/deploy.sh $NETWORK first" >&2; exit 1; }

echo "== build"
(cd "$ROOT/contract" && stellar contract build >/dev/null 2>&1) || { echo "build failed: run stellar contract build in contract/" >&2; exit 1; }

echo "== upload"
ensure_xlm admin "$MIN_XLM"
out="$(with_fee_retry stellar contract upload --wasm "$ROOT/contract/target/wasm32v1-none/release/escrow.wasm" \
  --source-account "$(id_name admin)" "${NET[@]}")" || { echo "upload failed" >&2; exit 1; }
HASH="$(tail -1 <<<"$out")"
[[ "$HASH" =~ ^[0-9a-f]{64}$ ]] || { echo "upload failed: $HASH" >&2; exit 1; }
echo "   escrow $HASH"

echo "== set_escrow_wasm on $PLATFORM"
ensure_xlm admin "$MIN_XLM"
echo "   tx $(invoke admin "$PLATFORM" set_escrow_wasm --escrow_wasm "$HASH")"

python3 - "$DEPLOYMENT" "$HASH" <<'EOF'
import json, sys, datetime
path, wasm = sys.argv[1], sys.argv[2]
d = json.load(open(path))
d["wasm"]["escrow"] = wasm
d["escrow_code_set_at"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
json.dump(d, open(path, "w"), indent=2)
open(path, "a").write("\n")
EOF
echo "== written $DEPLOYMENT"
