# Slice 2–3 — Daemon + Packaging

**Goal:** Scheduled jobs + release artifacts.

- [x] JobStore SQLite + run_now / due_jobs
- [x] HTTP `/v1/jobs` CRUD + run + 5s scheduler tick
- [x] API smoke includes jobs
- [x] Dockerfile.release (non-root)
- [x] build-linux-docker.sh + package-deb.sh + SHA256SUMS/NOTICE
- [x] GitHub Actions CI
