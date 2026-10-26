# Public capability and authority review

Current follow-up: the owner resumed reviewed incremental pushes on 2026-10-26. The baseline findings below are historical; R1–R4 have regression-tested fixes. Real app/broadcaster/bot OAuth, explicit named conversion, HTTPS, three signed challenges and enabled current subscriptions are verified. Genuine chat effects, visible bot output, actual OBS and native raid acceptance remain pending. See [current status](../planning/implementation-status.md).

Date: 2026-10-26, Asia/Calcutta. Reviewed implementation: `00250ce`. Review only: no application fixes, release tag, deployment, merge or further push is included. The owner requested local review before publishing further changes.

Follow-up implementation on the same date: R1–R4 now have fixes and passing regression coverage in the local integration work. Subscription identity and provider confirmation are persisted, terminal IDs remain terminal, participant identity is shared across ingress paths, and safe client errors retain their HTTP status. The new 30-test suite includes a complete provider-contract chat/raid journey. The original findings and evidence below are retained as the review of `00250ce`; genuine Twitch acceptance remains pending and no further push has occurred.

## Disposition

Retain the approved architecture. The existing session, engine, SQL and overlay boundaries support the intended product; this review does not justify a new authorization framework, service split, queue or transport. Fix the four reproduced defects below in small changes before treating the slice as ready for live integration acceptance. Keep the wider product roadmap, but defer adding gameplay systems during these fixes.

There is no demonstrated arbitrary unauthenticated custody takeover in the reviewed cases. That limited result is not a penetration-test certification or proof that every attack is excluded. In particular, signature authenticity alone does not make a subscription lifecycle transition current or safe to replay.

## Findings requiring changes

### R1 — P1: a replayed challenge can reverse subscription revocation

Location: `apps/server/src/app.ts`, EventSub callback-verification branch, around line 565.

The callback handler unconditionally upserts the subscription status to `enabled`. Reproduction with an isolated database and authentic fixture signatures: deliver a verification challenge, deliver an authorization revocation, then replay the original signed challenge within its accepted timestamp window. The row changes from `authorization_revoked` back to `enabled`. The normal notification path subsequently trusts that status.

This requires a previously valid signed message; the probe does not forge a Twitch signature. Delayed or replayed valid messages must still preserve revocation. Return the required challenge response idempotently while preventing an older lifecycle message from reviving a revoked subscription. Bind subscription identity/conditions to the expected configuration and add challenge-after-revocation regression coverage. Review the reconciler's status upsert under the same ordering rule.

### R2 — P2: replacing the bot leaves stale subscriptions counted as ready

Locations: `apps/server/src/app.ts` around line 427; `apps/server/src/twitch-lifecycle.ts` around line 125; `packages/storage/migrations/001_foundation.sql`, `subscriptions`.

Successful bot authorization deletes the previous bot grant without invalidating its chat subscriptions. Stored subscription rows retain only ID/type/channel/status, so transfer readiness cannot check which bot or callback they belong to. Reproduction: seed enabled subscriptions for bot A, authorize bot B through the operator/OAuth flow, then check transfer readiness. Readiness succeeds, while chat from A's existing subscription is rejected with HTTP 403 because its bot identity no longer matches.

Mark affected subscriptions unready when the bot changes, persist enough subscription identity to compare the desired bot/callback/version, and require a matching enabled subscription before readiness succeeds. Apply the same check when a public callback origin changes. This is a configuration/lifecycle correction within the current adapter and schema, not a new service.

### R3 — P2: one broadcaster can have two ballot identities

Locations: `apps/server/src/app.ts` around line 246; `packages/storage/src/index.ts`, chat participant pseudonymization; `packages/engine/src/index.ts`, vote storage.

The host-command route uses the raw creator ID as `actor.id`; live chat hashes the same account ID per world. The API permits the host to submit viewer command types. Reproduction: the same broadcaster votes through the authenticated dashboard command endpoint, then sends a different chat vote. Two ballot entries and two votes remain instead of one latest vote.

Use the same canonical participation identity across both ingress paths while keeping host authorization derived from the server session. Test both submission orders, changed votes and contribution counts. Broadcaster authority to commit a decision is separate from their ordinary ballot weight.

