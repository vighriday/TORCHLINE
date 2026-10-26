# Validation and stress-test plan

Status: initial domain, PostgreSQL, HTTP/Twitch-contract and browser tests have run locally. [Implementation status](implementation-status.md) and the changelog record exact evidence and limits. The full matrix below remains the wider acceptance plan; unexecuted load, soak, real Twitch and actual OBS checks must not be marked passed.

## Evidence layers

| Layer | Tool/approach | Establishes | Cannot establish |
| --- | --- | --- | --- |
| Domain | Vitest + seeded generated command sequences | Rules, puzzle constraints, replay, invariants without network | Twitch behavior, DB locks or OBS compatibility |
| Storage | Real PostgreSQL 17 with independent connections | Constraints, lock order, races, jobs and crash recovery | Genuine Twitch delivery |
| Adapter | Twitch CLI and signed fixtures | HMAC, schema/condition mapping, duplicates, revocation, proof policy | That Twitch will emit a specific real raid |
| Browser | Playwright with controlled backend | Dashboard, overlay, privacy, stale state and reconnect | Actual OBS embedded-browser performance |
| Deployed | Actual service + actual OBS | Streaming, sessions, headers, source lifecycle, frame/readability behavior | Creator adoption or raid completeness in every configuration |
| Live | Consenting broadcasters on Twitch | Genuine chat and native raid-to-custody continuity | Unlimited scale or platform-wide reliability |

## Mandatory scenario matrix

| Area | Cases to execute | Pass condition |
| --- | --- | --- |
| Solo experience | All chapters on one channel; no raids; zero viewers; one viewer; park overnight and resume | Complete playable season; no time-based loss; no raid gate |
| Gameplay | Every authored branch; unaffordable repairs; caps; oxygen/hull/passenger zero; partial ending | Exact authored costs, valid alternatives, intentional terminal outcomes, no stuck phase |
| Puzzle | Enumerate graph solutions; invalid/loop/oversized path; simultaneous solves; no solvers; solo scans | Correct constraints, at least one solution, one bounded reward, safe fallback |
| Participation | Spam same vote; change vote; malformed option; bot identity; source-channel mirror; ties/no votes | Latest eligible contribution counted once; no cross-channel control |
| Window ordering | Pre-window message; exact cutoff; accepted inbox work processed after close; pause/resume; clock drift | Receipt/window policy reproducible; close watermark drains accepted inputs; old window cannot leak into new one |
| Consequences | Due/avoided/superseded effects; multiple origins; handoff without chapter advance | Deterministic order and accurate causal attribution |
| Replay | Reference journey; alternate branches; saved log after several handoffs; old rules version | Canonical reconstructed state and interaction summary match saved values |
| OAuth | State mismatch, denied consent, wrong client/user, missing scope, revoke, token expiry, simultaneous refresh | No unauthorized session; one refresh path; sessions/interactions end on revocation |
| Webhook | Tampered whitespace/Unicode/body/header; malformed signature; old/future timestamp; valid challenge | Forgery rejected before parsing/action; valid challenge succeeds; no secret leakage |
| Duplicate proof | Same delivery repeated; duplicate after commit; second subscription representation | Single consumed intent and custody change; original result returned safely |
| Handoff races | Two sources claim same target; concurrent accepts; source cancel vs accept; target starts world | At most one target slot/winner; no deadlock escape corruption; loser gets safe conflict |
| Handoff denial | Wrong source/destination; no pending intent; expired; target opted out/busy/offline; no proof | Source retains custody; target's world unaffected; honest retry/decline UX |
| Crash recovery | Before inbox commit; after ack; before state commit; after commit before publish; during job claim | No acknowledged loss, double resolution or custody duplication; current snapshot recovered |
| UI and access | Viewer tries command route; overlay token tries accept; leaked/revoked read capability; CSRF/XSS | Mutation authorization holds; text safely rendered; read grants revocable |
| OBS | 1080p/720p, refresh, scene hide/show, network loss, reauthentication, reduced motion | Legible graph/status; current state returns; no repeated destructive animation |
| Multi-world | Busy world and quiet world run together; handoff into idle target while another game votes | No state/actor/slot leakage; quiet-world control remains responsive |
| Operations | Database outage, missing migration, deploy restart, rollback, restore backup | Readiness/alerts accurate; no false successful mutation; documented recovery |

## Load profiles and budgets

These are starting test profiles and targets, not asserted capacity. Record CPU, memory, connection pool, database size, p50/p95/p99 latencies, event-loop lag, inbox age, lock waits and feed queue lengths.

- Baseline: two active worlds, 100 concurrent participants total, 20 recognized commands/second for ten minutes, four browser/OBS feeds.
- Stress: ten active worlds, 1,000 participants, 250 recognized commands/second for five minutes, then a burst of 1,000 commands/second for ten seconds. Include duplicate/noise traffic, a puzzle solve and a handoff at burst peak.
- Large-community correctness: 10,000 unique ballots in one window; final counts, resource bounds and allocation normalization must remain correct even if latency targets fail.
- Soak: repeated chapters, park/resume, token validation, reconnects and work leases for at least one hour, with controlled restart and outage injection. Broaden duration only if evidence warrants it.

Initial budgets: durable webhook response p95 below two seconds; accepted command to visible projection p95 below one second excluding Twitch delivery/broadcast delay; custodian acceptance to projection p95 below two seconds after commit; no invariant violation; no growing unbounded queue. Tune the envelope based on measured results. Do not claim the stress profile is a supported production limit before it passes on a named environment.

Separate raw incoming chat from recognized gameplay commands when measuring throughput. Do not write a domain event or animate per ignored message. Coalesce tally output to five snapshots/second per world. Keep acknowledgement and custody control responsive during participation bursts. If a queue grows, show degraded interaction state rather than pretending commands are live.

## Live acceptance script

1. Two consenting creators connect; verify IDs, grants, readiness, bot subscriptions and overlay sessions without recording secrets.
2. Creator A plays a crisis using real chat; demonstrate a non-voting puzzle action and a saved consequential choice.
3. Record world ID/version/resources, unresolved effect and community attribution.
4. Prepare A-to-B intent; perform a native Twitch raid; capture the genuine signed event metadata.
5. B accepts; verify exactly one committed custody change, source authorization loss, target overlay assignment, unchanged inherited game values and history.
6. B plays the consequence and commits a new choice. Refresh both overlays and restart the app; verify persistence.
7. Exercise a rejected/expired intent separately. A missing raid must not create a transfer.

Simulator fixtures support every step except native proof. A demonstration must label simulated portions and retain actual Twitch footage for the signature path.

## Release gate and current evidence

Before release: all required core/complete requirements have acceptance evidence; live native transfer verified; complete solo season playable; no unresolved custody, data-loss, authorization or replay blocker; clean setup and judge access reproduced; assets/environment documentation complete. Additional features require their affected invariants and component review to be rerun.

Current evidence includes the working commands `pnpm build`, `pnpm test`, `pnpm test:browser`, `pnpm audit:balance` and `pnpm design:fixtures`. They establish the explicitly recorded local behavior. CI is defined but not yet executed remotely; real Twitch and OBS milestones remain separate.
