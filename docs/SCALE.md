# Scale & storage scope (honest)

## What works today

| Scenario | Support |
|----------|---------|
| Single file / many files under roots | Yes — content BLAKE3 groups |
| One folder / many folders | Yes — pass multiple roots |
| Multiple partitions / volumes / drives | Yes — **add each as an explicit root** |
| HDD / SSD / NVMe / SD / USB | Yes — same code path; media speed affects wall time only |
| Multi-TB trees | Designed for: streaming walk, size→partial→full hash, SQLite resume index |
| Proven in CI | Scale A 1k, B 10k (dup pairs hashed), C 100k same-size resume smoke |

## How roots work on each OS (not “auto mounts”)

Dup Finder **never invents disks**. You pass roots; the walk stays under those paths.

| OS | How you select storage | Examples |
|----|------------------------|----------|
| **macOS / Linux** | Folder paths / mount points | `/Users/me/Pictures`, `/Volumes/Backup`, `/mnt/usb` |
| **Windows** | **Drive letters** or folder paths (not Unix-style mounts) | `C:\Users\me\Documents`, `D:\Photos`, `E:\`, `\\NAS\Share\Media` |

- On Windows, `D:\` is a **drive root**, not a mount like `/Volumes/…`.
- Extra HDDs, SSDs, SD cards, and USB sticks appear as another letter or UNC share — **add that path as a root**.
- Scanning `C:\` whole-disk is possible only if the user explicitly selects it (strongly discouraged; system caution will fire under `\Windows`, `\Program Files`, etc.).

## What we do **not** do (v1)

- Scan the whole machine unless those roots were selected
- Auto-discover unlisted drives/mounts
- Parallel multi-disk schedulers beyond one scan job
- Claim multi-million full-hash CI runs (C is cardinality + resume)

## Pipeline (performance)

1. Walk selected roots (skip trash/index sidecars)
2. **Unique sizes** → cannot be duplicates → **skip hashing**
3. Same size → **partial** fingerprint (first/last chunks)
4. Only partial collisions → **full BLAKE3**
5. Index reuse when size/mtime/inode unchanged

## Delete caution

Suggestions flag **critical/elevated** paths (Unix system dirs, macOS `.app` bundles, Windows `\Windows` / Program Files / AppData, `.ssh`, etc.). UI warns before preview; engine still requires select-only + confirm + TOCTOU. Caution is advisory — it does not replace human judgment.