### R4 — P2: malformed and oversized input is reported as a server failure

Location: `apps/server/src/app.ts`, error handler around line 68.

Malformed JSON and a body over the configured 65,536-byte limit both return HTTP 500 with `DEPENDENCY_FAILURE`. These are rejected before game mutation, but should preserve safe client-error semantics (400 and 413). Reporting them as dependency failures encourages incorrect retries and obscures actual operational failures.

Handle the known framework validation/body-limit errors explicitly, retain generic sanitized responses for unexpected failures, and test that rejected payloads have no effects. No broad error-handling dependency is needed.

## Route and capability inventory

Every application route declared in `app.ts` is listed below, plus the public static/fallback surface. Listing a route does not assert successful verification against Twitch or OBS. "Checked" refers to the existing automated suite and/or the local review probes; provider-backed behavior still needs the external evidence described below.

| Surface | Intended caller and capability | Authority boundary and evidence |
| --- | --- | --- |
| `GET /health/live` | Anonymous process status | No world or credential data; local response checked |
| `GET /health/ready` | Anonymous database readiness | Minimal DB check; local response checked; does not establish full schema/deployment readiness |
| `GET /api/state` | Anonymous gets connection shell; creator gets own dashboard | Session, mode, connected status and fresh live grant; anonymous/overlay-cookie isolation checked |
| `POST /api/simulator/login` | Anonymous chooses one of three shared simulation creators | Explicit simulation mode; deliberately not private account authentication; denied in live mode |
| `POST /auth/logout` | Caller ends the session identified by its cookie | No cookie is an idempotent no-op; cannot name another session; origin/request-header guard |
| `POST /api/worlds` | Connected creator creates an Ark | Server session and unique active slot; anonymous and overlay mutation denial checked |
| `POST /api/worlds/:id/commands` | Current custodian issues legal game commands | Session-derived actor, world custody/mode/active-slot/version, engine role/phase rules; foreign-world denial checked; R3 remains |
| `POST /api/simulator/commands` | Connected simulation host rehearses viewer input | Bounded chat grammar and per-world aliases; mode guard prevents live access |
| `POST /api/worlds/:id/hosting` | Custodian parks/resumes own world | SQL custody, pending-intent and slot checks; foreign-world denial checked |
| `POST /api/receive-opt-in` | Creator changes own receiver consent | Identity comes from session; no arbitrary channel field |
| `POST /api/handoffs` | Source custodian prepares a transfer | SQL custody, boundary, version, target consent, mode, idle slot and freeze; live readiness additionally required; R2 remains |
| `POST /api/handoffs/:id/:action` | Source cancels; target declines/accepts | Party and action-specific checks; accept requires matching proof and atomic slot/custody change; wrong-party and missing-proof cases checked |
| Same route, `simulate-raid` action | Either party rehearses synthetic evidence | Simulation-only; third-party denial checked; live prohibition reviewed; never native raid proof |
| `GET /auth/twitch` | Anonymous starts creator consent | Live mode and configured client; one-use state cookie/DB record; local provider contract tested |
| `POST /api/operator/bot-authorization` | Operator starts separate bot consent | Operator bearer secret plus browser-origin/request-header guard; missing-secret denial and successful fixture flow checked |
| `GET /auth/twitch/callback` | Browser completes creator/bot consent | Cookie/one-use state, provider client/user/scope checks and distinct roles; encrypted storage tested; actual Twitch authorization pending |
| `POST /api/twitch/reconcile` | Creator reconciles own channel subscriptions | Live client, valid creator session, bot grant and public HTTPS; unauthenticated denial checked; real provider reconciliation and R2 remain |
| `POST /integrations/twitch/eventsub` | Twitch delivers authenticated notifications | Raw-body HMAC, freshness, channel/mode/type/version and known-subscription checks; tamper/retry/ingress tests; R1 remains |
| `POST /api/overlay-grant` | Creator rotates own read-only capability | Session-derived channel; rotation and old-grant rejection checked |
| `POST /overlay/:channel/session` | Holder exchanges a channel-bound capability | Hashed grant/channel lookup and path-scoped HttpOnly cookie; no creator session is granted |
| `GET /api/live/events` | Creator subscribes to own dashboard | Session rechecked on snapshots; browser tests cover updates; anonymous denial checked |
| `GET /overlay/:channel/events` | Capability holder watches assigned channel | Grant/channel/mode checked on snapshots; false control capabilities; cross-channel denial and open-stream revocation checked |
| Built assets and SPA fallback | Anonymous loads reference UI | Fixed `apps/web/dist` root; probes of private environment, original-idea and server-source paths returned only the HTML shell; unknown API path returned 404 |

