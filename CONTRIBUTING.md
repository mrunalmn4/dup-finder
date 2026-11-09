# Contributing

Thanks for helping improve Dup Finder.

## Development (Docker-first)

This project is designed so a Mac (or any host) can develop without installing a host Rust toolchain:

```bash
docker compose run --rm fixtures
docker compose run --rm rust-test
docker compose run --rm ui bash -lc "npm install && npm run build"
```

Desktop (Tauri) needs host Rust + platform WebView deps — see [docs/DESKTOP.md](docs/DESKTOP.md).

## Pull requests

1. Keep diffs focused (one concern per PR when practical).
2. Run the Docker test commands above before requesting review.
3. If you touch delete paths, call out delete-safety implications and add/adjust tests.
4. Update [CHANGELOG.md](CHANGELOG.md) for user-visible changes.
5. Do **not** add AI/Cursor attribution in commits, PRs, or docs (`Co-authored-by: Cursor`, “AI-generated”, etc.). Author as yourself.

## Releases

Maintainers: run `bash scripts/release/checklist.sh vX.Y.Z`, then tag. CI publishes via `.github/workflows/release.yml` (build once → smoke → GitHub Release + GHCR).

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
