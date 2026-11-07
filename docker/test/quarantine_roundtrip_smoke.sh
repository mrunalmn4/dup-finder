#!/usr/bin/env bash
# API: scan → trash one candidate → list quarantine → restore → file back
set -euo pipefail
API="${API:-http://127.0.0.1:7420}"
TOKEN="${TOKEN:-dev-token-change-me}"
AUTH="Authorization: Bearer ${TOKEN}"
WORKDIR="${WORKDIR:-/app/artifacts/q-roundtrip}"
rm -rf "$WORKDIR"
mkdir -p "$WORKDIR/a" "$WORKDIR/b"
printf 'same-bytes-for-dup\n' >"$WORKDIR/a/keep.txt"
printf 'same-bytes-for-dup\n' >"$WORKDIR/b/drop.txt"
printf 'unique\n' >"$WORKDIR/a/unique.txt"

SCAN=$(curl -sf -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"roots\":[\"${WORKDIR}\"],\"index_path\":\"${WORKDIR}/index.sqlite\"}" \
  "${API}/v1/scan")
ID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['scan_id'])" <<<"$SCAN")
SUG=$(curl -sf -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"scan_id\":\"${ID}\"}" "${API}/v1/suggest")
KEEP=$(python3 -c "import json,sys; print(json.load(sys.stdin)['groups'][0]['keep']['path'])" <<<"$SUG")
DROP=$(python3 -c "import json,sys; print(json.load(sys.stdin)['groups'][0]['delete_candidates'][0]['path'])" <<<"$SUG")
test -f "$DROP"

DEL=$(curl -sf -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"scan_id\":\"${ID}\",\"paths\":[\"${DROP}\"],\"keep\":[\"${KEEP}\"],\"mode\":\"trash\",\"confirm\":true}" \
  "${API}/v1/delete")
python3 -c "import json,sys; d=json.load(sys.stdin); assert not d.get('refused'); kinds=[o['kind'].lower() for o in d['outcomes']]; assert any(k=='deleted' for k in kinds), d; print('trash_ok')" <<<"$DEL"
test ! -f "$DROP"

Q=$(curl -sf -G -H "$AUTH" --data-urlencode "roots=${WORKDIR}" "${API}/v1/quarantine")
QPATH=$(python3 -c "import json,sys; d=json.load(sys.stdin); assert d, 'quarantine empty (OS trash only?)'; print(d[0]['path'])" <<<"$Q")
REST=$(curl -sf -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"path\":\"${QPATH}\",\"roots\":[\"${WORKDIR}\"]}" "${API}/v1/restore")
python3 -c "import json,sys; print('restored', json.load(sys.stdin)['path'])" <<<"$REST"
# restored beside trash parent
python3 - <<PY
import os, glob
hits = []
for root, dirs, files in os.walk("$WORKDIR"):
    if ".dup-finder-trash" in root: continue
    for f in files:
        if f.startswith("drop") or f == "drop.txt":
            hits.append(os.path.join(root, f))
assert hits, "restored file missing"
print("quarantine_roundtrip_ok", hits[0])
PY
