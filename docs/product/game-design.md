# The Ark Protocol: game design

Status: proposed content and balancing contract, version `ark-v1`. Numerical examples are design fixtures, not measured playtest results. Updated 2026-10-26.

## Season and world

A colony ship carries 216 passengers through five chapters. Each chapter can be hosted by the current creator or inherited after a verified raid. Delayed effects advance by **chapter**, not by handoff count or real elapsed time; one creator can play the entire season. Handoffs occur at chapter boundaries.

Initial state: passengers 216, hull 80, power 60, oxygen 65, navigation 70, supplies 50. Hull, power, oxygen and navigation use integer values from 0 to 100; passengers range from 0 to 216; supplies from 0 to 999. Every gain has an authored source and every spend checks affordability. No passive offline drain. Each world stores its immutable rules/content version and seed.

## Chapter loop

`READY -> ARRIVAL -> INVESTIGATION -> CHALLENGE -> ALLOCATION -> VOTING -> AWAITING_COMMIT -> RESOLVED -> READY`

Phases without configured interactions are explicitly skipped and logged. Arrival applies due consequences in stable order before selecting the crisis. Suggested presentation durations are 20 seconds for arrival, up to 60 seconds each for investigation/allocation and voting, followed by creator commitment. These are adjustable defaults. There is no forced decision if a creator steps away.

Pause stores the prior phase and remaining time. Resume creates a new participation window; messages sent during the pause or an old window are rejected. Vote totals already accepted stay visible. A parked world is persistent and inactive; resuming it requires the same custodian and an empty active channel slot.

## Audience and creator authority

| Interaction | Rule | Effect |
| --- | --- | --- |
| `!inspect engine`, `!inspect cargo`, `!inspect life` | Latest eligible selection per account during investigation | Top selection reveals one authored clue at close; a tie uses content-defined order; one participant is sufficient |
| `!scan A`, `!route S A C T` | Bounded node discovery and candidate path submission during a challenge | Reveals puzzle constraints and tests an actual solution; first valid solution locks one authored reward |
| `!allocate hull 3 oxygen 2` | Latest valid preference per account; total preference units at most five | Distributes a creator-declared power budget across repairs using normalized preferences |
| `!vote 1`, `!vote 2` | Latest eligible vote per Twitch user ID in the current decision | Advisory tally; repeat messages never add voting weight |
| `!status`, `!history` | Coalesced channel response with cooldown | Concise status or a read-only history link; never one reply per message |
| Creator commit | Authenticated custodian; valid phase, state version and affordable option | Applies the selected option, allocation, and future obligations once |

Viewer eligibility means an identified account sending an allowed command in the active host's chat during the current phase window. It does not prove physical viewership or one human per account. Use ordinary viewer privileges without subscriber/follower weighting. Exclude the application's bot. Accept the broadcaster's account at normal weight if it participates.

For allocation, the creator earmarks an optional integer budget `B <= min(10, available power)` before the window opens. Sum each account's latest preferences, normalize to B, floor each share, then distribute remaining units by descending fractional remainder with a content-defined tie order. If no preferences arrive, allocate zero. Spending one power repairs one hull point or two oxygen points, up to the resource cap; spend only units that produce an effect. Reserve the maximum budget when evaluating crisis affordability; apply allocation and the creator's chosen option together at commitment. The creator sees exact costs and may reduce the budget only by reopening the allocation window. This provides meaningful bounded participation without scaling repairs with audience size.

Within a commitment, apply the chosen option first, then calculate/apply the allocated repairs against that resulting state, record new obligations, and evaluate terminal conditions on the combined result. This allows a declared repair allocation to offset damage within the same commitment, without reviving a world already terminal before it began. The exact combined preview is shown before confirmation. Arrival/environmental effects are separate transitions and evaluate terminal state before opening interactions.

Voting does not automatically commit. With zero votes or a tie, the creator selects any legal option. An override of the leading vote is visible in history. Costs and known effects remain visible before confirmation. A clue can expose a future condition, but concealing numerical costs is not part of the initial design.

## Gameplay depth: cooperative route repair

Polls and resource meters alone do not provide enough sustained audience agency. The complete-season target includes a shared graph puzzle displayed on the overlay. Six to eight authored nodes represent relays or salvage stations. Viewers scan nodes to reveal constraints, discuss the route, and submit paths. A valid path must connect the endpoints, avoid blocked relays, stay within a power/risk budget, and satisfy a required waypoint. The reducer evaluates those constraints; it does not compare popularity or ask an LLM to judge an answer.

Parallel clue discovery lets several viewers contribute distinct information. One viewer can scan every node sequentially, and the creator can use the same dashboard controls when alone. Revealed clues are public. There is no claim of private or origin-specific information. Candidate paths have bounded length, per-account cooldowns and a cap on displayed failures. Correct solutions close the challenge once; further submissions cannot farm rewards.

