# Secure SDLC (stub)

**Owner:** TBD  
**Review:** quarterly

1. All product code reviewed via PR before merge to `main`.
2. CI must pass (fixtures, `cargo test`, UI build) before merge.
3. Delete-path and auth changes require explicit review against `delete-safety` spec.
4. No secrets in git; tokens only via env / local config.
5. Dependencies pinned via `Cargo.lock` / `package-lock.json`; audits on release.
