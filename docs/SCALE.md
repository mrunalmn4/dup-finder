# Scale & storage scope (honest)

## What works today

| Scenario | Support |
|----------|---------|
| Single file / many files under roots | Yes — content BLAKE3 groups |
| One folder / many folders | Yes — pass multiple roots |
| Multiple partitions / volumes / drives | Yes — **if you add each as an explicit root** (e.g. `/Volumes/Backup`, `D:\Photos`) |
| HDD / SSD / NVMe / SD / USB | Yes — same code path; media speed affects wall time only |
| Multi-TB trees | Designed for: streaming walk, size→partial→full hash, SQLite resume index |
| Proven in CI | Scale A 1k, B 10k (dup pairs hashed), C 100k same-size resume smoke |

## What we do **not** do (v1)

- Scan the whole disk unless you select those roots
- Cross-device “smart” discovery of unlisted mounts
- Parallel multi-disk schedulers beyond one scan job’s workers
- Claim multi-million full-hash CI runs (C is cardinality + resume, not every-byte of multi-TB)

## Pipeline (performance)

1. Walk selected roots (skip trash/index sidecars)
2. **Unique sizes** → cannot be duplicates → **skip hashing**
3. Same size → **partial** fingerprint (first/last chunks)
4. Only partial collisions → **full BLAKE3**
5. Index reuse when size/mtime/inode unchanged

## Delete caution

Suggestions flag **critical/elevated** paths (system dirs, app bundles, `.ssh`, Program Files, etc.). UI warns before preview; engine still requires select-only + confirm + TOCTOU. Caution is advisory — it does not replace human judgment.
