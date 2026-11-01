# Implementation and verification status

Updated November 1, 2026. `main` includes PRs #3–#5: the guided relay rehearsal, attributed inheritance, lineage, public Chronicle links, *What if?*, *Verify this record*, per-preset LIVEWIRE feeds, the one-command compose preview and the fixes listed below. Release [v0.1.0-preview.3](../releases/v0.1.0-preview.3.md) is being prepared. Source promotion is separate from deployment: nothing is deployed, and the live configuration runs only on the owner's PC, behind a temporary development tunnel, when the owner starts it. [Preview.2 consolidation and checks, as of 30 October](../reports/2026-10-30-main-consolidation.md) · [Design and cutover](../design/README.md) · [LIVEWIRE report](../reports/2026-10-30-livewire-v0.md) · [critical audit](../reviews/2026-10-29-comprehensive-audit.md).

## Implemented

- Deterministic five-chapter survival (`ark-v3`), meaningful shared puzzle/work-order rewards, bounded allocation and persistent seven-system physical condition.
- PostgreSQL state/events/outbox transactions, versioned historical replay, current custody, world parking and paginated history/causes. Migrations run through 014.
- Creator OAuth, dedicated bot role and named conversion; signed durable EventSub ingress, chat command routing, optional independent replies and subscription reconciliation.
- Server-owned clocks, manual/custom pacing, pause/restart recovery and input-loss quarantine/retry.
- Prepared/verified/consented custody transfer with live/simulation separation and native-proof requirements.
- Default-off LIVEWIRE v0: supply-cost mission (one in-game supply), finite allowance, normalized ballots, explicit lock/solo target, attested outcome, physical consequence and scoped OBS dock. No other speculative arms.
- Per-preset LIVEWIRE feeds: three illustrated presets (voxel "Minecraft", car-soccer "Rocket League" and "Souls Run"), each with its own scene and game-styled HUD. The streamer names the game actually played; feeds never read game data or decide results ([ADR 0037](../decisions/0037-cross-game-livewire-relay.md)).
- Final ten-screen design wired to these existing behaviors, shared corrected Ark/cockpit, Minecraft illustration, local preferences and read-only full/compact/automatic OBS.
- Judge Arena relay rehearsal: eleven steps through the public endpoints. It is simulated throughout: named practice identities, practice chat lines, two LIVEWIRE missions in two games with scripted streamer-attested results, and labeled simulated raid proof only ([ADR 0035](../decisions/0035-relay-rehearsal-and-attributed-inheritance.md), [ADR 0037](../decisions/0037-cross-game-livewire-relay.md)).
- Attributed inheritance dossier on the dashboard and OBS (decisions, communities, lost systems, debts linked to their cause); Chronicle lineage graph, season record and a broadcast season finale.
- Revocable, hash-stored public Chronicle links for following an Ark across channels; a link works only while the issuing server is reachable ([ADR 0036](../decisions/0036-public-chronicle-links.md)). Per-client request budgets on unsigned entry routes (audit A08).
- *What if?*: read-only, one-step alternatives for a saved captain decision or attested LIVEWIRE result, replayed from the exact saved state before it. The panel reports a match only when the recomputed choice reproduces the saved event; later chapters are never simulated ([ADR 0038](../decisions/0038-one-step-decision-alternatives.md)).
- *Verify this record*: replays the stored log through its pinned rules and compares SHA-256 digests of the replayed and saved ship. It is a replay consistency check, not a signed attestation ([ADR 0038](../decisions/0038-one-step-decision-alternatives.md)).
- One-command `docker compose` saved-practice preview (fresh in-memory database, loopback only, LIVEWIRE on), started and smoke-checked in CI by `scripts/smoke-compose.mjs` ([development guide](../operations/development.md)).
- Finished voyages release their channel on the next create or accept; presentation, history and `!history` name communities instead of raw IDs; named `!allocate hull 3 oxygen 2`.
- Stale channel-assignment and mission-ballot protection (migration 011, audit A11), dashboard SSE recovery (ADR 0034), shared channel projections, bounded operational retention (migration 012) and a bounded recent projection returned by commands and custody acceptance (audit A07, partly).

## Evidence boundaries

