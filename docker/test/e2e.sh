#!/usr/bin/env bash
# Playwright E2E against local API + UI preview (Docker Playwright image).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

docker compose up -d api
for i in $(seq 1 90); do
  curl -sf http://127.0.0.1:7420/health >/dev/null && break
  sleep 2
done

docker compose run --rm ui bash -lc "npm install && npm run build"

# Serve built UI + run Playwright in official browser image
docker run --rm --network host \
  -e E2E_API=http://127.0.0.1:7420 \
  -e E2E_TOKEN=dev-token-change-me \
  -e E2E_BASE_URL=http://127.0.0.1:5173 \
  -e E2E_NO_WEBSERVER=1 \
  -v "$ROOT/ui:/work" -w /work \
  mcr.microsoft.com/playwright:v1.49.1-jammy \
  bash -lc '
    npm install
    npm run build
    npx vite preview --host 127.0.0.1 --port 5173 &
    for i in $(seq 1 60); do curl -sf http://127.0.0.1:5173 >/dev/null && break; sleep 1; done
    ./node_modules/.bin/playwright test
  '

echo "e2e_ok"
