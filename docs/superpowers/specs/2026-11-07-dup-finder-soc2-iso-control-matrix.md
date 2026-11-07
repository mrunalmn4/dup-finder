# SOC 2 / ISO 27001 Control Matrix (draft)

**Date:** 2026-11-07  
**Status:** Living document — fill Evidence as CI/product land  
**Claim rule:** Do not market “certified” until external report/certificate exists.

| Framework ref | Control intent | Product / eng control | Evidence location |
|---------------|----------------|----------------------|-------------------|
| SOC2 CC6 / ISO A.8 | Access to data | Local-only; explicit roots; least privilege | design + delete-safety specs; code |
| SOC2 CC6 / ISO A.8 | Prevent unauthorized change/delete | Select-only delete + TOCTOU | delete-safety UAT artifacts |
| SOC2 CC7 / ISO A.8.15 | Logging | Audit log of scan/delete (no file bytes) | audit module + sample logs |
| SOC2 CC8 / ISO A.8.32 | Change management | PR + CI required for release | GitHub/Origin branch protection (TBD) |
| SOC2 CC7 / ISO A.8.8 | Vulnerabilities | cargo/npm audit + container scan in CI | CI reports per release |
| SOC2 CC6 / ISO A.5/A.8 | Supply chain | SBOM + signed artifacts | `scripts/release/sbom-syft.sh`; cosign TBD |
| SOC2 CC2 / ISO A.5.1 | Policies | SDLC, vuln, IR, signing stubs | `docs/policies/` |
| SOC2 CC9 / ISO A.5.19 | Vendors | Dependency pin + license NOTICE | SBOM + NOTICE |
| Index | Evidence pack map | Where to find each control’s proof | `docs/evidence/README.md` |
| Privacy GDPR/CCPA | Lawful local processing | Data map; no account required | security-compliance spec |

## Next org actions (outside pure code)

1. Name legal entity under audit.
2. Assign policy owners and review cadence.
3. Engage auditor; target Type I then Type II window.
4. Retain CI/release evidence for the observation period.
