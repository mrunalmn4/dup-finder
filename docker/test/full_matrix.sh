#!/usr/bin/env bash
# Thorough local verification matrix (Docker-friendly).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== 1) Fixtures ==="
docker compose run --rm fixtures

echo "=== 2) Session logic + keep rules (node) ==="
node docker/test/session_logic_test.mjs
node docker/test/keep_rules_test.mjs

echo "=== 3) Rust unit + scale (engine + app + cli lib if any) ==="
docker compose run --rm --no-deps rust-test cargo test --workspace --lib -- --test-threads=4

echo "=== 4) UI production build ==="
docker compose run --rm ui bash -lc "npm install && npm run build"

echo "=== 5) API smoke + async/quarantine reject ==="
docker compose up -d --force-recreate api
for i in $(seq 1 90); do
  if curl -sf http://127.0.0.1:7420/health >/dev/null; then break; fi
  sleep 2
done
bash docker/test/api_smoke.sh

echo "=== 6) Quarantine trash→restore roundtrip ==="
# Run inside API container so WORKDIR paths match the server FS
docker compose exec -T api bash -lc 'bash /app/docker/test/quarantine_roundtrip_smoke.sh'

echo "=== 7) CLI --progress smoke (fixtures) ==="
docker compose run --rm --no-deps rust-test \
  cargo build -p dup-finder-cli -q
docker compose run --rm --no-deps rust-test \
  ./target/debug/dup-finder scan /app/docker/fixtures --progress >/tmp/dup-scan-out.json 2>/tmp/dup-scan-prog.txt
grep -Eiq 'walk|hash|done|progress' /tmp/dup-scan-prog.txt
test -s /tmp/dup-scan-out.json
echo cli_progress_ok

echo "=== full_matrix PASSED ==="
