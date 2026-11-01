# The Ark Protocol: game design

Status as of 1 November 2026: `ark-v3` for new worlds; `ark-v2` kept for replay of existing worlds; `ark-v1` kept only as an executable audit fixture, not used for new worlds. The balance figures below are the historical `ark-v2` enumeration. This revised balancing contract was authorized for implementation on 2026-10-26. Numerical balance is checked by exhaustive authored-tree analysis; entertainment and difficulty require playtesting.

## Baseline defect and revision

`node scripts/audit-legacy.mjs` enumerates all 32 original authored decision paths with zero allocation and no challenge bonuses: 28 colonies, four partial endings, zero wrecks. Final minima are hull 55, oxygen 50 and passengers 162. The original non-damaging challenge bonuses cannot introduce catastrophe. Optional power allocation was not exhaustively enumerated; its resource and affordability effects are a separate policy, not evidence that the authored failure tree worked.

Version 2 introduces cumulative arrival damage, persistent leaks, expensive repairs, colony population viability, and landing damage dependent on inherited navigation. Challenge rewards directly change canonical resources and systems. No random death or hidden timer is introduced. All previewed damage and later hazards must be visible to active players and passive spectators.

## Season and world

A colony ship carries 216 passengers through five chapters. Each chapter can be hosted by the current creator or inherited after a verified raid. Delayed effects advance by **chapter**, not by handoff count or real elapsed time; one creator can play the entire season. Handoffs occur at chapter boundaries.

Initial state: passengers 216, hull 80, power 60, oxygen 65, navigation 70, supplies 50. Hull, power, oxygen and navigation use integer values from 0 to 100; passengers range from 0 to 216; supplies from 0 to 999. Every gain has an authored source and every spend checks affordability. No passive offline drain. Each world stores its immutable rules/content version. Seeded content variation is planned; the current season is fixed and needs no seed. A viable colony requires at least 120 passengers and 30 supplies; survivors below either threshold receive the partial-survival ending.

## Chapter loop

Existing ark-v2 worlds retain `ready -> challenge -> decision -> ready` with manual timing. New ark-v3 worlds implement optional investigation, shared challenge, optional allocation, advisory voting and awaiting-commit, plus paused/ended states. Arrival applies atomically on start. [ADR 0013](../decisions/0013-versioned-cooperation.md) defines immutable cooperation rules and [ADR 0014](../decisions/0014-durable-episode-policy.md) defines persisted timing/recovery outside the engine.

`READY -> ARRIVAL -> INVESTIGATION -> CHALLENGE -> ALLOCATION -> VOTING -> AWAITING_COMMIT -> RESOLVED -> READY`

Phases without configured interactions are skipped. Arrival applies due consequences in stable order before selecting the crisis. The current explicit defaults are 30 seconds investigation, 90 challenge, 45 allocation and 60 voting. Captains may use manual windows or configure each duration to 15–1800 seconds at a ready boundary. Deadline closure freezes participation, never selects a story decision. A restart/park/disconnect/offline pause preserves progress; explicit captain resume is required.

Pause stores the prior phase and remaining time. Resume creates a new participation window; messages sent during the pause or an old window are rejected. Vote totals already accepted stay visible. A parked world is persistent and inactive; resuming it requires the same custodian and an empty active channel slot.

## Audience and creator authority

Current commands are `!scan`, `!route`, `!patch`, `!vote`, `!inspect engine|cargo|life`, and `!allocate H O` (1–5 preference points total). `!status` and `!history` bot replies are implemented and accepted by Twitch's API, but paused in the live configuration; visible delivery unverified. New phases require an ark-v3 world; existing worlds keep their original rules. These commands have signed-provider-fixture coverage. Status as of 1 November 2026: on 30 October 2026 three genuine viewer chat messages from an ordinary viewer account arrived as signed `channel.chat.message` notifications and were saved as `scan` gameplay events on a live Ark. An overlay update from live chat has not been recorded on video, and the other gameplay commands have signed-fixture evidence only.

| Interaction | Rule | Effect |
| --- | --- | --- |
| `!inspect engine`, `!inspect cargo`, `!inspect life` | Latest eligible selection per account during investigation | Top selection reveals one authored clue at close; a tie uses content-defined order; one participant is sufficient |
| `!scan A`, `!route S A C T` | Bounded node discovery and candidate path submission during a challenge | Reveals puzzle constraints and tests an actual solution; first valid solution locks one authored reward |
| `!allocate hull 3 oxygen 2` or `!allocate 3 2` | Latest valid preference per account; total preference units one to five | Distributes a creator-declared power budget across repairs using normalized preferences |
| `!vote 1`, `!vote 2` | Latest eligible vote per Twitch user ID in the current decision | Advisory tally; repeat messages never add voting weight |
| `!status`, `!history` | Coalesced channel response with cooldown | Concise status or the last two captain decisions with their communities; never one reply per message. Implemented and accepted by Twitch's API, but paused in the live configuration; visible delivery unverified |
| Creator commit | Authenticated custodian; valid phase, state version and affordable option | Applies the selected option, allocation, and future obligations once |

