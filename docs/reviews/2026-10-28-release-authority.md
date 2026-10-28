# Release authority review — 2026-10-28

Scope: current `feat/gameplay-foundation`, reliability/runtime/recovery/verification/packaging changes. This is a boundary review plus named automated evidence, not native Twitch/OBS acceptance. Previous [authority findings](2026-10-26-public-authority.md) remain fixed.

| Public surface | Intended authority and verification |
| --- | --- |
| Static browser, `/health/*`, anonymous `/api/state` | Assets/health/setup booleans only; no creator world, grants or diagnostics. CSP restricts scripts/assets/connects, device permissions and framing. Image excludes private inputs, local files and dev tooling. SPA fallback status200 alone is not secret-exposure proof. |
| `/auth/twitch`, callback/logout | One-use server state, provider identity/scopes, HttpOnly cookie, mode and origin boundaries retained. Generic sanitized dependency failures; config errors name fields only. Callback never accepts a browser-supplied role as authority. |
| `/api/operator/bot-*` | Operator key initiates separate bot OAuth; pending one-use browser capability/named confirmation/history protections retained. No operator world/custody bypass or public backup route. |
| `/api/worlds*` and simulator commands | Server creator session/current custody/mode/revision/command ID authorize mutations. Simulator endpoints denied in live. View/history scoped to current creator custody; no raw actor/ballot disclosure. |
| Timing, hosting, recovery, opt-in/reconcile/disconnect | Existing connected-creator/current-custody checks retained; unrelated creators/viewers/overlay cookies denied. Runtime limits are operator configuration, never browser-supplied authority. |
| `/api/handoffs*` | Source preparation, exact native proof, receiver consent/current grants/stream readiness and atomic slot change remain required. Both-party frozen previews only. No CLI verifier fabricates proof or accepts an offer. |
| `/integrations/twitch/eventsub` | Dedicated raw-body HMAC path, timestamp/type/version/exact subscription identity; 64KiB bound and durable idempotency. Viewer IDs become world-specific pseudonyms; eligibility/admission precede queued execution. Native raids alone can authorize live custody. |
| `/api/overlay-grant`, `/overlay/:channel/session/events` | Only creator rotates ordinary grants. Capability is read-only/path/channel scoped; nullable expiry checked at exchange/feed. Real public Chromium probe now passes cookie exchange/SSE, private-field omission and mutation denial; it adds/removes only its five-minute grant. No URL/trace output or ordinary grant rotation. No live world exists yet. |
| `/api/live/events` and overlay SSE | Authenticated per-channel/process feed bounds, slot release, bounded slow output and periodic authority checks. No anonymous feed slot; no feed mutation. Native OBS remains unverified. |

## Every component checked

| Component | Release interaction and evidence |
| --- | --- |
| C1 Identity | Independent keys/HTTPS/redirect validation; existing OAuth/session/bot conversion tests retained; real grants validate |
| C2 Twitch | All-page exact subscription diagnostic shares production pagination; loop guard regression passes; historical delivery labeled separately |
| C3 Participation | Concurrent DB admission/refill/dedup/backlog and multi-channel fairness tests; no supported-audience claim |
| C4 Engine | No rules/content changes; existing immutable replay/balance/solo season tests retained |
| C5 Episodes | Receipt ordering preserved for offline pause; process kill/replacement pauses once without resource/scar loss |
| C6 Custody | No new proof/consent path; acceptance counters require joined signed delivery/proof/committed handoff lineage; actual raid pending |
| C7 Database/work | Migration008, exact readiness, lease/pool shutdown correction, encrypted consistent backup/fingerprints/restore |
| C8 Projection | Indexed bounded public tails; real HTTP feed ceiling/reuse/denial; source-only read model retained |
| C9 Dashboard | Seven browser journeys preserve gameplay, cooperation, mobile/workspaces/cinematic design and account setup |
| C10 OBS | Read-only tests and actual-public Chromium helper; CEF render/reconnect remains owner acceptance |
| C11 History | 50,000 synthetic ballot query fixture uses public partial index; real gameplay backup replay separate from synthetic data |
| C12 Validation | Real PostgreSQL/HTTP/subprocess, isolated provider fixtures, browser and Linux restricted-container checks; no fixtures in live DB |
| C13 Operations | Context allowlist, restricted image, graceful SIGTERM, no known audit advisories; real SSH/HTTPS restored after owner key registration. Console callback/hosting/remote backups remain gates |

Executed evidence: [Linux CI 40677463127](https://github.com/vighriday/TORCHLINE/actions/runs/40677463127) passes 89 automated tests, seven browser journeys, unchanged balance/design fixtures, image build and restricted-container smoke. One additional pagination regression and its affected provider-contract suite pass locally; the current release report records the final head's result.

Final implementation `9750048` passes [CI 40678887999](https://github.com/vighriday/TORCHLINE/actions/runs/40678887999): all 90 tests, seven browser journeys, fixture consistency and restricted release-image smoke. No genuine live chat/reply/OBS/raid claim is derived from that workflow.

Configured-secret scans cover Git/index/working files, built assets and selected local logs with 15 private fingerprints, including the independent backup key. After owner key registration, the actual public scan also passes ten selected live responses; this remains sampled exposure evidence. No credentials/raw private concept/capability URLs were staged. No global Git/SSH config, provider visibility, branch history or security exclusion changed. Owner-reported `redirect_mismatch` was diagnosed without persisting the callback query/state; live server's outbound redirect uses the correct new callback, pending console update.

Remaining risk: sustained valid Twitch floods still cost signature checks, transactions and durable dedup/rejection rows; no unsafe retention pruning was introduced. Production edge limits, measured soak/queue alerts, remote backup retention/restore, persistent hosting and genuine chat/OBS/native raid acceptance are explicit release gates. A dependency audit is not proof of absence of vulnerabilities.
