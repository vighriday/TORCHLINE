# Reproduce the October 29 audit probes

These are **diagnostic programs, not passing release tests**. They print observed failures or measurements; exit 0 means the diagnostic finished, not that the application meets acceptance. Use the [audit](../../docs/reviews/2026-10-29-comprehensive-audit.md) and [dated evidence](../../docs/reviews/2026-10-29-audit-evidence.json) to interpret output. Timing and admission counts vary by machine and load. Original measurements refer to application source `7700316`.

Use Node 24 and the existing development **simulation** `.env` with PostgreSQL 17. The programs refuse a non-simulation `WORLD_MODE`; `tests/helpers.ts` creates and drops a random schema. Provider identities, OAuth, signatures and messages use the explicit local fixture. No real Twitch request, grant refresh, live-world action or native raid is sent. Do not pass `.env.live` or run against a production database. Use a development DB account allowed to create disposable schemas.

After the normal local install/database setup:

```powershell
pnpm build
$env:PLAYWRIGHT_BROWSERS_PATH = '.local/browsers'
pnpm exec playwright install chromium --only-shell
node --env-file=.env scripts/audit/probes.ts
node --env-file=.env scripts/audit/scale.ts
node --env-file=.env scripts/audit/ingress.ts
```

Run sequentially. On macOS/Linux, replace the PowerShell environment assignment with `export PLAYWRIGHT_BROWSERS_PATH=.local/browsers`. Ports 3192 and 3193 must be free. Browser diagnostics use `.local/browsers`; generated results are ignored under `.local/audit-reproduction-2026-10-29/`, separate from original evidence.

| Program      | Boundary exercised                                                                                                                                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `probes.ts`  | Signed subscription revocation and due-clock advancement; stale validation versus local disconnect; a single transient Store read failure on an actual Chromium overlay followed by restored service. Canonical worlds are isolated.                                               |
| `scale.ts`   | Current-rule pure-engine 10k unique ballots in 1k blocks; state size and elapsed cost; pool-query counts for eight manually paced ticks with four idle creator SSE feeds. No deployed throughput or native OBS claim.                                                              |
| `ingress.ts` | One simultaneous 500-message signed provider-fixture burst through Fastify injection and real SQL; acknowledgement distribution, admission rejections, pending bound and deterministic worker drain. It bypasses network/proxy/Twitch scheduling and is not a sustained load test. |

The temporary read override and query counter affect only each program's isolated Store, never application source. Resources, browser, HTTP app and schemas are closed on normal completion/failure. Results contain synthetic identifiers and sanitized status only. Do not use these diagnostics to generate fake live acceptance. Turn confirmed fixes into appropriate deterministic regressions rather than preserving an assertion that a bug must remain present.
