# Quality bar

World-class for Dup Finder means **correctness over cleverness**, especially around deletes.

## Non-negotiables

1. **Delete fail-closed** — only confirmed paths; TOCTOU re-hash; never touch keep-candidates.
2. **Content identity** — extension is never trusted; BLAKE3 decides duplicates.
3. **Explainable suggestions** — keep reasons are explicit (`newest_mtime`, `shortest_path`, …); suggestions never auto-delete.
4. **Evidence** — every slice ships with automated UAT; Docker is the source of truth on this Mac.
5. **Honest scale claims** — prove A → B → C before marketing multi-TB readiness.

## Verification

```bash
docker compose run --rm fixtures
docker compose run --rm rust-test
# optional API + packaging:
# docker compose up -d api && bash docker/test/api_smoke.sh
# bash scripts/release/build-linux-docker.sh && bash scripts/release/sbom-syft.sh
```

Evidence index: `docs/evidence/README.md`.

## Slice gate

Do not start the next slice until the current UAT matrix rows are Pass.
