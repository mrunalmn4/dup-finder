# Access control — repos & CI (stub)

**Owner:** TBD  

1. `main` protected: required checks, no force-push.
2. Secrets only in CI secret store / local env — never committed.
3. Least privilege for deploy tokens; rotate on staff change.
4. Docker release builds run as non-root in final image.