Current automated evidence (1 November 2026): 164 Vitest tests in 43 files against real PostgreSQL and 25 Playwright journeys, including the full two-game relay. CI is green, including the release-container smoke and the `docker compose` preview smoke ([workflow](../../.github/workflows/verify.yml)). These establish saved-practice behavior, not live Twitch acceptance.

As of 30 October 2026: the LIVEWIRE baseline passed 134 automated tests in 31 files and 16 browser journeys, plus native compact OBS practice recovery. Those observations establish the baseline, not the final presentation. The replacement passed a fresh local build, all 134 automated tests and all 15 original adapted browser journeys. Its first cutover CI run nevertheless failed 7 browser journeys (8 passed), so remote verification was then still a gate. Follow-up fixes addressed launch synchronization and slow graphics scheduling; five affected layout/recovery/gameplay checks passed locally. The Minecraft journey additionally passed with actual voxel first-frame readiness asserted. Final-design media was captured and reviewed. Native OBS 32.2.2 rendered full/compact views, refreshed and rotated access against an isolated saved simulation, with transparent outer pixels and no game change. Owner visual/mobile readability, outgoing broadcast and provider acceptance remain separate. [Final frontend evidence](../reports/2026-10-30-final-frontend.md).

As of 30 October, the consolidation also recovered two real PostgreSQL adversarial tests and fixed a timing draft overwritten by a late snapshot. The focused regression reproduces that defect before the fix; both cooperation journeys passed twice afterward. The [consolidation record](../reports/2026-10-30-main-consolidation.md) records that date's full-suite/CI evidence separately from these observations.

Seven physical fixtures are engine-generated. The ark-v2 balance enumeration covers 2,398 terminal branches: 964 colonies, 1,304 partial survivors, 130 wrecks. It does not exhaust v3 cooperation/allocation combinations; a seeded, bounded ark-v3 exploration (`tests/balance-v3.test.ts`) reaches all three endings with replaying witnesses, but it is a sample, not a proof. [Balance evidence](../reports/balance-ark-v2.json).

Historical genuine Twitch evidence, as of 29 October: broadcaster/bot consent, exact enabled chat/online/offline subscriptions, signed callback challenges and four incoming query chats. None of those four deliveries proved a persisted gameplay change. Two outbound replies were provider-accepted but absent to another viewer. Manual bot messages were also absent to other viewers after completed account/channel checks; account restriction remains a hypothesis, not a proven root cause. Replies are independently paused, with no gameplay dependency. [Investigation](../reports/2026-10-29-integration-diagnosis.md).

Later genuine evidence comes from the live database, read back on 1 November without changes:

- On 30 October, between 23:05 and 23:08 IST, three viewer chat messages arrived as signed `channel.chat.message` EventSub notifications.
- They were saved, one-to-one, as `scan` gameplay events on a live Ark. Each event has actor role `viewer` and a command ID derived from its EventSub message.

This establishes genuine viewer command → saved change. An overlay update caused by such a command has not been recorded.

## Still open

1. Owner final-design acceptance and sustained native OBS/mobile broadcast performance on this exact build. Native OBS rendering/refresh/rotation over loopback are verified for the 30 October build in saved practice.
2. A visible overlay update recorded from a genuine viewer gameplay command. The command → saved change step has signed provider evidence (above).
3. A live streamer-attested LIVEWIRE result (one live mission was opened and expired).
4. Bot replies that viewers can see. Twitch accepted two sends that other viewers did not see; replies stay disabled live, and gameplay does not depend on them.
5. Authentic native raid between separate consenting broadcaster accounts, receiver consent and preserved Ark history. The dedicated bot keeps its role.
6. Permanent hosting/TLS, durable off-host backups, deployed restart/rollback and measured operational soak. Nothing is hosted.
7. Audit A07 is partly addressed (bounded projection for commands and custody acceptance) and unsigned-route request budgets are implemented; A08 log correlation, load/soak work and exhaustive v3 balance remain open. A11 is fixed (migration 011). [Requirement matrix](../reviews/2026-10-29-requirement-matrix.md).

No native raid success is claimed. The Judge Arena relay uses practice identities, practice chat lines, scripted mission results and labeled simulated raid proof. Provider-fixture tests and saved practice remain labeled. Real current reachability must be rechecked; a historical tunnel or screenshot is not a durable deployment.