In chapter 3, a solved bypass circuit unlocks a repair costing 10 power instead of 15. Failure or timeout preserves the ordinary repair and cabin-sealing choices. In chapter 4, a route-planning variant can reveal a lower-risk salvage path; the ordinary salvage action remains available. These are two applications of one validated puzzle template, not claims of two independently implemented game engines.

Author each graph with at least one verified solution. Generate variation only from checked, seeded configurations. Persist clues, accepted candidate order, solver attribution and outcome for replay. Default challenge time is 90 seconds, adjustable or pausable by the creator; no reflex-speed gameplay depends on broadcast latency. The reference journey below assumes no challenge bonus. Full-season playtests must assess whether the puzzles produce collaboration, whether people understand submissions on mobile, and whether the strategic choices remain consequential after bonuses.

## Complete authored chapter set

| Chapter | Crisis and branching | Decisions and future effects |
| --- | --- | --- |
| 1: Radiation Storm | Choose what the emergency shields consume | Burn navigation: navigation becomes 0, passengers preserved, create chapter-2 blind-jump obligation. Seal rear bay: lose up to 30 passengers, navigation preserved, record the loss for the next community's recap. |
| 2: Blind Jump / Safe Corridor | If navigation is 0, inherit the blind-jump crisis; otherwise encounter a supply opportunity | Blind jump: spend 30 supplies and 15 power to set navigation to 60, or manual flight loses 25 hull. Safe corridor: collect 10 supplies from a derelict at a cost of 10 hull, or pass safely with no resource change. Register a chapter-4 supply check with the resource-spend provenance. |
| 3: Life Support Rupture | Arrival reduces oxygen by 25; terminal checks run immediately | Spend 15 power to set oxygen to at least 60, or seal affected cabins: lose up to 24 passengers and restore oxygen to at least 50. Optional bounded repair allocation and a clue about colony supply requirements deepen audience participation. |
| 4: The Colony Debt | If supplies remain below 25, activate the conditional shortage; otherwise offer optional preparation | Salvage station: gain 20 supplies, lose 10 hull. Conserve: no change, with colony risk clearly shown. If supplies are already sufficient, reinforce hull by 10 at a cost of 10 supplies, or conserve. |
| 5: Arrival | Final state determines viable landing options | Standard landing costs no further resources. Optional emergency burn spends 10 power to restore 5 hull before landing if the world is still viable. Resolve the ending and show each contributing community. |

Hull losses clamp to zero and can end the season. Spending choices are disabled when unaffordable. No-cost alternatives exist but are not guaranteed to save a critically damaged world. Environmental changes and consequences use explicit ordering; a terminal world cannot continue by choosing an option after death.

The reference path with allocation budget zero yields: chapter 1 navigation 0; chapter 2 repair leaves supplies 20 and power 45; chapter 3 repair leaves oxygen 60 and power 30; chapter 4 salvage leaves supplies 40 and hull 70; chapter 5 establishes a colony with 216 passengers. This is the first deterministic content fixture. Other branches must also be tested, including repair unaffordability and terminal outcomes.

## Consequences and lineage

An obligation has a stable ID, originating event ID, source chapter/community, due chapter, authored predicate, effect type and status. On arrival, evaluate due obligations by `(dueChapter, consequenceId)` using the predeclared content version. Record `applied`, `avoided`, or `superseded` explicitly. An avoided shortage is meaningful history, not a silently deleted debt.

Avoid charging the same damage twice: destroyed navigation is the current state and the source of a future crisis; it is not another automatic navigation penalty. Show the cause chain from navigation sacrifice to repair expenditure to the later supply check. If several spends contributed to a threshold, list them rather than attributing the entire shortage to one creator.

## Endings and continuity

- **Colony established:** five chapters completed, at least one passenger, hull and oxygen above zero, and at least 30 supplies.
- **Partial survival:** five chapters completed with passengers/hull/oxygen above zero but fewer than 30 supplies.
- **Wreck:** hull, oxygen or passengers reaches zero before a viable landing. Preserve the final state and history; do not reset the same world.

Power or navigation at zero imposes explicit crisis constraints, not an undocumented instant loss. A new world is a new identity. A salvage/rescue chapter is a planned expansion of wreck continuity, not required to make terminal persistence honest.

## Presentation and growth

The overlay prioritizes the ship, current crisis, two clear decisions, phase timer, participation totals and inherited consequence. Keep all six resources available but emphasize the two or three relevant to the current choice. Use text/icons with color; animations should read without sound. The receiving overlay includes a short community recap and visibly retains damage.

Build original SVG/CSS ship systems and readable React UI first; add Canvas particles or richer rendering when profiling and art direction justify them. Avoid making the cinematic handoff a substitute for actual committed state.

Expand with authored mission variants, seeded crisis decks, specialization through allocation, multi-hop consequences, rescue episodes and a visual history timeline. Private per-viewer clues and verified incoming-viewer roles need a separate identity/interaction design: Twitch chat is public and raid notifications do not identify individual raiders. Do not imply either capability in the initial season.
