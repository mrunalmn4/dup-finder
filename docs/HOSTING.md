# Git host recommendation

**Prefer GitHub** for this repo — especially on the **free** tier if you need Windows/macOS CI.

## Free hosted runners (practical)

| Need | GitHub Free (private) | GitLab.com Free |
|------|------------------------|-----------------|
| Linux CI | Strong (included Actions minutes; public repos free on standard runners) | 400 compute minutes/mo (Linux factor 1) |
| **Windows** hosted | Yes (`windows-latest`) from included budget | Windows hosted is **beta**; limited |
| **macOS** hosted | Yes (`macos-latest`) from included budget (expensive per minute) | Hosted macOS is **Premium/Ultimate** (not Free) |
| Our repo today | `.github/workflows/ci.yml` already written | Would need a full `.gitlab-ci.yml` rewrite |

Rough GitHub Free private-repo budget is billed as included **$** of compute (then Linux/Windows/macOS burn that pot at different per-minute rates). GitLab Free is a flat **400 compute minutes**, and macOS costs ~6× Linux minutes — and Free often **cannot** use GitLab’s hosted macOS runners at all.

**Verdict for Dup Finder (Linux packages now + Tauri macOS/Windows next):**  
→ **GitHub** gives usable free/cheap **Windows + macOS** hosted runners and matches our existing workflow.  
→ Pick **GitLab** only if your org mandates it (then use **self-hosted** runners for macOS/Windows, or pay Premium).

## Free-only Actions policy (this repo)

| Workflow | Runner | When |
|----------|--------|------|
| `ci.yml` | `ubuntu-latest` | Every push/PR (tests); release-smoke on `main` push |
| `desktop-host.yml` | `macos-latest` / `windows-latest` | Manual only; **blocked on private** unless `force_private` |

No larger runners, no GPU, no self-hosted. Prefer a **public** repo so standard hosted minutes stay free.

## Next step

`git remote add origin git@github.com:mrunalmn4/dup-finder.git` → push `main` → enable Actions.
