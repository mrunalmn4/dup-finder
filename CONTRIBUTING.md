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
2. Use a [Conventional Commit](https://www.conventionalcommits.org/) **PR title** when squashing (`feat:`, `fix:`, `docs:`, …) so [release-please](docs/RELEASING.md) can version correctly.
3. Run the Docker test commands above before requesting review.
4. If you touch delete paths, call out delete-safety implications and add/adjust tests.
5. User-visible notes land in CHANGELOG via release-please (or edit Unreleased if needed).
6. Do **not** add AI/Cursor attribution in commits, PRs, or docs (`Co-authored-by: Cursor`, “AI-generated”, etc.). Author as yourself.

## Releases

Maintainers: follow [docs/RELEASING.md](docs/RELEASING.md).  
Short path: `bash scripts/release/checklist.sh vX.Y.Z`, then annotated tag + push. Never move a public tag; cut a new version instead.

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