Browser POSTs use the same-origin/custom-header guard. It is not sufficient authority on its own: sessions, scoped capabilities, operator authorization and webhook HMAC remain distinct. The webhook is exempt from browser CSRF requirements because its server-to-server signature is the authority.

## Component review against the existing architecture

| Component | Public-facing responsibility | Current assessment and restraint |
| --- | --- | --- |
| C1 Identity/consent | Creator and operator access | Session/one-use OAuth/role boundaries tested locally; correct bot replacement under R2 before expanding onboarding |
| C2 Twitch gateway | Receive real chat, presence and raid evidence | Raw-byte authentication tested; fix R1 and R2; genuine provider delivery still pending |
| C3 Participation | One eligible account, bounded actions | Parser, duplicate-message and phase-window checks tested; unify identity under R3; rate/retention/load work remains explicit |
| C4 Engine/content/puzzles | Authoritative outcomes and legal actions | Pure deterministic rules, exhaustive branch audit and bounded challenge rewards; no network/browser authority; no architecture change indicated |
| C5 Episodes | Solo progression, pause and hosting | Host-controlled windows and park/resume tested; automatic timers remain future work rather than a claimed capability |
| C6 Custody | Native proof and receiver acceptance | SQL races, freeze, consent and proof consumption tested; readiness bug R2 blocks claiming a dependable live handoff |
| C7 Database/work | Durable state, ingress and publishing | DB listens only on loopback locally; mode isolation tested; single-instance worker/retention/scale limits remain |
| C8 Live projection | Dashboard and spectator snapshots | Read-only projection, scoped feed, revocation and reconnect exercised; public proxy behavior remains unverified |
| C9 Dashboard | Private creator controls | Static shell does not confer access; stale/cross-custodian actions rejected; fix R4 feedback; retain functional reference scope |
| C10 OBS overlay | Read-only spectator experience | Chromium scope/continuity tested; actual OBS, 720p legibility and final Claude Design acceptance pending |
| C11 History | Persistent lineage and causal state | Public projection exposes recent sanitized events, not raw ballots/commands; full public history navigation is not implemented |
| C12 Validation | Reproducible evidence | Existing 25 tests pass; earlier two browser journeys and remote CI pass; 48 additional local review checks expose four gaps rather than establishing a clean security bill |
| C13 Operations | Publishing and public availability | No deployment; local HTTP and DB are loopback-only; history/privacy preflight passed; no further publication during this review |

## Evidence and limits

