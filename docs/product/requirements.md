# Product requirements

Status: proposed for review. Owner roles below indicate responsibility, not staffing assignments. Updated 2026-10-26.

## Product thesis

A Twitch audience can help create a consequential game world that survives the broadcast and becomes playable by another creator's community. TORCHLINE turns creator collaboration into shared authorship: each community inherits obligations, makes bounded decisions, and leaves a history others can understand.

The full product is a network of persistent seasonal worlds, consenting hosts, audience interactions, attributable consequences, and repeatable creator collaborations. The first complete experience is The Ark Protocol, a five-chapter branching survival season. Prove the defining experience end to end, then continuously expand gameplay depth, design, reliability, and creator features before the deadline.

## Users and needs

| User | Need | Product response |
| --- | --- | --- |
| Creator starting a segment | Engaging content with little preparation | Twitch login, guided OBS setup, a ready-to-play crisis |
| Receiving creator | Understand the inherited world immediately | Brief recap, visible damage, unresolved obligations, explicit acceptance |
| Viewer on desktop or mobile | Participate without installing or signing into another app | Ordinary Twitch chat commands with clear feedback |
| Returning viewer | Discover what happened to their community's choices | World history and links between decisions and later effects |
| Creator handling disruption | Retain control and safely stop | Pause, close interactions, park, reconnect, decline incoming worlds |
| Operator or judge | Reproduce behavior and assess reliability | Labeled simulator, deterministic replay, setup guide, live evidence |

## Experience principles

- One crisis should be understandable in seconds; deeper history remains available on demand.
- Viewer investigation and allocation affect available information and resources; the creator makes the final consequential commitment.
- Choices produce visible state changes and future liabilities. New hosts inherit the same world identity and state.
- A small community or solo creator can complete a season. Audience size cannot manufacture extra resources.
- Consent is required at both ends. A normal Twitch raid never forces a world onto someone.
- Offline time preserves the world. No unattended resource drain or compulsory raid schedule.
- Gameplay and essential narration work without runtime generative AI.

## Requirements and acceptance

Priorities indicate dependency order: **Core** establishes the complete loop; **Complete** builds the intended first season and creator experience; **Expand** deepens the product as the gates pass. They do not preclude ambitious delivery.

| ID | Priority | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| PR-01 | Core | Twitch creator identity and explicit connection consent | Correct channel ID, scope validation, reconnect and disconnect handled |
| PR-02 | Core | Persistent world creation and custody | Reload and service restart preserve identity, resources, chapter and history |
| PR-03 | Core | Live chat participation | A real chat command changes an authorized interaction and reaches the overlay |
| PR-04 | Core | Complete decision cycle | Investigation/allocation where defined, bounded vote, creator commitment, saved result |
| PR-05 | Core | Native raid handoff with receiver consent | Two real channels; matching signed raid proof; one atomic custody change |
| PR-06 | Core | Attributable consequences | Receiver encounters an effect linked to the originating decision/community |
| PR-07 | Core | Creator control and OBS display | Dashboard operates privately; channel-bound read-only overlay follows its hosted world |
| PR-08 | Core | Safe failure behavior | Missing raid, declined request, busy target, duplicates and restart never lose or duplicate custody |
| PR-09 | Complete | Full five-chapter Ark season | Branches, affordable alternatives, conditional crises and all endings are playable |
| PR-10 | Complete | Meaningful audience depth | Cooperative repair/route puzzle, clue discovery, and bounded allocation alter available solutions; viewers solve constraints as well as vote |
| PR-11 | Complete | World lineage and reproducible replay | A saved log reproduces the canonical state; cause/effect links survive transfers |
| PR-12 | Complete | World library and independent worlds | A creator can park a world, retain access, and later resume; simultaneous worlds remain isolated |
| PR-13 | Complete | Guided onboarding and operational health | Connection/subscription state, OBS preview, recipient readiness and recovery shown clearly |
| PR-14 | Complete | Accessible broadcast design | Readable at 720p, text/icon status, reduced motion, keyboard-operable dashboard, no audio requirement |
| PR-15 | Complete | Runnable and testable submission | Clean setup, assets, environment documentation, public demonstration, live and simulated evidence |
| PR-16 | Expand | Collaboration tools | Opted-in recipient directory, world invitations/readiness, shareable history, multi-hop demonstration |
| PR-17 | Expand | Greater season depth | Additional authored crises, seeded route variants, allocation specializations and balancing reports |
| PR-18 | Expand | Recovery and replay presentation | Wreck salvage chapter and visual lineage playback if terminal persistence and replay are already sound |
| PR-19 | Expand | Delegated creator operations | Explicit application roles for helpers, narrow pause privileges, audited access |

## Product boundaries

The vision includes reusable seasons, creator networks, richer puzzles, asynchronous continuity, and eventually additional world formats. The current architecture supports those through content schemas and stable interfaces. A marketplace, paid influence, platform currency, native mobile client, 3D universe, runtime-generated rules, and automatic Twitch raid initiation are separate product investments. They have no demonstrated dependency on the defining experience and are not on the critical path.

Separate three modes: **live Twitch play**, **clearly labeled simulator/rehearsal**, and **read-only historical replay**. Simulation must never grant custody of a live world. A native Twitch raid is required for a live handoff; ordinary save/resume handles offline continuity with the existing custodian.

The game engine owns chapters, puzzles, resources, and consequences. A hosted episode attaches it to a creator's interaction surface. A separate custody service consumes verified transfer evidence. Neither chapter progression nor game difficulty may depend on a raid occurring. Future collaboration can add shared planning, scheduled relays, spectators and explicit cohost roles without replacing the authentic raid-transfer path. Any future non-raid custody policy requires a separately named mode and decision record.

## Success targets to measure

Targets are design goals, not achieved results:

- A new creator completes login, OBS setup, and a first playable crisis in five minutes excluding external account setup.
- A receiving creator can identify the inherited crisis and its cause within 15 seconds.
- A participant can explain the immediate cost and future consequence of the demonstrated choice.
- A viewer can describe a non-voting action that helped solve a shared problem, and a solo host can play the same puzzle without an audience-size gate.
- Each accepted command becomes visible within one second of server receipt at the initial load target; stream delay is separate.
- A receiver's acceptance produces one custody change and refreshed overlays within two seconds of database commit under the initial load target.
- All five chapters remain completable with one participant; zero-vote and tie paths remain playable.
- No custody or resource invariant fails in the planned duplicate, race and crash tests.

Track setup completion, unique participants, chapter completion, handoff attempts/accepts/failures by reason, consequence views, repeat hosting, and opt-in creator feedback. Do not claim retention or discovery impact before observation.

## Review decisions and external inputs

The technical recommendations are in the ADRs. The review should settle the first season's tone, visual direction, acceptable hosting spend before provisioning, branding/license choice before publication, and which extra features to pursue once the core gates pass. None requires assuming team capacity. Two consenting broadcasters and a real raid remain necessary to validate PR-05; the simulator reduces development dependence on their availability.
