## Summary

<!-- What and why (not a file dump). -->

## Test plan

- [ ] `docker compose run --rm fixtures`
- [ ] `docker compose run --rm rust-test`
- [ ] UI build (Docker or `npm --prefix ui run build`) if UI touched
- [ ] Delete-safety impact considered (or N/A)

## Delete safety (if applicable)

- [ ] Only user-selected paths; keep/delete sets disjoint
- [ ] TOCTOU / path allowlist / fail-closed behavior preserved
- [ ] Tests updated for the change

## Notes

<!-- Screenshots, follow-ups, BREAKING changes. -->
