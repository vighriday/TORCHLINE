# 0019 — Fail-closed configuration and bounded live feeds

Accepted/implemented 2026-10-28. Preserve the game, Claude Design consumers and existing authority model.

Validate configuration before opening the database. Public/production origins require HTTPS; loopback HTTP remains available for local tunnel bootstrap. Production mode must be explicit, remote production PostgreSQL must use `sslmode=verify-full`, OAuth redirect must match the configured origin, secrets must be independent and numeric limits bounded. Startup errors omit dependency connection details. No default public bind or inferred production credentials.

Apply a same-origin CSP (no inline scripts, objects or framing), local assets/fonts/connects, restricted device permissions, no-referrer and HTTPS HSTS. Inline styles remain necessary for React's state-driven geometry/animation; removing them would break the approved design. OBS Browser Source is a top-level page; iframe embedding is intentionally unavailable. This does not add a Twitch Extension.

Bound authenticated SSE views per channel (8) and process (256), configurable operational safeguards rather than supported audience claims. Deny excess views with 429/Retry-After, release slots on disconnect, retain existing slow-client buffering guard and heartbeat. Unauthenticated callers get no slot. Feeds recheck authority on snapshots. Set bounded request/connection timeouts. On worker lease loss, close and exit unsuccessfully so a supervisor can restart; SIGTERM closes feeds/work/pool normally.

| Component | Review |
| --- | --- |
| C1 Identity | Fail closed on reused/missing secrets and mismatched redirects; session/capability authority unchanged |
| C2 Gateway | HTTPS exact callback retained; 64KiB body bound, signed verification and durable ack preserved |
| C3 Participation | No rule/input syntax changes; admission policy validated at bootstrap |
| C4 Engine | No runtime/env/network imports added to deterministic transitions |
| C5 Episodes | Actual process replacement pauses interrupted timed episodes; explicit captain resume |
| C6 Custody | Read-only feeds never grant custody; no native proof or consent synthesized |
| C7 Database/work | Trusted remote TLS, migration readiness, lease release and restart fencing |
| C8 Projection | Per-channel/global fan-out limits, slot cleanup, backpressure and close handling |
| C9 Dashboard | Same HTTPS origin/API/controller; CSP preserves React style-driven presentation |
| C10 OBS | No new overlay authority; top-level CEF expected; actual OBS remains unverified |
| C11 History | Persisted systems/resources/history survive real termination; immutable rules retained |
| C12 Validation | Invalid-config matrix, real HTTP feed flood/cleanup, subprocess kill/replacement and browser suite |
| C13 Operations | Explicit one-replica deployment, sanitized startup diagnostics, failed lease exit, graceful Linux shutdown |

Alternatives: accepting loose env defaults hides deployment mistakes; per-IP feed limits unfairly group viewers behind NAT and depend on proxy trust. Authenticated channel budgets fit the existing read model. Process-local feed counts are correct only for the current one-replica topology; scale-out still needs fan-out and shared admission design. CSP cannot replace output escaping, authorization or capability privacy.

Linux CI exposed a close-order deadlock: Fastify executes close hooks in reverse registration order, so the later pool-close hook waited forever on the earlier worker-lease hook. The bootstrap now explicitly awaits `app.close()` before `store.close()` on normal/fatal shutdown. The subprocess test bounds each stop separately. A Windows process kill could not establish this ordering; Linux CI is the acceptance evidence.

Executed checks and release limits are recorded in the release report. Windows process termination cannot deliver POSIX SIGTERM; local subprocess checks establish durable kill/restart recovery, while Linux CI additionally asserts exit 0 on SIGTERM. A passing Chromium journey is not a native OBS acceptance test. Revisit when adding embedding, external assets, replicas or a provider with different TLS/streaming requirements.
