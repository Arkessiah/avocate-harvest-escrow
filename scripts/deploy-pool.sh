#!/usr/bin/env bash
# Deploys a new financing pool and links it to the existing platform:
#   scripts/deploy-pool.sh testnet
# Trades created from then on are financed by the new pool; open trades keep the pool they
# were created with. The previous pool's address is kept in the deployment file as
# `pool_previous`, so its depositors can still withdraw. Run scripts/set-escrow-code.sh as
# well when the escrow code changed together with the pool.
source "$(dirname "$0")/lib.sh" "$@"

MIN_XLM=15000
PLATFORM="$(json "$DEPLOYMENT" contracts.platform)"
OLD_POOL="$(json "$DEPLOYMENT" contracts.pool)"
USDC="$(cfg usdc.contract)"
[[ "$PLATFORM" =~ ^C[A-Z2-7]{55}$ ]] || { echo "no platform in $DEPLOYMENT: run scripts/deploy.sh $NETWORK first" >&2; exit 1; }

echo "== build"
(cd "$ROOT/contract" && stellar contract build >/dev/null 2>&1) || { echo "build failed: run stellar contract build in contract/" >&2; exit 1; }

echo "== upload"
ensure_xlm admin "$MIN_XLM"
out="$(with_fee_retry stellar contract upload --wasm "$ROOT/contract/target/wasm32v1-none/release/pool.wasm" \
  --source-account "$(id_name admin)" "${NET[@]}")" || { echo "upload failed" >&2; exit 1; }
HASH="$(tail -1 <<<"$out")"
[[ "$HASH" =~ ^[0-9a-f]{64}$ ]] || { echo "upload failed: $HASH" >&2; exit 1; }
echo "   pool code $HASH"

echo "== deploy"
ensure_xlm admin "$MIN_XLM"
out="$(with_fee_retry stellar contract deploy --wasm-hash "$HASH" --source-account "$(id_name admin)" "${NET[@]}" \
  -- --admin "$(addr admin)" --asset "$USDC" --platform "$PLATFORM")" || { echo "deploy failed" >&2; exit 1; }
POOL="$(tail -1 <<<"$out")"
[[ "$POOL" =~ ^C[A-Z2-7]{55}$ ]] || { echo "pool deploy failed: $POOL" >&2; exit 1; }
echo "   pool $POOL"

echo "== configure"
ensure_xlm admin "$MIN_XLM"
echo "   max advance      $(invoke admin "$POOL" set_max_advance_bps --max_advance_bps "$(cfg max_advance_bps)")"
ensure_xlm admin "$MIN_XLM"
echo "   link to platform $(invoke admin "$PLATFORM" set_pool --pool "$POOL")"
[[ "$(read_call "$PLATFORM" pool | tr -d '"')" == "$POOL" ]] || { echo "platform does not point to the new pool" >&2; exit 1; }

python3 - "$DEPLOYMENT" "$POOL" "$OLD_POOL" "$HASH" <<'EOF'
import json, sys, datetime
path, pool, old, wasm = sys.argv[1:5]
d = json.load(open(path))
d["contracts"]["pool"] = pool
d["contracts"]["pool_previous"] = old
d["wasm"]["pool"] = wasm
d["pool_deployed_at"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
json.dump(d, open(path, "w"), indent=2)
open(path, "a").write("\n")
EOF
echo "== written $DEPLOYMENT (previous pool kept as pool_previous: $OLD_POOL)"
