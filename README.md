# Dup Finder

Cross-platform duplicate file finder: scan chosen locations, detect content duplicates (even when extensions are renamed), show metadata, suggest safe deletes.

## Status

**Product stack complete (v0.1):** engine + CLI + resumable index + fail-closed delete + suggest + localhost/`serve` daemon with scheduled jobs + React UI + Tauri shell + Docker release image/packaging scripts. See [docs/QUALITY.md](docs/QUALITY.md), [docs/DESKTOP.md](docs/DESKTOP.md), [docs/PACKAGING.md](docs/PACKAGING.md). **What's left:** [docs/PENDING.md](docs/PENDING.md).

## Locked direction

- **Engine:** Rust (CLI → Tauri GUI → daemon), content hash BLAKE3
- **Delivery:** portable binary + OS packages + Docker
- **Safety:** delete only user-selected, re-verified paths (trash default); see [delete safety rule](.cursor/rules/delete-safety.mdc)
- **Compliance:** enterprise-ready controls + SOC 2 / ISO alignment path

## Docs

- [AGENTS.md](AGENTS.md) — agent operating guide
- [docs/DECISIONS.md](docs/DECISIONS.md) — durable decisions
- Specs under `docs/superpowers/specs/`

## Dev / test (Docker on Mac — no host Rust required)

```bash
docker compose run --rm fixtures          # golden fixture check
docker compose run --rm rust-test         # cargo test --workspace
```

```bash
# Scan fixtures → JSON
docker compose run --rm rust-test \
  cargo run -p dup-finder-cli -- scan /app/docker/fixtures \
  -o /app/artifacts/scan.json --index /app/artifacts/index.sqlite

# Explainable keep/delete suggestions (never deletes)
docker compose run --rm rust-test \
  cargo run -p dup-finder-cli -- suggest --from-scan /app/artifacts/scan.json \
  -o /app/artifacts/suggest.json

# Dry-run delete (never mutates); permanent requires --mode permanent --confirm
docker compose run --rm rust-test \
  cargo run -p dup-finder-cli -- delete --from-scan /app/artifacts/scan.json \
  --path /app/docker/fixtures/delete_safety/drop_me.txt \
  --keep /app/docker/fixtures/delete_safety/keep_me.txt \
  --mode dry-run
```

### UI + API (Slice 1)

```bash
docker compose up api          # http://127.0.0.1:7420  token: dev-token-change-me
docker compose up ui           # http://127.0.0.1:5173
# In UI: connect with that token, add root /app/docker/fixtures (API container path)
bash docker/test/api_smoke.sh  # or via compose network against http://api:7420
```

Golden corpora: `docker/fixtures/`. Delete safety: `docs/superpowers/specs/2026-11-07-dup-finder-delete-safety.md`.
