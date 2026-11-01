# Implementation and verification status

Updated November 1, 2026. The `feat/ark-complete-20261101` branch (pending review into main) adds the guided relay rehearsal, attributed inheritance, lineage and the fixes listed below. **Preview.2** consolidates the final Figma v2 presentation, LIVEWIRE, recovery work and independent QA coverage into the reviewed main baseline. Source promotion is separate from deployment; the existing running live service is not upgraded by this operation. [Consolidation and checks](../reports/2026-10-30-main-consolidation.md) · [Design and cutover](../design/README.md) · [LIVEWIRE report](../reports/2026-10-30-livewire-v0.md) · [critical audit](../reviews/2026-10-29-comprehensive-audit.md).

## Implemented

- Deterministic five-chapter survival, meaningful shared puzzle/work-order rewards, bounded allocation and persistent seven-system physical condition.
- PostgreSQL state/events/outbox transactions, versioned historical replay, current custody, world parking and paginated history/causes.
- Creator OAuth, dedicated bot role and named conversion; signed durable EventSub ingress, chat command routing, optional independent replies and subscription reconciliation.
- Server-owned clocks, manual/custom pacing, pause/restart recovery and input-loss quarantine/retry.
- Prepared/verified/consented custody transfer with live/simulation separation and native-proof requirements.
- Default-off LIVEWIRE v0: paid mission, finite allowance, normalized ballots, explicit lock/solo target, attested outcome, physical consequence and scoped OBS dock. No other speculative arms.
- Final ten-screen design wired to these existing behaviors, shared corrected Ark/cockpit, Minecraft illustration, local preferences and read-only full/compact/automatic OBS.
- Judge Arena relay rehearsal: nine steps through the public endpoints as named practice identities, with labeled simulated raid proof only ([ADR 0035](../decisions/0035-relay-rehearsal-and-attributed-inheritance.md)).
- Attributed inheritance dossier on the dashboard and OBS (decisions, communities, lost systems, debts linked to their cause); Chronicle lineage graph, season record and a broadcast season finale.
- Revocable, hash-stored public Chronicle links for following an Ark across channels ([ADR 0036](../decisions/0036-public-chronicle-links.md)); per-client budgets on unsigned entry routes.
- Finished voyages release their channel on the next create or accept; presentation, history and `!history` name communities instead of raw IDs; named `!allocate hull 3 oxygen 2`.
- Stale channel-assignment and mission-ballot protection (migration 011, audit A11), dashboard SSE recovery (ADR 0034), shared channel projections and bounded operational retention (migration 012).

## Evidence boundaries

The LIVEWIRE baseline passed 134 automated tests in 31 files and 16 browser journeys, plus native compact OBS practice recovery. Those observations establish the baseline, not the final presentation. The replacement passes a fresh local build, all 134 automated tests and all 15 original adapted browser journeys. Its first cutover CI run nevertheless failed 7 browser journeys (8 passed); remote verification remains a gate. Follow-up fixes address launch synchronization and slow graphics scheduling; five affected layout/recovery/gameplay checks pass locally. The Minecraft journey additionally passes with actual voxel first-frame readiness asserted. Final-design media is captured and reviewed. Native OBS 32.2.2 renders full/compact views, refreshes and rotates access against an isolated saved simulation, with transparent outer pixels and no game change. Owner visual/mobile readability, outgoing broadcast and provider acceptance remain separate. [Final frontend evidence](../reports/2026-10-30-final-frontend.md).

The consolidation also recovers two real PostgreSQL adversarial tests and fixes a timing draft overwritten by a late snapshot. The focused regression reproduces that defect before the fix; both cooperation journeys pass twice afterward. The [consolidation record](../reports/2026-10-30-main-consolidation.md) records current full-suite/CI evidence separately from these dated observations.

Seven physical fixtures are engine-generated. The balance enumeration covers 2,398 terminal branches: 964 colonies, 1,304 partial survivors, 130 wrecks. It does not exhaust v3 cooperation/allocation combinations. [Balance evidence](../reports/balance-ark-v2.json).

Historical genuine Twitch evidence: broadcaster/bot consent, exact enabled chat/online/offline subscriptions, signed callback challenges and four incoming query chats. None of those four deliveries proved a persisted gameplay change. Two outbound replies were provider-accepted but absent to another viewer. Manual bot messages were also absent to other viewers after completed account/channel checks; account restriction remains a hypothesis, not a proven root cause. Replies are independently paused, with no gameplay dependency. [Investigation](../reports/2026-10-29-integration-diagnosis.md).

## Still open

1. Owner final-design acceptance and sustained native OBS/mobile broadcast performance on this exact build. Native rendering/refresh/rotation over loopback are verified.
2. Genuine viewer gameplay command → saved change → visible overlay, with valid open phase and signed provider evidence.
3. Authentic native raid between separate consenting broadcaster accounts, receiver consent and preserved Ark history. The dedicated bot keeps its role.
4. Permanent hosting/TLS, durable off-host backups, deployed restart/rollback and measured operational soak.
5. Audit A07 state-size and full-history read costs (A11 is fixed on this branch), request throttling and log correlation (A08), wider load/soak work and exhaustive v3 balance. [Requirement matrix](../reviews/2026-10-29-requirement-matrix.md).

No new genuine Twitch or native raid success is claimed by the frontend work. Provider-fixture tests and saved practice remain labeled. Real current reachability must be rechecked; a historical tunnel or screenshot is not a durable deployment.
