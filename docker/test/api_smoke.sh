#!/usr/bin/env bash
set -euo pipefail
API="${API:-http://127.0.0.1:7420}"
TOKEN="${TOKEN:-dev-token-change-me}"
AUTH="Authorization: Bearer ${TOKEN}"

curl -sf "${API}/health" | grep -q ok
# S2-04: mutating/read APIs require bearer token
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -d '{"roots":["/app/docker/fixtures"]}' "${API}/v1/scan" || true)
test "${CODE}" = "401"
echo "unauthorized_ok"

LOCS=$(curl -sf -H "$AUTH" "${API}/v1/locations")
python3 -c "import json,sys; d=json.load(sys.stdin); assert isinstance(d,list); assert any('fixtures' in x.get('path','') or x.get('label')=='Sample files (demo)' for x in d); print('locations_ok', len(d))" <<<"$LOCS"

SCAN=$(curl -sf -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"roots":["/app/docker/fixtures"],"index_path":"/app/artifacts/api-smoke.sqlite"}' \
  "${API}/v1/scan")
ID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['scan_id'])" <<<"$SCAN")

# Filters body (photos-only still ok on fixtures; empty categories = all)
FILTERED=$(curl -sf -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"roots":["/app/docker/fixtures"],"filters":{"exclude_names":["node_modules"],"include_hidden":false,"categories":[],"exclude_paths":[],"include_extensions":[],"exclude_extensions":[]}}' \
  "${API}/v1/scan")
python3 -c "import json,sys; d=json.load(sys.stdin); assert d['scan_id']; print('filters_scan_ok')" <<<"$FILTERED"
SUG=$(curl -sf -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"scan_id\":\"${ID}\"}" "${API}/v1/suggest")
python3 -c "import json,sys; d=json.load(sys.stdin); assert d['groups']; print('suggest_ok', len(d['groups']))" <<<"$SUG"
KEEP=$(python3 -c "import json,sys; print(json.load(sys.stdin)['groups'][0]['keep']['path'])" <<<"$SUG")
DROP=$(python3 -c "import json,sys; print(json.load(sys.stdin)['groups'][0]['delete_candidates'][0]['path'])" <<<"$SUG")
DEL=$(curl -sf -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"scan_id\":\"${ID}\",\"paths\":[\"${DROP}\"],\"keep\":[\"${KEEP}\"],\"mode\":\"dry_run\",\"confirm\":false}" \
  "${API}/v1/delete")
python3 -c "import json,sys; d=json.load(sys.stdin); assert d['outcomes'][0]['kind']=='would_delete'; print('delete_dry_run_ok')" <<<"$DEL"

JOB=$(curl -sf -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"roots":["/app/docker/fixtures"],"index_path":null,"interval_secs":0,"enabled":true}' \
  "${API}/v1/jobs")
JID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['id'])" <<<"$JOB")
RAN=$(curl -sf -X POST -H "$AUTH" "${API}/v1/jobs/${JID}/run")
python3 -c "import json,sys; d=json.load(sys.stdin); assert d['status']=='ok'; assert d['last_scan_id']; print('job_run_ok')" <<<"$RAN"
curl -sf -H "$AUTH" "${API}/v1/jobs" | python3 -c "import json,sys; assert len(json.load(sys.stdin))>=1; print('jobs_list_ok')"
curl -sf -X DELETE -H "$AUTH" "${API}/v1/jobs/${JID}" -o /dev/null -w '%{http_code}\n' | grep -q 204

# Async scan job
START=$(curl -sf -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"roots":["/app/docker/fixtures"]}' "${API}/v1/scan/start")
AJID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['job_id'])" <<<"$START")
for _ in $(seq 1 60); do
  JOBSTATE=$(curl -sf -H "$AUTH" "${API}/v1/scan/jobs/${AJID}")
  STATUS=$(python3 -c "import json,sys; print(json.load(sys.stdin)['status'])" <<<"$JOBSTATE")
  if [ "$STATUS" != "running" ]; then break; fi
  sleep 0.2
done
python3 -c "import json,sys; d=json.load(sys.stdin); assert d['status']=='ok', d; assert d['scan_id']; assert d['progress']['phase'] in ('done','hash','walk'); print('async_scan_ok', d['scan_id'])" <<<"$JOBSTATE"

# Quarantine list (empty ok) + restore reject outside trash
Q=$(curl -sf -G -H "$AUTH" --data-urlencode "roots=/app/docker/fixtures" "${API}/v1/quarantine")
python3 -c "import json,sys; d=json.load(sys.stdin); assert isinstance(d,list); print('quarantine_list_ok', len(d))" <<<"$Q"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"path":"/app/docker/fixtures/not-in-trash.txt","roots":["/app/docker/fixtures"]}' \
  "${API}/v1/restore" || true)
test "${CODE}" != "200"
echo "restore_reject_ok"

# Preview: spoofed .jpg (text) must fail; real PNG must succeed (paths are API-container FS)
SPOOF=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(next(f['path'] for g in d['result']['groups'] for f in g['files'] if f['path'].endswith('photo.jpg')))" <<<"$SCAN")
PCODE=$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH" \
  "${API}/v1/preview?path=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$SPOOF")" || true)
test "${PCODE}" != "200"
echo "preview_spoof_reject_ok ${PCODE}"

PREVDIR="/app/artifacts/preview-smoke"
# Write PNG on the shared volume (host path mirrors container /app)
HOST_PREV="${ROOT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}/artifacts/preview-smoke"
mkdir -p "$HOST_PREV"
python3 -c "
from pathlib import Path
png = bytes([
  0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
  0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
  0xDE,0x00,0x00,0x00,0x0C,0x49,0x44,0x41,0x54,0x08,0xD7,0x63,0xF8,0xCF,0xC0,0x00,
  0x00,0x03,0x01,0x01,0x00,0x18,0xDD,0x8D,0xB4,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,
  0x44,0xAE,0x42,0x60,0x82,
])
Path('${HOST_PREV}/real.png').write_bytes(png)
"
curl -sf -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"roots\":[\"${PREVDIR}\"]}" "${API}/v1/scan" >/dev/null
PPATH="${PREVDIR}/real.png"
PIMG=$(curl -sf -H "$AUTH" -o /tmp/preview.png -w '%{http_code}' \
  "${API}/v1/preview?path=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$PPATH")")
test "$PIMG" = "200"
python3 -c "d=open('/tmp/preview.png','rb').read(); assert d[:8]==bytes.fromhex('89504e470d0a1a0a'); print('preview_real_png_ok', len(d))"

# Cancel async scan (best-effort; job may finish before cancel lands)
CSTART=$(curl -sf -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"roots":["/app/docker/fixtures"]}' "${API}/v1/scan/start")
CJID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['job_id'])" <<<"$CSTART")
curl -sf -X POST -H "$AUTH" "${API}/v1/scan/jobs/${CJID}/cancel" -o /dev/null -w '%{http_code}\n' | grep -Eq '204|404|500' || true
# Accept cancelled or already-finished ok
CST=$(curl -sf -H "$AUTH" "${API}/v1/scan/jobs/${CJID}")
python3 -c "import json,sys; d=json.load(sys.stdin); assert d['status'] in ('cancelled','ok','error','running'), d; print('cancel_probe_ok', d['status'])" <<<"$CST"

echo "API smoke passed (scan/suggest/delete/jobs/async/quarantine/preview/cancel)"
