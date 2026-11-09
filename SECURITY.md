# Security Policy

## Supported versions

Security fixes are applied on the latest release tag on `main` (currently the `v0.1.x` line).

## Reporting a vulnerability

Please **do not** open a public issue for security-sensitive reports.

Email or use GitHub **Private vulnerability reporting** on this repository (Security → Advisories → Report a vulnerability) when available. Include:

- Affected version / commit
- Reproduction steps
- Impact (e.g. unintended delete, path escape, local API exposure)

We aim to acknowledge within 7 days and ship a fix or mitigation as soon as practical.

## Product security stance

- **Local-only by default** — file contents and hashes are not sent to remote services.
- **Explicit scan roots** — the tool does not walk the whole disk unless the user selected those roots.
- **Delete is fail-closed** — only user-selected paths; TOCTOU re-verify before remove; trash by default; permanent delete requires extra confirmation. See `.cursor/rules/delete-safety.mdc` and the delete-safety spec under `docs/superpowers/specs/`.
- **No silent telemetry.**

## Local API

`dup-finder serve` binds loopback by default. Non-loopback binds require an explicit environment flag. Treat the API token like a password on a shared machine.
