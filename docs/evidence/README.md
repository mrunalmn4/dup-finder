# Compliance evidence pack (B+C track)

Index of where auditors look. Do **not** claim “SOC 2 / ISO certified” until an external report exists.

| Control area | Evidence | Status |
|--------------|----------|--------|
| Delete safety | `docs/superpowers/specs/2026-11-07-dup-finder-delete-safety.md` + engine UAT (T1–T10) | Automated |
| Local-only / auth | Bearer on `/v1/*`; loopback bind default; `DUP_FINDER_ALLOW_NON_LOOPBACK` escape hatch | Unit + api_smoke |
| Change management | `.github/workflows/ci.yml`; policies in `docs/policies/secure-sdlc.md` | CI ready; branch protection = org |
| Supply chain | `artifacts/release/SHA256SUMS`, `NOTICE.txt`, `sbom-cargo-lock.txt`, `sbom.*.json` | Checksums + lock inventory + syft; cosign = org |
| Vulnerabilities | `docs/policies/vulnerability-management.md`; cargo/npm audit in org CI | Policy stub |
| Incident response | `docs/policies/incident-response.md` | Stub — assign owner |
| Access control | `docs/policies/access-control-repos-ci.md` | Stub — assign owner |
| Control matrix | `docs/superpowers/specs/2026-11-07-dup-finder-soc2-iso-control-matrix.md` | Living |
| UAT gate | `docs/superpowers/specs/2026-11-07-dup-finder-uat-matrix.md` | Living |

## Reproduce locally (no remote)

```bash
docker compose run --rm fixtures
docker compose run --rm rust-test
docker compose up -d api && bash docker/test/api_smoke.sh
bash scripts/release/build-linux-docker.sh
bash scripts/release/sbom-syft.sh
bash scripts/release/package-deb.sh
bash scripts/release/package-rpm.sh
```

Retain `artifacts/release/` plus CI logs for the observation window once audit starts.