- Existing suite rerun: 25 tests across five files pass at `00250ce`. A passing baseline did not cover the four findings above.
- Additional local review: 48 recorded checks, including both denial and successful capability paths, against disposable PostgreSQL schemas. Four entries record reproduced defects; these are not described as 48 passing security tests. The temporary probe and raw result are ignored local artifacts, not committed regression coverage.
- Existing Chromium journeys cover cooperation, save/reload, overlay continuity, simulated transfer and a 390px viewport. They do not establish actual mobile Twitch, OBS or final design usability.
- [GitHub Actions run for `00250ce`](https://github.com/vighriday/TORCHLINE/actions/runs/40319660913) completed successfully. It predates this review and does not cover the new defect cases.
- `pnpm audit --json` returned zero reported advisories across the resolved dependency graph on this date. Registry advisory coverage is narrower than a source/security review.
- Before the initial authorized push, all 182 local Git objects were checked against private-path exclusions and 11 configured local-secret fingerprints. The repository remains private; its visibility was not changed. The private original concept and local credentials were not published.
- `main` is the planning baseline `39f59a2`; `feat/gameplay-foundation` is `00250ce`. The initial push finished before the owner's subsequent hold instruction arrived. No remote branch deletion, force-push, merge or additional push was performed during review.

Actual Twitch identities/scopes, public HTTPS callback behavior, native raid transfer, deployed SSE, real OBS and load/soak behavior remain separate acceptance gates. No accounts, broadcasters or hosting were fabricated to close them.

## Changes to prune or defer before the next push

1. Fix R1–R4 in the existing modules with focused regression tests. Avoid introducing a generic permissions framework to solve these specific lifecycle/identity/input defects.
2. Retain the full product roadmap, but hold new timer, allocation, networking and visual systems while these boundary fixes are reviewed. Do not discard the already-working solo/cooperative slice.
3. Keep Claude Design's renderer interfaces and fixtures; avoid further styling the reference frontend as though it were the final design.
4. Treat simulation as a shared rehearsal environment. A public simulator would let visitors act as its sample creators by design; never expose that database as private live gameplay.
5. Review each proposed push's diff, private-file/secret exclusions, exposed capability and authority, focused tests, and honest verification labels before publishing it. Do not release-tag the current snapshot as live-verified.

## Additional integration boundary review

| Capability | Authority and public behavior | Verification |
| --- | --- | --- |
| `GET /api/twitch/status` | Current creator session, live mode, own channel only; counts/status without tokens, cookies, raw chat or participant identities | Anonymous denial and provider-fixture status tests |
| `POST /api/twitch/disconnect` | Current creator, same-origin request; ends local authority before best-effort provider revoke; preserves Ark/history, closes pending offers | Session, overlay, queued-input and offer cancellation regressions |
| Existing operator bot flow | Operator setup key plus one-use OAuth state; signed-in creator has no implicit operator authority | Wrong-key browser denial and HTTP role tests |
| OAuth role recovery | Operator-initiated fresh bot consent; named confirmation for an active empty creator, bound to one browser via a five-minute HttpOnly capability. Revalidate Twitch and recheck history while holding role/account locks before ending creator access | Empty-account conversion, history-preserving rejection, escaped HTML, cancellation, expiry, CSRF/account substitution, grant identity/revocation and one-use race tests |
| Bot output | Signed, current channel chat queries; fresh grants and confirmed chat subscription before send; source-only channel and fixed safe summary | Four provider-fixture tests, including slow-send gameplay isolation |
| Existing creator mutations | Recheck connected account while holding channel lock; a stale pre-disconnect creator object cannot create/control/park worlds or opt in | Real PostgreSQL stale-authority test; late ingress is ignored |
| Existing overlay rotation | Same creator boundary; delete/insert atomically under channel lock | Four concurrent rotations leave one accepted read capability |
| Late token validation | Conditional update/delete against the originally read ciphertext; never overwrite/revoke a new grant | Both old refresh success and old invalid-token completion tested |

The reference bot setup form is public UI with an operator-protected action, not an administrator session. No general application admin/moderator role is implemented. Existing game controls remain custodian-only; viewers submit only normalized participation commands and queries. Handoff preparation, native proof and receiver acceptance remain distinct authorities.

The added `GET /api/operator/bot-setup` returns the browser's pending account label/expiry or null; `POST /api/operator/bot-setup/confirm` and `/cancel` require that same one-use setup cookie and same-origin request protection. Creator cookies and operator keys alone cannot confirm, and no client-supplied account ID is accepted. The encrypted pending grant originates only after operator authorization plus validated Twitch consent. Confirmation atomically revokes local creator authority and installs the bot grant; history remains immutable. Expired claims are rejected and removed by the live startup/minute cleanup. Simulation cleanup cannot touch them. See [ADR 0010](../decisions/0010-explicit-empty-account-bot-conversion.md).

Exposure checks inspect configured secret fingerprints and decrypted saved/pending grant tokens privately against committed/staged Git objects, tracked working files, built assets, local logs and nine selected public responses. OAuth Client IDs are public identifiers; secrets/access/refresh tokens must remain private. Passing these probes is bounded evidence, not a guarantee that every possible exposure or production threat has been audited. No private input or environment file enters the index.
