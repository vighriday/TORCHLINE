# TORCHLINE critical implementation audit — October 29, 2026

**Verdict: a substantial, playable development preview; not a completed live Twitch product or a production-ready release candidate.** The persistent game, cooperative mechanics, database transactions and designed frontend are real implementations. The defining live experience has not passed acceptance. This audit also reproduces recovery defects that a green CI run did not expose.

Audited source: [`77003160017a667318c0174ad9af4a4b6b26ca76`](https://github.com/vighriday/TORCHLINE/tree/77003160017a667318c0174ad9af4a4b6b26ca76), branch `feat/gameplay-foundation`. Application version `0.1.0-preview.1`; published tag remains on `cb8348b`. Findings refer to the audited source, before this documentation commit. No application fixes, live gameplay, grant refresh, subscription changes, deployment or native raid were performed for this audit.

Read alongside the [requirement and authority matrix](2026-10-29-requirement-matrix.md) and [sanitized evidence](2026-10-29-audit-evidence.json). The original concept was compared locally with the owner's explicit audit-only permission. Its contents are not reproduced here, and it remains ignored and unchanged.

## What is genuinely finished, and what is not

| Area | Assessment |
| --- | --- |
| Persistent solo game | Implemented: five chapters, three reachable endings, consequential route/work-order challenges, optional investigation/allocation, captain commitment, save/reload and park/resume. Automated evidence is strong; enjoyment and complete real Twitch play remain unmeasured. |
| Physical Ark and design | Actual React/TypeScript consumers of server state, shared SVG/Three.js ship, lasting damage/repairs/sacrifices, authored encounter effects, mobile/reduced-motion fallback. This is not merely the imported prototype. Installed OBS and owner/human acceptance remain open. |
| Twitch foundations | Real OAuth/Helix/EventSub code, durable signed ingress, separate bot, token lifecycle and subscription reconciliation. Real application/grants/callback setup worked previously. There is still no genuine applied viewer command or accepted native bot reply in the evidence. |
| Custody | Real transactional protocol with meaningful PostgreSQL race/permission tests. Synthetic proof is technically isolated from live mode. A real two-broadcaster native raid has never established end-to-end acceptance. |
| Recovery/security | Meaningful implemented controls and real backup/process tests. Subscription-loss pausing and transient overlay recovery fail new probes. Retention, monitoring, deployed load, remote recovery and always-on availability remain incomplete. |
| Release/submission | Reproducible preview source and CI-built image exist. No permanent deployment, native acceptance recording, completed judge-access package or submitted-entry evidence was found. A source prerelease is not those deliverables. |

The best stage label is **feature-rich alpha / integration acceptance candidate**. G1 and G3a have substantial executed evidence. G2 and G3b remain unsatisfied; G4/G5 have considerable local implementation but not their full live/usability acceptance; G6 and G7 are incomplete. Do not describe the published preview as production-ready.

## Evidence collected now

Checks ran sequentially on the Windows workspace with Node 24.22.1 and real PostgreSQL 17. Disposable schemas/databases kept owner worlds intact. Exact observations, scope and counts are in the evidence file.

| Check | Fresh result and interpretation |
| --- | --- |
| Format, version alignment, build/typecheck | Pass. |
| Vitest | **97/97 tests, 21 files pass**, 131.83 seconds. This includes real SQL transactions, process replacement and native encrypted restore; provider behavior is still synthetic in integration tests. |
| Complete Playwright suite | **10 pass, 1 fail** in 4.1 minutes. The bot-conversion journey leaves a visible connection error. Three subsequent isolated repetitions pass: an intermittent race, not a consistently green baseline. |
| Legacy / balance | Original tree has zero wrecks; v2 regeneration retains 2,398 terminal branches, including 130 wrecks. Current v3 has separate targeted tests, not that same exhaustive report. |
| Design / README proof generation | Pass with no tracked artifact drift. README counterfactual uses current v3 and replay checks. |
| Repository / dependency / artifact-secret checks | Pass; production dependency audit reports no known vulnerabilities. Secret scan covers 15 private fingerprints, 1,085 Git objects and tracked/build/log artifacts; **zero public responses were scanned in this run**. This is not a penetration-test certificate. |
| Exact-source remote CI | [`40817957124`](https://github.com/vighriday/TORCHLINE/actions/runs/40817957124) succeeds for `7700316`, including Linux release-image smoke. Docker is unavailable locally; no fresh local container result is claimed. |
| Reported failed workflow | [`40737973250`](https://github.com/vighriday/TORCHLINE/actions/runs/40737973250) failed at installing pnpm with npm `ECONNRESET`, before source checks. That infrastructure failure is distinct from this audit's reproduced browser failure. |
| New adversarial probes | Signed subscription revocation does not pause; stale grant blocks local disconnect; one temporary overlay read failure permanently closes its browser feed. All reproduced with isolated SQL and fixture provider, never injected into the live store. |
| Performance probes | 10,000 current-rule unique ballots counted correctly in a CPU-only run. Cost increases with ballot-map size. Four idle creator feeds cause 321 pool queries in eight ticks. A 500-message signed fixture burst bounds pending work but slightly misses the 2-second p95 acknowledgement target. None is a deployed capacity/soak result. |

At **2026-10-29 04:48:58 UTC / 10:18:58 IST**, real-service diagnostics find:

- Real application credentials still mint and validate an app access token.
- Public HTTPS probes fail. The development origin cannot currently establish health, route denials or callback delivery.
- Stored creator and bot access tokens fail current Twitch validation. The read-only verifier does not attempt refresh; expiry versus recoverable refresh versus renewed consent is unresolved. Yesterday's validated grants do not prove today's session health.
- Twitch still lists **3/3 exact enabled chat/online/offline subscriptions**. Enabled provider metadata does not prove a reachable callback. Incoming raid subscription is not part of those three and requires receiver opt-in.
- Six historical signed challenge records remain; latest is October 27, 17:02 UTC.
- Lifetime diagnostics report zero applied genuine chat, accepted bot sends and live custody changes. Since the preserved October 28 baseline, signed chat, persisted chat actions, accepted replies, signed raids and linked live transfers are **all zero**.

No native OBS test, two-broadcaster session or human mobile playtest was substituted with Chromium. Historical October 28 public browser/overlay success remains useful dated evidence, not current availability.

## Findings, ordered by consequence

Severity: **P0** immediate authority/data-integrity emergency; **P1** blocks the claimed complete live release; **P2** important correctness, operating or product gap; **P3** bounded polish/documentation debt. No P0 exploit was demonstrated. A release gate is labeled separately from a reproduced software defect.

| ID | Severity / kind | Finding |
| --- | --- | --- |
| A01 | P1 · acceptance gate | The central real Twitch journey is unproven and the current public preview is unavailable. |
| A02 | P1 · reproduced defect | Losing chat does not pause participation; timed phases continue without the audience. |
| A03 | P1 · reproduced defect | A transient projection error permanently disconnects an otherwise valid OBS/browser overlay. |
| A04 | P1 · delivery gate | Permanent hosting, staging recovery/load, judge access and genuine submission artifacts are unfinished. |
| A05 | P2 · intermittent defect | Successful bot conversion can leave a false connection-failure screen. |
| A06 | P2 · reproduced defect | A stale provider-validation timestamp blocks the local disconnect operation intended to revoke authority. |
| A07 | P2 · measured architecture risk | Full participant maps and repeated per-feed projection work undermine the planned large-chat envelope. |
| A08 | P2 · operating gap | Edge admission, retention, database execution timeouts and actionable telemetry are incomplete. |
| A09 | P2 · validation gap | The advertised exhaustive balance evidence does not cover current cooperation trajectories. |
| A10 | P2 · product risk | Meaningful mechanics exist, but repeat-session depth, new-viewer feedback and inheritance comprehension are not validated. |
| A11 | P2 · contract gap | Browser snapshots are blindly replaced without stale-revision/assignment protection. |
| A12 | P2 · documentation drift | Current-state guidance contradicts itself and contains commands/configuration that do not work as described. |
| A13 | P3 · UI contract debt | Inheritance/archive passenger meters use 180 rather than 216; weak repaired systems can retain healthy-looking colors; timer settings do not restore saved policy. |
| A14 | P3 · maintenance debt | Version dispatch, runtime validation and module-boundary enforcement have avoidable future risks. |

### A01 — Finish the real chain before calling the integration complete

The positive provider-contract journey in [twitch-integration.test.ts:110](../../tests/twitch-integration.test.ts#L110) is valuable: OAuth, signed chat, ready checks, raid-shaped proof and acceptance reach the real database. However, [twitch-provider.ts:63](../../tests/twitch-provider.ts#L63) supplies its OAuth identities, scopes, stream status, challenge response and successful sends. It does not exercise Twitch's actual delivery behavior.

Required proof is still: fresh reachable HTTPS → current grants/refresh → fresh signed callback → actual viewer action → canonical world update → visible native bot response → installed OBS → real raid → receiver continuation and former-host denial. The code exists for those paths; their external acceptance does not. Receiving `enabled` subscription metadata while the callback is down demonstrates why provider configuration and gameplay verification must remain separate.

Keep both existing accounts/app. Restore the service/tunnel or approved permanent origin, run the normal lifecycle and revalidate before asking for fresh consent. Then use [the live checklist](../operations/live-release-checklist.md). Do not automatically reset worlds, acceptance baselines or grants to manufacture a clean demonstration.

### A02 — Chat revocation leaves the game clock running

[system-design.md:90](../architecture/system-design.md#L90) promises subscription-loss pausing. [twitch-subscriptions.ts:181](../../apps/server/src/twitch-subscriptions.ts#L181) instead updates the subscription status and delivery record. The webhook immediately acknowledges revocation at [app.ts:680](../../apps/server/src/app.ts#L680); no pause is queued. [episodes.ts:99](../../packages/storage/src/episodes.ts#L99) advances due clocks based on connected custody, without chat readiness.

**Reproduction:** authorize fixture bot/creator, reconcile, start a v3 challenge; deliver a correctly signed revocation with `authorization_revoked`. HTTP 204 and status persistence succeed, but phase stays `challenge`. Expire its deadline and tick: phase becomes `decision`. Resources are not fabricated and no story choice is auto-committed, but viewers lose their challenge opportunity during an integration failure.

Token-validation invalidation also uses direct SQL in [twitch-lifecycle.ts:95](../../apps/server/src/twitch-lifecycle.ts#L95), separate from the explicit-disconnect pause path. Creator invalidation stops connected-only progression but does not record the same resumable episode pause; bot invalidation removes chat readiness without disconnecting every creator. Test and unify these semantics rather than assuming the existing disconnect regression covers them.

**Acceptance for a fix:** loss of chat authority stops the relevant episode safely, drains or explicitly ends previously accepted authority under the existing locks, persists remaining time/reason, and requires deliberate resume after recovery. Exercise revocation, provider-missing reconciliation, bot invalidation, temporary outage and reconnect. Preserve offline/raid ordering and never infer proof from recovery.

### A03 — Overlay recovery treats a temporary outage as permanent revocation

[app.ts:832](../../apps/server/src/app.ts#L832) catches **any** snapshot-load failure, emits `unavailable`, and ends SSE. [main.tsx:127](../../apps/web/src/main.tsx#L127) clears the world, reports access ended, and explicitly closes EventSource. Its effect has no retry path; transport-level automatic reconnect is disabled by that close.

**Reproduction:** load the actual production overlay in Chromium with a valid temporary simulation grant. Make its isolated Store's `active()` fail once, then immediately restore it. A worker tick emits `unavailable`. After four more successful ticks the overlay still says access ended and has made only one feed request; the saved world is unchanged. This is a browser/SQL fault test, not native OBS evidence.

**Acceptance for a fix:** distinguish revoked/expired access from transient dependency failure, reconnect with bounded backoff while rechecking the same read-only grant, and restore the current snapshot without replaying effects. Explicit revocation must remain terminal. Verify startup outage, mid-stream outage, source hide/show, reload and token rotation in Chromium **and actual OBS**.

### A04 — Packaging is ahead of deployment acceptance

[Dockerfile](../../Dockerfile), [.dockerignore](../../.dockerignore), [verify.yml](../../.github/workflows/verify.yml) and [smoke-container.mjs](../../scripts/smoke-container.mjs) are substantive. Exact-source CI builds the image and tests non-root/restricted execution, migration/readiness/assets/denials and Linux shutdown. There is no equivalent executed provider deployment, remote backup schedule, provider restore, measured staging rollback/soak or always-on judge endpoint.

The encrypted backup helper has a real PostgreSQL public-schema, corruption/wrong-key/no-overwrite and world-replay test ([backup.test.ts:8](../../tests/backup.test.ts#L8)). The earlier actual live scratch drill restored **zero worlds**; it cannot establish recovery of today's live Ark. No fresh live backup was created during this read-only audit. Provider-side effects are not rewound by restoration; restored pending bot work/proof windows and stale credentials require explicit reconciliation before reopening play.

The repository remains private and its default branch is still `main`; the working code is on the named feature branch and preview tag. README clone instructions explicitly select it. A judge following only the bare repository/default branch may reach the old scaffold. This requires a deliberate submission source/access decision, not an unauthorized merge or visibility change.

### A05 / A06 — Onboarding and disconnect have recovery edge cases

**A05:** the full suite failed [live-onboarding.spec.ts:73](../../tests/browser/live-onboarding.spec.ts#L73): successful named bot conversion was followed by `Live updates interrupted. Reconnect to resume.` Three isolated repeats pass. In [main.tsx:86](../../apps/web/src/main.tsx#L86), an old creator feed's `unavailable` handler starts a refresh and later writes a connection error while conversion concurrently removes that creator session. This is the likely race; no application patch was made to claim a confirmed root-cause fix. The original failure log is retained; subsequent Playwright repeats reset its ordinary output directory, so the original trace is no longer available. Add deterministic scheduling around the authority change and verify final anonymous/bot state without a stale error.

**A06:** [app.ts:637](../../apps/server/src/app.ts#L637) calls the general `currentCreator` gate. That gate requires provider validation within one hour ([app.ts:189](../../apps/server/src/app.ts#L189)), before local disconnect can execute. With an otherwise valid session and a two-hour-old validation timestamp, disconnect returns **401**, leaving `connected=true` and the local grant present. This is fail-closed for gameplay, but prevents the requested local revocation during provider trouble. The comment that local revocation succeeds despite provider failures only applies after this gate.

Use a narrowly scoped, still session-authenticated local revocation path; do not relax mutation authority generally. Test stale validation, failed provider refresh, missing grant, current custody and concurrent transfer. Sessions/grants/world history must retain their intended separation.

### A07 — Bounded history queries do not solve all participation cost

The 50,000-ballot test ([history-performance.test.ts:5](../../tests/history-performance.test.ts#L5)) proves a partial index and bounded results using inserted synthetic rows. It deliberately does not apply 50,000 real votes or attest replay.

Actual votes, inspections and allocations remain participant maps inside canonical JSONB. [ark-v3.ts:327](../../packages/engine/src/ark-v3.ts#L327) clones the full state for each transition; storage rewrites it, and projection traverses maps and computes choice previews. In a fresh 10,000-unique-vote **pure-engine** probe, the first 1,000 take **98 ms**, the final 1,000 **5,061 ms**; state grows from **32,242 to 320,243 bytes**. Correctness holds, but this is size-dependent cost, not constant-time ballot admission. Database/network/feed costs are excluded.

[app.ts:1032](../../apps/server/src/app.ts#L1032) polls every subscriber even when no publish intent changed. [projection.ts:78](../../apps/server/src/projection.ts#L78) assigns a new `serverAt`, making otherwise identical snapshots differ. Four idle creator feeds caused **321 pool queries in eight ticks / 2.438 seconds**, with no mutations. `Store.library()` loads full state for 50 worlds even though only summaries are returned; host-command return paths still fetch complete histories ([index.ts:326](../../packages/storage/src/index.ts#L326), [index.ts:517](../../packages/storage/src/index.ts#L517)).

A separate simultaneous **500 signed fixture messages** returned 500 HTTP 204s: p50 2,000 ms, p95 2,024 ms, max 2,035 ms. Admission retained 106 pending actions and explicitly rejected 394; draining applied 106 unique votes and left zero pending. The 128-pending ceiling holds, while rejected traffic still incurs durable work. This burst slightly misses the internal p95 target; it is not Twitch/network latency or a sustained benchmark.

The published harness was then executed independently: the same three recovery defects reproduce, idle views still cause 321 pool queries, and a second 500-message burst reports p95 **1,988 ms**, 103 admitted votes/397 rejections and no remaining backlog. This straddles the target rather than establishing a consistent performance failure or pass. Original numbers remain in the dated evidence; repeats are recorded separately.

First share/cache each channel's immutable projection per revision and separate clock synchronization from publication, preserving per-feed authority rechecks. Avoid full-history reads and wide library rows in hot paths. Then run the documented mixed-world/soak envelopes before deciding whether participant tables or more partitioning are necessary. A Redis/transport rewrite without measurements would not address full-state cloning or SQL writes.

### A08 — Operational guardrails are only partly complete

- Signed input has persisted viewer/world budgets, pending bounds, fairness and dedup ([admission.ts](../../packages/storage/src/admission.ts)); unsigned bodies have 64 KiB bounds. Public OAuth starts and other HTTP traffic have no application/edge request admission policy in the current deployment. Valid rejected callbacks, dedup rows, event logs, completed outbox rows, expired sessions and OAuth states have no scheduled retention sweep. The data document correctly calls retention a proposal. Do not prune proof/history records ad hoc.
- The `pg` pool has a connection acquisition timeout but no explicit statement, transaction/lock execution budget ([index.ts](../../packages/storage/src/index.ts)). HTTP request/connection settings do not themselves cancel a PostgreSQL operation. A blocked database query can hold a pool client and the serial worker tick; fault tests need to establish bounded release/retry.
- Private diagnostics provide counts and oldest inbox age. They do not implement the runbook's command/world/delivery-correlated structured event logs, p95 metrics, queue/lock/event-loop monitoring or alerts. Several catches emit only generic messages ([app.ts:1011](../../apps/server/src/app.ts#L1011)). `/health/ready` checks database/schema, not fresh chat or a progressing worker. Keep these health meanings distinct.

Add the minimum deployed telemetry and failure budgets needed to diagnose the actual session; then prove queue stability, denial rates and recovery. Existing admission tests use small bursts (20 concurrent callbacks, 45-item noisy neighbor), not the planned sustained envelope.

### A09 / A10 — Mechanics are real; balance coverage and engagement claims have limits

The original unreachable-wreck problem is genuinely corrected. Puzzles do more than change decoration: shield routing reduces later damage, navigation affects affordability/entry, work orders stop future oxygen loss, and allocation spends real bounded power. Preview/replay and no-farming rules are implemented. The README's one-viewer counterfactual is reproduced from v3, rather than fictional copy.

However, [balance-analysis.ts:72](../../scripts/balance-analysis.ts#L72) creates the historical default v2 world. [cooperation.test.ts:139](../../tests/cooperation.test.ts#L139) reaches all three v3 endings with no allocation/challenge bonuses, while its 112,211 normalization combinations test arithmetic in isolation. Neither enumerates combined multi-chapter budgets, clue priorities, repair subsets, affordability and deadline closures under current rules. This is a coverage gap, not evidence of an already discovered unreachable ending. Preserve v2, add a distinctly versioned current-rule exploration with witnesses and properties.

Gameplay also has a clear ceiling: four chapters reuse the same six-node graph with fixed constraints; one person can supply all clues and repairs. Solo accessibility is intentional, but collaboration at audience scale and repeat-session replayability remain assumptions. Timers close opportunities; they do not continuously drain oxygen despite some urgent copy. There is no seeded season, alternate mission pool or rescue expedition.

Invalid route/work-order submissions and rate rejections have no individual viewer feedback beyond aggregate state/private diagnostics; bot output handles only `!status`/`!history`. Keep output bounded, but verify that viewers can understand failed attempts. The inherited Ark is physically preserved and Archive has named provenance; the receiver's immediate recap is the last event summary, not a dedicated attributed arrival briefing. There is no custody-arrival cue, shareable spectator history or visual historical replay. These are honest documented limits, but they weaken the central emotional demonstration unless the actual receiver can explain what they inherited quickly.

Prioritize observed comprehension and one complete real solo/cooperative run. Do not add new seasons or mandatory multi-person locks before the core live gates pass.

### A11 / A12 / A13 / A14 — Smaller inconsistencies still matter

**A11:** [main.tsx:77](../../apps/web/src/main.tsx#L77) and its overlay counterpart replace snapshots directly; there is no stale world revision/channel-assignment sequence filter as proposed in [system-design.md:82](../architecture/system-design.md#L82). HTTP refreshes and SSE can arrive in different orders. Expected-version writes protect saved state, but the UI can temporarily regress and issue stale actions. Add an ordering/authority-epoch policy and response-reordering tests; do not invent a world revision comparison across different world IDs.

**A12:** older status paragraphs say both “no live Ark” and “first live Ark,” and repeatedly call different test counts/current reachability current. [live-release-checklist.md](../operations/live-release-checklist.md) retains “no live Ark” in steps 1/4, contradicting step 2 and the database history. [development.md](../operations/development.md) says no container option exists and lists planned `APP_ENV`, `PARTICIPANT_HASH_KEY`, `LOG_LEVEL` behavior absent from runtime; session storage is hashed rather than signed, and participant hashing currently uses the session secret. The game-design table's `!allocate hull 3 oxygen 2` is rejected by [index.ts:219](../../packages/twitch/src/index.ts#L219); actual grammar is `!allocate 3 2`. `!history` returns a summary, not a working public history link. The analyzer text says timers/allocation are not implemented, when they are merely outside its historical v2 analysis. `POST /api/worlds` has no request idempotency key despite the target API description; the active-slot constraint prevents immediate duplicate active creation, not a durable creation-request identity.

Record one dated current acceptance snapshot, retain older reports as history, and correct operational instructions rather than copying another optimistic status paragraph. This audit's pointers supersede earlier present-tense status claims without rewriting their evidence.

**A13:** [DeckViews.tsx:54](https://github.com/vighriday/TORCHLINE/blob/archive/frontend-before-final-2026-10-30/apps/web/src/DeckViews.tsx#L54) scales passengers to 180; [WorldRecords.tsx:52](https://github.com/vighriday/TORCHLINE/blob/archive/frontend-before-final-2026-10-30/apps/web/src/WorldRecords.tsx#L52) uses that component in offer inspection, while FlightDeck correctly uses 216. `conditionColor()` prefers repaired cyan before checking weak integrity, despite the presentation contract's critical-repair warning. [EpisodeView.tsx:145](https://github.com/vighriday/TORCHLINE/blob/archive/frontend-before-final-2026-10-30/apps/web/src/EpisodeView.tsx#L145) initializes timed settings locally rather than restoring saved durations, which are absent from the DTO. Correct these through shared semantics and focused visual/state tests.

**A14:** engine transition/replay dispatch is versioned, but convenience exports such as choices/titles are permanently re-exported from v2 ([engine/index.ts](../../packages/engine/src/index.ts)). They agree today; a later rules fork can silently drift. State/interface types do not validate stored JSON at runtime; SQL checks do not establish the complete JSON schema. TypeScript package separation exists, but a comprehensive automated forbidden-import rule is absent. The 1,137-line app/controller and duplicated immutable rule files increase review cost. Preserve historical outputs; extract coordination boundaries only after release-critical behavior is secured. No generic framework migration is warranted.

## Architecture decision stress review

The approved stack remains appropriate. The audit does not recommend replacing it. Its weakest points are composed behavior and missing acceptance, not library choice.

| Components from the architecture review | Result and implication |
| --- | --- |
| C1 identity, C2 Twitch, C3 participation | Minimal server grants, raw HMAC, current subscriptions, actor derivation and bounded input are implemented. A02/A05/A06 expose gaps where authority changes meet active episodes/UI. Real provider delivery is still A01. |
| C4 engine, C5 episodes | Pure/versioned transitions, forecasts and mechanical consequences work; SQL owns time. Current combined balance coverage and loss-of-chat timing require work. No raid dependency gates solo chapters. |
| C6 custody, C7 storage/work | Sorted channel locks, frozen revision, unique proof consumption, single recipient slot and atomic custody/history/outbox protect real invariants. Worker fencing intentionally permits one replica. Load/SQL budgets, retention and deployed restoration remain open. |
| C8 projection, C9 controller, C10 OBS | Shared canonical DTOs preserve design flexibility and read-only overlays. Polling duplication, stale-response handling and terminal-on-transient recovery violate important runtime expectations. SSE itself has not yet failed an actual deployed OBS test; changing transport now would be speculative. |
| C11 history, C12 validation, C13 operations | Bounded cursor history, causal links, immutable replay and real SQL/process/backup tests are substantive. Synthetic provider/browser results are not native proof; declared load/soak/production gates have not been executed. Deployment and submission remain dependencies. |

No source path found in the production application loads the design export's simulator, fictional creators or a mocked Twitch fetcher. The prelaunch vessel intentionally has static unsaved values and is labeled; simulator accounts/raid injection are mode-restricted. Actual live channel state does not originate from those fixtures. The hardcoded `genuineRaidVerified: false` and “verification pending” labels are conservative placeholders that will not automatically become a verified acceptance record after a real session.

## Completion roadmap through the deadline

This is a dependency plan, not a promise based on invented staffing or hours. Start the broadcaster scheduling dependency immediately; it must not wait for more presentation work.

| Checkpoint | Work / decisive exit condition |
| --- | --- |
| **October 29: stabilize the existing journey** | Fix A02/A03 with deterministic regression tests; resolve A05/A06 and response ordering. Keep gameplay/art stable. Restore the existing live process/HTTPS, let normal refresh/reconciliation run, then verify fresh grants and callbacks. Collect actual viewer action plus visible bot reply as soon as reachable. |
| **October 30: prove the signature** | Native OBS refresh/reconnect/rotation at both broadcast sizes; two consenting live broadcasters prepare → native raid → inspect/accept → same scars/history → former-host denial → receiver plays. Record evidence without credentials. If access is unavailable, declare G3b blocked externally and keep hardening; do not relabel simulation. |
| **October 30–31: establish a deployable candidate** | Approved always-on HTTPS/managed PostgreSQL, pinned image digest, one migration/replica, secret/TLS review, deployment-shaped backup containing a world, isolated restore/cutover and compatible rollback. Minimal telemetry and edge policy; measured baseline, stress, large-ballot and hour-soak cases from the validation plan. Investigate failures before claiming capacity. |
| **October 31–November 1: close product and evidence gaps** | Current-rule combined exploration, one complete real solo season, receiver/mobile spectator comprehension, accessibility/OBS frame time, bounded chat feedback/copy and small UI inconsistencies. Freeze scope; run exact-source full checks and repeat critical fault tests. No variants/directory/salvage/delegated roles. |
| **November 1–2: package and submit** | Identify immutable submitted source, grant approved judge access, clean-machine setup, public YouTube video under three minutes with genuine Twitch and Codex footage, actual primary session ID, final description and submitted-entry confirmation. Keep the project available throughout judging. |

The official [rules](https://twitchcon-codex.devpost.com/rules) and [schedule](https://twitchcon-codex.devpost.com/details/dates), rechecked October 29, still show November 2 at 14:00 PST (**November 3 at 03:30 IST**). They disagree on judging dates. The resources page returned 403 in this audit, so its earlier UTC discrepancy was not revalidated. Retain the conservative **November 2, 23:59 IST** internal cutoff and availability through the longer rules window; recheck organizer updates before submitting. This audit does not determine entrant eligibility.

If native raid evidence is still absent by the recording/freeze checkpoint, the candid submission is a persistent Twitch game with an implemented, fixture-tested handoff protocol awaiting live acceptance. That weakens the signature claim. A genuine demonstrated two-community responsibility transfer is worth more now than another graphic, README interaction or expansion mechanic.

**Recommended next phase for review: integration acceptance and recovery corrections.** Preserve the approved architecture and five-chapter scope. Resolve the reproduced defects, prove the real chain, and make deployment/recovery reproducible before expanding features.

## Audit limits and reproducibility

The audit traced production packages, HTTP/controller/renderer paths, migrations, tests/fixtures, deployment/backup/tunnel helpers and documentation families: requirements/game rules, architecture and stress matrix, ADRs 0001–0026, research/source/risk registers, plans, changelog, design handoffs and prior reports. This is a source/automated/differential audit, not formal verification of every interleaving, an independent legal review, an installed-OBS session or a human playtest. CSS/frame assertions do not establish contrast comprehension or entertainment quality. No raw private concept/session/credential material is included in the report.

Fresh commands: `pnpm format:check`, `pnpm check:version`, `pnpm build`, `pnpm test`, `pnpm test:browser`, `pnpm exec playwright test tests/browser/live-onboarding.spec.ts --repeat-each=3`, `pnpm audit:legacy`, `pnpm audit:balance`, `pnpm design:fixtures`, `pnpm readme:proof`, `pnpm check:repo`, `pnpm audit --prod --audit-level=high`, `pnpm check:public-secrets -- --artifacts-only`, `pnpm twitch:verify:live`, `pnpm live:acceptance check`. Real-service diagnostics are time-sensitive and require the ignored existing configuration. Do not run `begin --replace` as a routine verification step.

Original probes and logs remain ignored under `.local/audit-2026-10-29/`. The [published diagnostic harness](../../scripts/audit/README.md) reproduces those boundaries using `probes.ts`, `scale.ts` and `ingress.ts`, refuses live mode and writes to a separate ignored reproduction directory. Run with Node24 and `--env-file=.env`; it uses `tests/helpers.ts` disposable schemas and the explicit provider fixture, never `.env.live`. Diagnostics report observations rather than declaring release tests passed. Browser failure logs stay local; the original trace limitation is recorded above. No deliberately failing regression was added to the passing application suite merely to publish the audit.
