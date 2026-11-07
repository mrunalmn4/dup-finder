# Security & Compliance Spec

**Date:** 2026-11-07  
**Bar:** B + C — enterprise-ready product controls + path to SOC 2 / ISO 27001 claims

## Data map

| Data | Stored where | Leaves device? | Notes |
|------|--------------|----------------|-------|
| File bytes | User disk only | No | Read for hashing only |
| Content hashes | Local scan index / results | No (default) | Not reversible to content |
| Paths, size, mtime, MIME | Local results | No (default) | May be sensitive |
| Audit events | Local audit log | No (default) | No file bytes |
| Telemetry | Off by default | N/A until opt-in | Must redact paths |

## Threat model (STRIDE-lite)

| Area | Risk | Mitigation |
|------|------|------------|
| Scan | Path escape via symlink | realpath + root allowlist |
| Scan | Zip bomb / huge file | Size/time caps; archive opaque in v1 |
| Delete | Wrong file deleted | Delete-safety spec D1–D8 |
| Delete | TOCTOU race | Re-hash immediately before remove |
| GUI/IPC | Webview FS abuse | Tauri command allowlist only |
| Daemon | Local API abuse | Localhost + auth token/socket perms |
| Supply chain | Tampered binary | Signatures, SBOM, CI audits |
| Privacy | Silent exfil | No network required; deny by default |

## Release gates

- [ ] `cargo audit` / JS audit clean or waived with ticket
- [ ] Container scan clean or waived
- [ ] SBOM attached to release
- [ ] Checksums (+ cosign/sigstore where applicable)
- [ ] Delete-safety UAT 100% green
- [ ] Privacy policy + data map published
- [ ] Control matrix evidence paths updated

## SOC 2 / ISO path

**In-repo:** control matrix, SDLC/vuln/IR/release policies, evidence automation, product controls (offline, audit log, least privilege).

**Outside repo:** legal entity, operated org policies, external auditor. Marketing uses “aligned / evidence pack” until the report exists.

## Policy stubs (owners TBD)

- Secure SDLC
- Vulnerability management
- Incident response
- Release signing & provenance
- Access control (repos/CI)
