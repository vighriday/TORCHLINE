# Feasibility, concept gaps and risks

Assessment date: 2026-10-26. The platform documentation supports the core design. No account, deployment, Twitch integration, playtest or stress-test evidence exists yet. Priority expresses consequence and dependency, not a statistical estimate of failure.

## Feasibility conclusion

A persistent single-channel cooperative game and consented raid-based custody transfer are technically feasible with documented Twitch interfaces. Reliability depends on building explicit state transitions and proof policy around incomplete, retryable notifications. The strongest product is a complete game with portable continuity; a raid animation or a series of polls would not establish that value.

Delivery can be ambitious without guessing implementation capacity: establish measurable gates, observe throughput, and expand the validated product continuously. The real deadline is fixed; team size, daily hours, confirmed broadcasters and hosting budget are not known.

## Risks and response

| ID | Priority / responsible role | Risk or gap | Response and decisive evidence |
| --- | --- | --- | --- |
| R1 | Critical / integrations | No confirmed pair of broadcasters | Start independent signed-fixture and domain testing immediately; user/creator liaison arranges live access. Genuine two-channel raid remains an unsatisfied gate. |
| R2 | Critical / integrations | Some attempted raids may not emit the documented notification | Live test actual settings and small raids. Fail closed, preserve source custody, explain retry. Never substitute animation or manual override as authentic proof. |
| R3 | Critical / backend | Duplicate, delayed or concurrent proof/accept creates inconsistent custody | Canonical inbound subscription, one pending source intent, proof consumption, bounded windows/cooldown, persistent channel locks, unique slots and crash/race tests. |
| R4 | High / product/game design | Poll-heavy interaction is shallow | Cooperative route puzzle plus public clue discovery, bounded allocation, consequential choices and branching season. Observe viewers solving constraints and explaining their contribution. |
| R5 | High / product | Raids happen on creators' schedules | Full solo season, optional handoffs at chapter boundaries, park/resume and no offline decay. A no-raid end-to-end acceptance test is mandatory. |
| R6 | High / design/creator experience | Incoming host does not understand or want the world | Opt-in/readiness, exact preview, explicit accept, short recap, visible cause and one immediate playable challenge. Measure comprehension in a real session. |
| R7 | High / security/integrations | Bot and broadcaster grants are confused or revoked | Separate setup flows, same-client validation, minimal scopes, hourly validation, serialized user refresh, visible connection health and disconnect tests. |
| R8 | High / platform | Database, app restart or backlog interrupts a live segment | Durable inbox/outbox/deadlines, idempotency, pause/recovery, small transactions, queue-age metrics, restore drill. No source-of-truth state in memory. |
| R9 | High / frontend/platform | SSE buffers or fails in deployed OBS setup | Run deployed streaming/OBS smoke before broad UI work. Switch projection transport to WebSocket if the gate fails; domain contract stays the same. |
| R10 | High / game design | Puzzle bonuses trivialize choices or branches become impossible unintentionally | Enumerate authored puzzle solutions/branches and affordability; bound rewards; test success/failure/solo paths. Some losses remain intentional, not deadlocks. |
| R11 | High / product/security | Incoming viewer identity or private clues assumed available | Raid payload lacks individual roster; ordinary chat is public. Use equal public participation. Later cohort/private-information features require separate identity design. |
| R12 | High / delivery | Official schedule pages disagree | Use an early internal cutoff, record discrepancies and verify organizer countdown near submission. Keep hosting available through the longest published judging window. |
| R13 | High / delivery | Feature expansion displaces submission or live proof | Core gate first; complete-season target next; choose extra features using observed progress. Protect recording/clean-setup time and keep a functioning candidate. |
| R14 | Medium / fairness | Bot accounts, brigading, repeated commands | Account-level uniqueness, cooldowns, bounded effects and creator commitment. Do not claim one-person-one-vote or perfect Sybil resistance. |
| R15 | Medium / security | Overlay URL or dashboard credentials leak on stream | Read-only revocable capability, fragment exchange, narrow sessions, secret redaction and rotation. Controls remain separately authenticated. |
| R16 | Medium / backend | Multi-world traffic starves control/handoff work | Separate work classes, bounded batches, ballot indexes, world isolation, mixed-load/queue-age tests; tune before adding another service. |
| R17 | Medium / product/research | Originality overstated | Bounded adjacent-product review, demonstrate continuity and real custody, avoid market-first claims; broaden prior-art review when evidence warrants it. |
| R18 | Medium / assets/owner | Concept images lack usage rights; product name/license unresolved | Commission/create original assets or record explicit licenses. Keep linked inspiration out of shipped assets. Branding and project licensing remain owner decisions before publication. |
| R19 | Medium / operations | Hosting cost, availability or persistence unsuitable | Provision only after budget/region/streaming/backup review. Avoid sleeping instances for the final demo; keep data outside the app filesystem. |
| R20 | Medium / privacy | Replay becomes an excuse to store raw chat and identities | Normalize commands, pseudonymize actors, public community attribution only, documented retention/deletion and sanitized evidence. |

Owner roles are placeholders for accountability, not assumed people. Live creator coordination and any external communication are not being performed by this planning task.

## Changes that resolve contradictions in the concept

- Chapter progression drives consequences; raid count does not. Communities may host multiple chapters or return later.
- Custody and active hosting are distinct. A parked world keeps its custodian while releasing a channel's active slot.
- A failure preserves a wreck/history. Rescue gameplay is a planned expansion, so the initial season does not promise recovery it cannot deliver.
- A visible vote is advisory. The creator's authorized commitment is the mutation; zero votes and ties do not block play.
- The shortage uses explicit predicates and multi-event provenance, avoiding inaccurate blame for an aggregate resource threshold.
- Investigation votes alone are insufficient gameplay depth. Shared constraint-solving is part of the complete target and is evaluated separately from spectacle.
- Two-stream raid footage proves the signature transfer; the full season and no-raid play prove the underlying product.

## Adjacent-product research

This is a bounded initial review, not an exhaustive novelty or trademark search.

| Product/pattern | Primary evidence | Implication for TORCHLINE |
| --- | --- | --- |
| Crowd Control | [Official features](https://crowdcontrol.live/features) describe viewer-triggered in-game effects | Audience influence and overlays are established; our differentiator must be portable world custody and traceable consequences, not commands alone. |
| Ravenfall | [Official how-to-play](https://www.ravenfall.stream/how-to-play) describes chat-driven characters and ongoing training | Persistent chat gameplay is established. Retaining progress alone cannot establish originality. |
| Native Twitch raids | [Official raids guide](https://dev.twitch.tv/docs/api/raids/) covers audience transitions | The signature is the separately authorized game-state handoff layered onto a genuine native raid. |
| Creator/community games and relay formats | Broader survey remains open | The initial search did not establish a direct match for the full combination. Absence in a bounded search is not evidence that no equivalent exists. |

Do not present Stream Raiders' current availability, any competitor's retention performance, or worldwide novelty as verified. No current primary evidence was established for those claims during this review.

## What remains externally dependent

The app owner's Twitch developer registration and bot authorization; two consenting broadcasters with suitable live raid settings; hosting account/budget and region; organizer deadline clarification if published discrepancies persist; asset permissions and project license; entrant eligibility and repository access for judging. Independent engine, custody simulation, schema and UI work can proceed after product review while live-test access is arranged.