Viewer eligibility means an identified account sending an allowed command in the active host's chat during the current phase window. It does not prove physical viewership or one human per account. Use ordinary viewer privileges without subscriber/follower weighting. Exclude the application's bot. Accept the broadcaster's account at normal weight if it participates.

For allocation, the creator earmarks an optional integer budget `B <= min(10, available power)` before the window opens, initially zero. Sum each account's latest preferences, normalize to B, floor each share, then distribute remaining units by descending fractional remainder (hull wins ties). If no preferences arrive, allocate zero. Spending one power repairs one hull point or two oxygen points, up to the resource cap; spend only units that produce an effect. Reserve the maximum budget when evaluating crisis affordability; apply allocation and the creator's chosen option together at commitment. The creator sees exact costs. A closed plan cannot be edited during voting; reopening/reconfiguration during a decision is a future explicit command, not currently available. Reserves reset each chapter. This provides meaningful bounded participation without scaling repairs with audience size.

Within a commitment, apply the chosen option first, then calculate/apply the allocated repairs against that resulting state, record new obligations, and evaluate terminal conditions on the combined result. This allows a declared repair allocation to offset damage within the same commitment, without reviving a world already terminal before it began. The exact combined preview is shown before confirmation. Arrival/environmental effects are separate transitions and evaluate terminal state before opening interactions.

Voting does not automatically commit. With zero votes or a tie, the creator selects any legal option. An override of the leading vote is visible in history. Costs and known effects remain visible before confirmation. A clue can expose a future condition, but concealing numerical costs is not part of the initial design.

## Gameplay depth: cooperative route repair

Polls and resource meters alone do not provide enough sustained audience agency. The complete-season target includes a shared graph puzzle displayed on the overlay. Six to eight authored nodes represent relays or salvage stations. Viewers scan nodes to reveal constraints, discuss the route, and submit paths. A valid path must connect the endpoints, avoid blocked relays, stay within a power/risk budget, and satisfy a required waypoint. The reducer evaluates those constraints; it does not compare popularity or ask an LLM to judge an answer.

Parallel clue discovery lets several viewers contribute distinct information. One viewer can scan every node sequentially, and the creator can use the same dashboard controls when alone. Revealed clues are public. There is no claim of private or origin-specific information. Candidate paths have bounded length and a cap on displayed failures. Chat input passes a per-viewer admission rate limit (by default a burst of six that refills at one per second: `INPUT_VIEWER_BURST`, `INPUT_VIEWER_PER_SECOND`); no route-specific cooldown exists. Correct solutions close the challenge once; further submissions cannot farm rewards.

Route completion has chapter-specific mechanical rewards. Chapter 1 restores shield routing (+15 hull and +10 recovered capacitor power), preventing blind-jump damage in chapter 2 and reducing debris damage in chapter 4. Chapter 2 jury-rigs navigation (+20 navigation) and reduces the cost of charting the route. Chapter 4 unlocks precision salvage (five hull damage and no oxygen loss instead of fifteen hull and ten oxygen). Chapter 5 aligns landing beacons (+15 navigation and +5 hull). Each reward is applied once and updates persistent physical condition.

Chapter 3 uses a cooperative repair work order. Viewers scan the damaged nodes, then patch A and B in either order; C requires both. A restores four oxygen, B repairs four hull, and C recovers five power and restores another ten oxygen. Completing the work order physically repairs life support, prevents the chapter-4 leak, and reduces the final repair choice from twenty to ten power. Each task is globally claimable once, not once per account; replaying/spamming a command cannot farm resources. One person can complete the same work order, and the broadcaster can participate through the same domain commands.

The captain can close a challenge early or use the persisted deadline/manual policy. Investigation and allocation are implemented for new ark-v3 worlds. Route submissions are bounded by the per-viewer admission rate limit above, not by a route-specific cooldown. Failure/skip preserves ordinary choices rather than forcing an arbitrary death.

Author each graph with at least one verified solution. Generate variation only from checked, seeded configurations. Persist clues, accepted candidate order, solver attribution and outcome for replay. Default challenge time is 90 seconds, adjustable or pausable by the creator; no reflex-speed gameplay depends on broadcast latency. The reference journey below assumes no challenge bonus. Full-season playtests must assess whether the puzzles produce collaboration, whether people understand submissions on mobile, and whether the strategic choices remain consequential after bonuses.

## Complete authored chapter set

