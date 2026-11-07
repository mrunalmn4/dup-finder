# Folders setup modes (layperson UX)

## Gate

- Show mode chooser only when idle on Folders with **nothing to resume**: not mid-scan, not on Review/Confirm with an active result.
- Resume always wins over the chooser.
- Persist choice in `dup.setupMode.v1`. **Change mode** (header, Folders idle) clears and shows the chooser again.

## Modes

| Mode | Folders UI |
|------|------------|
| Simple | Places + Browse + Scan; defaults summary; More options collapsed |
| Smart | Same as Simple, plus auto-select common folders on enter |
| Guided | Substeps: Places → What (categories) → Scan |
| Advanced | Full current Folders controls |

## Non-goals

- Do not interrupt Review/Confirm.
- Do not change delete-safety behavior.
