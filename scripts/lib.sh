# Shared helpers for deploy.sh and smoke.sh. Sourced, not executed.
# Everything network-specific comes from deploy/networks/<network>.json.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NETWORK="${1:-}"
[[ -n "$NETWORK" ]] || { echo "usage: $0 <network>   (see deploy/networks/)" >&2; exit 1; }
CONFIG="$ROOT/deploy/networks/$NETWORK.json"
DEPLOYMENT="$ROOT/deploy/deployments/$NETWORK.json"
[[ -f "$CONFIG" ]] || { echo "no network config at $CONFIG" >&2; exit 1; }

# Reads a dotted key from a JSON file: json <file> usdc.contract
json() {
  python3 -c 'import json,sys
v=json.load(open(sys.argv[1]))
for k in sys.argv[2].split("."): v=v[k]
print(v)' "$1" "$2"
}
cfg() { json "$CONFIG" "$1"; }

RPC_URL="$(cfg rpc_url)"
PASSPHRASE="$(cfg network_passphrase)"
HORIZON="$(cfg horizon_url)"
EXPLORER_TX="$(cfg explorer_tx)"
NET=(--rpc-url "$RPC_URL" --network-passphrase "$PASSPHRASE")

# Local identity names; the keys live in the stellar CLI keystore, never in the repo.
id_name() { echo "avocate-$NETWORK-$1"; }
addr() { stellar keys address "$(id_name "$1")"; }

friendbot() {
  local url
  url="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("friendbot_url",""))' "$CONFIG")"
  [[ -n "$url" ]] || { echo "$NETWORK has no friendbot: fund $1 manually" >&2; exit 1; }
  local attempt
  for attempt in 1 2 3 4 5; do
    curl -sf "$url/?addr=$1" >/dev/null && return 0
    sleep $((attempt * 3))
  done
  echo "friendbot did not fund $1 after 5 attempts" >&2
  exit 1
}

xlm_balance() {
  curl -s "$HORIZON/accounts/$1" | python3 -c 'import json,sys
d=json.load(sys.stdin)
print(next((b["balance"] for b in d.get("balances",[]) if b["asset_type"]=="native"), "0").split(".")[0])'
}

ensure_identity() {
  local name; name="$(id_name "$1")"
  stellar keys address "$name" >/dev/null 2>&1 || stellar keys generate "$name" >/dev/null 2>&1
  local a; a="$(addr "$1")"
  [[ "$(xlm_balance "$a")" != "0" ]] || friendbot "$a"
}

# Testnet rent is priced on network-wide state size and can run to thousands of XLM per
# deployment. Friendbot only funds an account once, so top-ups go through a throwaway
# account that is funded and then merged into the target.
ensure_xlm() {
  local who="$1" min="$2" a; a="$(addr "$who")"
  while (( $(xlm_balance "$a") < min )); do
    local tmp; tmp="$(id_name "faucet-$RANDOM")"
    stellar keys generate "$tmp" >/dev/null 2>&1
    friendbot "$(stellar keys address "$tmp")"
    stellar tx new account-merge --source-account "$tmp" --account "$a" "${NET[@]}" >/dev/null 2>&1 \
      || { echo "could not merge top-up account into $who" >&2; exit 1; }
    stellar keys rm --force "$tmp" >/dev/null 2>&1
  done
}

ensure_trustline() {
  local a; a="$(addr "$1")"
  local asset; asset="$(cfg usdc.asset)"
  if ! curl -s "$HORIZON/accounts/$a" | grep -q "\"asset_code\": *\"${asset%%:*}\""; then
    stellar tx new change-trust --source-account "$(id_name "$1")" --line "$asset" "${NET[@]}" >/dev/null
  fi
}

# Runs a CLI command signed by `admin`. If the account cannot cover the fee the CLI
# announced ("fee of N XLM"), tops it up to that amount and retries once.
with_fee_retry() {
  local out
  if out="$("$@" 2>&1)"; then echo "$out"; return 0; fi
  local fee
  fee="$(grep -oE 'fee of [0-9]+' <<<"$out" | grep -oE '[0-9]+' | tail -1 || true)"
  if grep -q TxInsufficientBalance <<<"$out" && [[ -n "$fee" ]]; then
    ensure_xlm admin $((fee + 2000))
    out="$("$@" 2>&1)" && { echo "$out"; return 0; }
  fi
  echo "$out" >&2
  return 1
}

# Runs a contract call and prints the explorer link of the resulting transaction.
invoke() {
  local source="$1" id="$2"; shift 2
  local out
  out="$(with_fee_retry stellar contract invoke --id "$id" --source-account "$(id_name "$source")" "${NET[@]}" -- "$@")" \
    || return 1
  # With a fee bump the outer hash is the one on-chain; it is printed last.
  local hash
  hash="$(grep -E 'Signing|/tx/' <<<"$out" | grep -oE '[0-9a-f]{64}' | tail -1 || true)"
  [[ -z "$hash" ]] || echo "$EXPLORER_TX$hash"
}

read_call() {
  local id="$1"; shift
  stellar contract invoke --id "$id" --source-account "$(id_name admin)" "${NET[@]}" --send=no -- "$@" 2>/dev/null | tail -1
}