| Chapter | Crisis and branching | Decisions and future effects |
| --- | --- | --- |
| 1: Radiation Storm | Arrival costs ten hull; route challenge restores shield routing | Burn navigation: navigation becomes zero, spend ten power and five hull, preserve passengers. Seal habitat: lose 48 passengers, ten hull and five oxygen; keep navigation. Both leave physical scars. |
| 2: Blind Jump / Safe Corridor | Crisis is fixed at arrival from inherited navigation; unshielded blind arrival costs ten hull | Blind: chart route costs 25 supplies (20 with survey solved) and 15 power, restoring navigation to 60; manual flight loses 25 hull (ten if survey solved) and ten oxygen. Safe corridor: salvage gains 15 supplies and costs 15 hull/five power; bypass costs five power. Survey completion jury-rigs navigation by 20. |
| 3: Life Support Rupture | Arrival costs ten hull and 25 oxygen, damaging life support | Repair: spend twenty power (ten after full cooperative work order) and gain 25 oxygen, restoring life support. Seal cabins: lose 60 passengers and gain five oxygen, leaving damaged life support leaking unless viewers already repaired it. |
| 4: The Colony Debt | Debris costs ten hull (five with repaired shields); damaged life support leaks fifteen oxygen | Salvage: gain thirty supplies, lose fifteen hull/ten oxygen, or five hull/no oxygen with precision route solved. Jettison cargo: spend fifteen supplies, gain fifteen hull, lose five oxygen, leaving a cargo scar. Supply shortage is visibly attributed below thirty crates. |
| 5: Atmospheric Entry | Arrival consumes fifteen oxygen; beacon challenge improves hull/navigation | Standard landing loses ten hull with navigation at least forty, otherwise 25; spend up to ten remaining supplies on landing. Emergency burn requires fifteen power, loses three hull with sufficient navigation or ten otherwise, and spends up to fifteen supplies. The exact projected ending is visible before commitment. |

Hull losses clamp to zero and can end the season. Spending choices are disabled when unaffordable. No-cost alternatives exist but are not guaranteed to save a critically damaged world. Environmental changes and consequences use explicit ordering; a terminal world cannot continue by choosing an option after death.

Reference path without challenge rewards: burn navigation, chart route, repair life support, salvage, standard landing. Final state is passengers 216, hull ten, power fifteen, oxygen forty, navigation sixty, supplies 45: colony, but with little structural margin. Burn/manual/repair/salvage can wreck the Ark in chapter 4. Burn/manual/seal/jettison exhausts oxygen on atmospheric arrival; a viewer completing just repair A changes that same journey to survival if the host then uses emergency braking. Sealing habitat and cabins can leave fewer than 120 passengers even with adequate supplies.

The historical ark-v2 analyzer covers **2,398 terminal branches: 964 colonies, 1,304 partial survivals and 130 wrecks**. Wrecks include 86 hull failures and 44 oxygen failures. It enumerates every authored choice, route success/skip and five valid repair subsets; equivalent scan orders/routes are collapsed. These are branch counts, not player probabilities or a playtest. Timed phases and allocation are outside this version-specific enumeration. Separate v3 tests exhaust allocation normalization and cover combined costs, caps, overkill, replay and all-ending reachability; they do not claim exhaustive enumeration of every multi-chapter allocation trajectory. [Machine-readable v2 report](../reports/balance-ark-v2.json)

## Consequences and lineage

Implemented obligations have a stable ID, originating event ID, kind, due chapter and `pending`, `applied` or `avoided` status. The originating event supplies source chapter/community; authored predicates and effects live in immutable rules. The full-product contract adds explicit supersession where one consequence replaces another. An avoided shortage is meaningful history, not a silently deleted debt.

Avoid charging the same damage twice: destroyed navigation is the current state and the source of a future crisis; it is not another automatic navigation penalty. Show the cause chain from navigation sacrifice to repair expenditure to the later supply check. If several spends contributed to a threshold, list them rather than attributing the entire shortage to one creator.

## Endings and continuity

- **Colony established:** five chapters completed, at least 120 passengers, hull and oxygen above zero, and at least 30 supplies.
- **Partial survival:** five chapters completed with passengers/hull/oxygen above zero, but below the passenger or supply viability threshold.
- **Wreck:** hull, oxygen or passengers reaches zero before a viable landing. Preserve the final state and history; do not reset the same world.

Power or navigation at zero imposes explicit crisis constraints, not an undocumented instant loss. A new world is a new identity. A salvage/rescue chapter is a planned expansion of wreck continuity, not required to make terminal persistence honest.

## Presentation and growth

The overlay prioritizes the ship, current crisis, two clear decisions, phase timer, participation totals and inherited consequence. Keep all six resources available but emphasize the two or three relevant to the current choice. Use text/icons with color; animations should read without sound. The receiving overlay includes a short community recap and visibly retains damage.

The owner-supplied Figma v2 design provides the final UI/UX, animation and art direction ([ADR 0033](../decisions/0033-figma-v2-presentation.md)). The implementation supplies the semantic presentation contract, engine-derived fixtures and replaceable Ark/challenge renderer interfaces it consumes. Do not embed visual interpretation in game rules.

Each physical system persists integrity, condition, accumulated scars and last-change provenance. Hull integrity, oxygen reserves and life-support condition are distinct: a temporarily replenished oxygen tank does not repair a leaking system. Sacrificed navigation, sealed habitats, restored shields and jettisoned cargo remain visible across chapters, save/reload and custody changes. A repair changes the current condition while retaining the scar history. See [frontend contracts](../architecture/frontend-contracts.md).

Expand with authored mission variants, seeded crisis decks, specialization through allocation, multi-hop consequences, rescue episodes and a visual history timeline. Private per-viewer clues and verified incoming-viewer roles need a separate identity/interaction design: Twitch chat is public and raid notifications do not identify individual raiders. Do not imply either capability in the initial season.
