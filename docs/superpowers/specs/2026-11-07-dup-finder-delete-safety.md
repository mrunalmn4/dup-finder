# Delete Safety Spec (hard gate)

**Date:** 2026-11-07  
**Priority:** P0 — product must not ship delete until this is verified end-to-end  
**Audience:** engine, CLI, GUI, daemon, UAT

## Principle

We delete **user data**. The only acceptable outcome is: **exactly the confirmed selection is removed (or skipped with reason); nothing else.**

Fail **closed**. Prefer false “skip” over false delete.

## Invariants

| ID | Invariant |
|----|-----------|
| D1 | Delete set ⊆ user-confirmed paths from the active session/job |
| D2 | Delete set ∩ keep set = ∅ |
| D3 | Every path’s realpath is under an approved scan root |
| D4 | Immediately before remove: realpath + size + full content hash (+ device/inode if recorded) match the scan record |
| D5 | Trash is default; permanent delete requires a separate explicit flag/confirm |
| D6 | Dry-run never mutates the filesystem |
| D7 | Partial failure does not retry blindly on a different path |
| D8 | Every attempt is audit-logged (path, action, result, reason code) without file bytes |

## Algorithm

```text
input: confirmed_delete_paths[], keep_paths[], scan_records, roots[], mode=trash|permanent

assert disjoint(confirmed_delete_paths, keep_paths)
for path in confirmed_delete_paths:
  record = scan_records.get(path) or FAIL_SKIP(NOT_IN_SCAN)
  real = realpath(path) or FAIL_SKIP(RESOLVE)
  if not under_any_root(real, roots): FAIL_SKIP(OUTSIDE_ROOT)
  if real in keep_realpaths: FAIL_SKIP(IS_KEEP)
  meta = stat(real) or FAIL_SKIP(MISSING)
  if meta.size != record.size: FAIL_SKIP(SIZE_MISMATCH)
  if device/inode recorded and mismatch: FAIL_SKIP(INODE_MISMATCH)
  hash = blake3_file(real)
  if hash != record.hash: FAIL_SKIP(HASH_MISMATCH)
  if mode == dry_run: OK_WOULD_DELETE; continue
  if mode == trash: trash(real) else unlink(real)
  recheck gone or in trash; else FAIL_SKIP(VERIFY_GONE)
  OK_DELETED
```

## UX requirements

1. Show full list of paths to delete + reclaimable bytes + keep paths side-by-side.
2. Require explicit confirm (GUI: confirm control; CLI: `--confirm` after `--dry-run` or interactive prompt).
3. Return machine-readable per-path results.
4. Never auto-select “all duplicates except one” without displaying and confirming the concrete path list.

## Test cases (must all pass)

| Case | Setup | Expect |
|------|-------|--------|
| T1 | Select `drop_me.txt` only | Only that path trashed |
| T2 | Attempt keep path | Reject / skip |
| T3 | Change file bytes after scan | Skip HASH_MISMATCH |
| T4 | Replace file with symlink to other content | Skip HASH or OUTSIDE/IS_KEEP as applicable |
| T5 | Path with `..` escaping root | Reject |
| T6 | Dry-run | Zero filesystem mutations |
| T7 | Mix of good + mismatched | Good deleted; mismatched skipped; report both |
| T8 | Empty selection | No-op success |
| T9 | File already deleted | Skip MISSING |
| T10 | Permanent mode without confirm flag | Refuse |

## Exit criteria for Slice 0

All T1–T10 automated in Docker; manual checklist signed off in UAT matrix; no known fail-open paths in code review.
