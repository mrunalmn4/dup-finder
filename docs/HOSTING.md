# Git host recommendation

**Use GitHub** for this repo.

Reasons:
- `.github/workflows/ci.yml` already runs fixtures, Rust tests, UI build, and Linux release packaging
- Matches existing docs and artifact upload actions
- macOS/Windows Tauri runners are first-class on GitHub Actions

GitLab is fine organizationally, but would mean rewriting CI to `.gitlab-ci.yml` and re-mapping runners — only worth it if your company standard is GitLab.

Next step when ready: create a GitHub repo, `git remote add origin …`, push `main`, enable Actions.
