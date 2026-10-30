# Changelog

## Unreleased — Release hardening

- Version channel assignments and creator authority atomically in migration 011. Retry snapshots that cross a park, rehost or custody change; recheck session/capability authority after slow projection reads.
- Reject stale dashboard/OBS world and mission-ballot snapshots, ignore superseded HTTP refreshes, and clear expired sessions. Regressions reorder actual HTTP/SSE responses around saved clues, mission ballots, world reassignment and logout; historical replay remains unchanged.
- Recover authenticated dashboard SSE feeds after transient projection or transport failures with bounded read-only retry. Session expiry remains terminal, and snapshots from a different creator are rejected.

## v0.1.0-preview.2 — October 30, 2026

- Recover the independent QA branch's two real PostgreSQL concurrency regressions and dated assessment during main consolidation. Preserve the superseded UI-LAB work without importing its prototype server or visuals.
- Preserve an unsaved captain timing selection when a delayed HTTP/SSE snapshot initializes the saved clock. Disable preparation inputs during a save and cover a real SQL update → SSE refresh → manual save → reload regression.
- Align all seven private packages, README and release notes at preview.2. Consolidate reviewed feature and QA history into main, retain immutable preview.1/archive tags, and start later engineering on a fresh branch. Source consolidation does not deploy or establish genuine Twitch/raid acceptance. [Branch and verification record](docs/reports/2026-10-30-main-consolidation.md).
- Give three measured software-rendering CI journeys bounded, explicit observation budgets without changing their frame/pixel, gameplay or custody assertions. These checks do not certify broadcast FPS.
- Stop unchanged server snapshots from redrawing reduced-motion Ark/Minecraft scenes. Render again for visual state, viewport, visibility or direct interaction changes; preserve the existing static-frame regression instead of relaxing it.
- Wait for real SSE revision delivery after direct-API browser setup, avoiding test-generated stale commitments while preserving server concurrency checks.

### Final Figma v2 integration

- Fix entry controls overlapping the manifest: copy/actions and status now occupy separate flow rows. Make the desktop relay starfield fill its screen instead of exposing the edges of a smaller opaque canvas; stack handoff information on narrow screens. Add geometric overlap checks at phone, tablet and desktop sizes.
- Coalesce graphics scheduling after each completed frame so slow rendering leaves time for controls and network updates. Fix browser setup racing the create-world button and avoid loading an unnecessary second graphics context. The first cutover CI run exposed browser timing failures; follow-up verification is recorded separately.
- Fix the blank README hero capture by waiting for both actual GPU frames and ancestor entrance fades, then regenerate the final-design stills and animations. A rendered frame behind a zero-opacity parent is not a visible capture.
- Verify actual OBS 32.2.2 full rendering, refresh, grant rotation, transparent compact resources and zero host controls on the new design over isolated loopback simulation. This does not prove public-edge or Twitch broadcast acceptance.
- Preserve the owner's complete ten-screen design, shared Ark/cockpit and Minecraft LIVEWIRE scene as strict TypeScript/React components. Connect actual state/actions, challenges, allocation, clocks, history, custody and Twitch setup. Prototype state and automatic result/vote generation are excluded.
- Remove the floating cyan panel at the ship's nose before media capture; preserve the bridge shell and running light. All new surfaces use the same corrected model.
- Mount one presentation entry. Archive and retire superseded source, fonts, media, capture tools and visual instructions; retain the existing session, SQL, engine, Twitch and read-only recovery boundaries. The original release and unrelated UI-LAB worktree remain untouched.
- Preserve canonical seven-system condition, permanent marks and exact choice effects. A repaired critical system keeps its warning. Use real paginated history and current custody instead of fictional records.
- Keep lazy graphics, self-hosted licensed fonts, bounded manual rendering, adaptive resolution, stable label portals, static reduced motion, optional local sound and working graphics retry. Fix the covered connection retry and delayed receiving opt-in feedback found by browser regression.
- Replace README artwork with final-design app captures and reproducible recording/encoding tools. Update current contracts, decisions and owner instructions. Native Twitch/gameplay, native raid, final native OBS and owner visual acceptance remain distinct gates.
- Fresh automated regression: 134 tests in 31 files pass. All 15 replacement browser journeys pass, with the Minecraft journey repeated after adding voxel first-frame instrumentation. Media/native checks are recorded separately; baseline presentation results are not reused as new evidence.

### LIVEWIRE v0

- Add the default-off deterministic mission extension without changing historical Ark reducers. Paid openings, finite per-boundary allowance, explicit pre-attempt lock, solo target and streamer-attested outcome apply one bounded persistent consequence.
- Add transactional mission APIs, migrations 009–010, normalized ballots, signed chat routing, deadline/restart recovery and custody/hosting exclusion. Results retain replay and permanent physical marks; no outbound reply is required.
- Add compact/automatic read-only OBS support and a read-only evidence probe that rejects simulation-only acceptance. Test SQL races, recovery batches, 10,000-ballot fixtures and historical replay.
- Baseline source 663888a passes 134 automated tests and 16 browser journeys, plus native compact OBS checks against a saved simulation. These are not genuine Twitch mission or final-design acceptance. [Implementation record](docs/reports/2026-10-30-livewire-v0.md).

## October 29–30, 2026 — Recovery and integration diagnosis

- Prove a native OBS render and controlled outage recovery on the dated baseline. Preserve exact provider results, native delivery counts and open gameplay/raid gates.
- Decouple optional outbound replies from incoming gameplay. Provider-accepted replies and manually typed bot messages remain absent to another viewer; do not claim a definitive provider restriction or weaken roles/settings.
- Add database execution/lock/idle-transaction budgets, failed-client disposal, consistent encrypted backup and isolated restore/replay checks.
- Fix chat-loss pause, admitted-input draining, overlay transient recovery and session-scoped self-revocation. Preserve unresolved audit concurrency/projection, retention/soak and wider balance work. [Diagnosis](docs/reports/2026-10-29-integration-diagnosis.md) · [Critical audit](docs/reviews/2026-10-29-comprehensive-audit.md).

## October 28, 2026 — Release foundations

- Establish aligned preview versions/tags, source-aware builds and a non-root application image with migration, health, graceful-shutdown and privacy smoke checks.
- Add bounded input admission, fair worker processing, indexed history, runtime configuration validation, feed limits, same-origin policy and clean deployment/backup procedures.
- Restore exact HTTPS/OAuth callbacks and genuine creator consent; preserve separate bot authorization and signed subscription verification. [Dated release report](docs/reports/2026-10-28-release-readiness.md).

## October 26–27, 2026 — Persistent game and Twitch foundations

- Implement the approved separation of deterministic game, hosted episodes and world custody using TypeScript, PostgreSQL and signed Twitch EventSub.
- Add reachable catastrophic outcomes, meaningful cooperative rewards, investigation/allocation, manual and timed windows, pause/parking, durable inbox/outbox, history and consent-scoped previews.
- Implement creator OAuth, dedicated bot setup with named empty-account conversion, token refresh/revocation, subscriptions and scoped read-only sources. Local/provider-fixture tests do not establish genuine native chat/raid acceptance.
- Publish requirements, architecture, decision stress reviews, implementation phases and replay-checked balance evidence. Keep the original concept and all internal inputs private.

Detailed superseded presentation history is retained in the archive tag. Current visuals and instructions follow only the owner's final Figma v2 source. [Current design](docs/design/README.md) · [Versions and release policy](docs/operations/releases.md).
