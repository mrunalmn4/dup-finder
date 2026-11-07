# Incident response (stub)

**Owner:** TBD  
**Review:** annually

1. Severity: data loss / wrong-file delete = Sev-1; auth bypass = Sev-1; DoS local = Sev-3.
2. Sev-1: stop distribution, notify stakeholders within 24h, preserve logs/audit trails.
3. Wrong-delete reports: collect scan JSON + delete report; never request file contents.
4. Post-incident: root cause, patch, UAT regression added before reopen.
