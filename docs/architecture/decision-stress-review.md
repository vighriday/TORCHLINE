# Architecture decision stress review

Status: design analysis completed and initial components implemented on 2026-10-26. Domain, real PostgreSQL, HTTP/Twitch-contract and browser checks now exist; **load/soak benchmarks and genuine Twitch/OBS verification have not run**. [Implementation status](../planning/implementation-status.md) names the evidence and limits.

Implementation findings: JSONB property ordering required order-insensitive replay verification; PostgreSQL intent timestamps required millisecond precision to match application timestamps; UI consensus controls required asynchronous feedback; open SSE connections required explicit shutdown. The first slice uses application revisions separate from game-event sequences, canonical physical state and engine-derived Claude Design fixtures. It serializes recognized input under world locks rather than claiming the planned finer phase/ballot throughput.

The matrices below cover every proposed decision against every named component. A cell records the relevant constraint or boundary, not an unmeasured pass score. Alternatives are evaluated against the same product needs. During implementation, replace assumptions with test evidence in the validation plan and revisit any failing decision.

## Component inventory

[ADR 0024](../decisions/0024-preview-connection-recovery.md) reviews JSON response handling, initial connection and read-only feed recovery across C1–C13. Real preview interstitial reproduction is separate from local synthetic response-loss and genuine native Twitch acceptance.

[ADR 0023](../decisions/0023-cinematic-startup.md) checks explicit loading/cinematic/fallback states across C1–C13. First-frame and layout checks do not establish native OBS acceptance; graphics readiness never grants authority or advances a phase.

[ADR 0022](../decisions/0022-encounter-presentation.md) checks the owner-requested encounter presentation, projected ship inspection and chat onboarding against all C1–C13. Local pixels/real-engine/browser checks are distinct from native chat/OBS/raid and owner visual acceptance. [ADR 0021](../decisions/0021-current-static-assets.md) separately reviews current public asset delivery and route authority.

The [October 28 release authority review](../reviews/2026-10-28-release-authority.md) covers every current public route family, operational verification capability and C1–C13. ADRs 0018–0020 add encrypted recovery, runtime boundaries and reproducible packaging. Executed image/SQL/browser evidence is separate from the pending live acceptance session.

[ADR 0017](../decisions/0017-bounded-input-and-history.md) checks persisted input limits, channel fairness, indexed history and temporary overlay expiry against C1–C13. Real PostgreSQL regressions establish bounded admission/query behavior; deployed soak and native participation remain separate gates.

[ADR 0014](../decisions/0014-durable-episode-policy.md) checks persisted clocks, restart/park/offline recovery, window cutoffs, worker fencing and scoped retry against C1–C13. SQL/provider-fixture/browser evidence remains distinct from native Twitch and OBS acceptance.

[ADR 0013](../decisions/0013-versioned-cooperation.md) checks versioned investigation, allocation and vote freezing against C1–C13. Its executed evidence covers pure rules; runtime rollout and persisted episode timing have separate integration gates.

[ADR 0012](../decisions/0012-scoped-world-records.md) records the C1–C13 review for complete history and temporary offer previews. Six executed PostgreSQL/API regressions and the extended preview-to-accept browser journey cover the stated read boundaries; no genuine native raid evidence is implied.

The [2026-10-27 design integration review](../design/integration-review.md) checks the Claude Design adaptation and optional cinematic renderer against all C1–C13. [ADR 0011](../decisions/0011-claude-design-integration.md) revises D4 while retaining SVG/DOM information and interaction. Its design constraints are separate from executed browser and OBS evidence.

| ID | Component | Critical workload or invariant |
| --- | --- | --- |
| C1 | Identity/consent | Two OAuth identities, secret lifecycle, creator authorization |
| C2 | Twitch gateway | Signed raw bytes, challenge, revocation, retries, subscriptions |
| C3 | Participation | Bursty chat, bounded parser, unique actors, phase cutoffs |
| C4 | Engine/content/puzzles | Complete solo season, solvable constraints, deterministic state |
| C5 | Episode controller | Deadlines, pause, park/resume, no raid dependency |
| C6 | Custody coordinator | Source intent, native proof, receiver consent, atomic transfer |
| C7 | Database/work | Constraints, inbox/outbox, timers, retention, crash recovery |
| C8 | Live projection | Current snapshots, bounded fan-out, reconnect and assignment updates |
| C9 | Creator dashboard | Low-friction onboarding, controls, readiness, stale-action handling |
| C10 | OBS overlay | Read-only access, embedded browser, clear ship and puzzle state |
| C11 | History/replay | Cause attribution, immutable content versions, reproducibility |
| C12 | Simulator/validation | Live/test isolation, adversarial ordering, real database races |
| C13 | Hosting/operations | TLS ingress, durable process, logs, backups, judging availability |

## Decision inventory and strongest challenge

| ID | Decision | Strongest alternative | Why the recommendation fits TORCHLINE; where it can fail |
| --- | --- | --- | --- |
| D1 | TypeScript on Node 24 | Go backend | Shared command/content types avoid cross-language drift. Node's event loop can stall on heavy replay: measure it and move large reconstruction to a worker before it affects ingress. |
| D2 | Fastify modular monolith | Next.js full stack or independent services | A single transaction boundary and durable host directly fit custody. Raw-body parsing, streaming and worker isolation need explicit integration tests; framework defaults are not enough. |
| D3 | React/Vite browser | Next.js or plain DOM | Shared dashboard/overlay/puzzle components with no SSR dependency. Avoid rendering every message or importing server secrets into shared bundles. |
| D4 | SVG/DOM first, Canvas effects later | PixiJS or Phaser first | Small graphs and damageable ship systems benefit from inspectable, accessible elements. Hundreds of animated objects could require Canvas; profile on OBS before changing the renderer. |
| D5 | SSE reads, HTTP writes | WebSocket | Browser traffic is one-way; chat is the gameplay input. A proxy buffering streams, HTTP connection caps or unreliable OBS cookie behavior can invalidate this choice. Test deployed before committing UI transport assumptions. |
| D6 | EventSub webhooks/cloud bot with a bounded native fetch/crypto adapter | Per-creator WebSocket; Twurple SDK within the adapter | Durable hosted ingress and one canonical recipient subscription fit continuity. Direct calls keep DB grant locking/ingress ownership explicit; Twurple reduces SDK maintenance but needs durable refresh/subscription hooks. Requires TLS and two consents; neither account flow nor SDK integration is proven yet. |
| D7 | PostgreSQL 17 | SQLite or managed document store | Atomic two-channel custody and unique active slots are relational problems. Busy ballot writes and long event logs can overload the same database if not bounded and indexed. |
| D8 | `pg` + explicit SQL migrations | Drizzle or Prisma | Locks, claims and partial indexes remain visible; an ORM would still need custom SQL. Manual mapping and migrations need schema tests and row validation. |
| D9 | Zod boundary contracts | JSON Schema only | Runtime validation plus shared inferred types support adapters and simulator. Schema parsing must follow HMAC, and unknown additive Twitch fields should not break compatible messages. |
| D10 | Database-backed jobs/inbox/outbox | Redis/BullMQ or managed queue | Reuses the custody database and atomic commit. Claiming work is not world-ordering; use per-world serialization and explicit accepted sequence. Move only when backlog/latency evidence requires it. |
| D11 | Vitest + real PostgreSQL + Playwright + Twitch CLI | One broad E2E suite | Each tool establishes a different boundary. Mocks cannot prove locks or Twitch behavior, and Chromium tests cannot prove actual OBS behavior. |
| D12 | pnpm workspace, small package graph | Single flat project or Nx/Turborepo | Engine and contracts can be reused without Twitch/server dependencies. Guard package imports; a monorepo alone does not enforce isolation. |
| D13 | Always-on Render service + managed DB | Railway/Fly/VM or serverless | Public callbacks, persistent work and a single deploy are a practical fit. Availability, region, backup retention, budget and SSE behavior remain provisioning gates, not presumed facts. |
| D14 | No required runtime LLM | Model-generated crises/puzzle judging | Authored outcomes preserve fairness and replay. Future narration must consume public event projections and fall back to templates. Codex development evidence is independently recorded. |
| D15 | Separate game, episode and custody | Raid-driven game loop | Solo play and broader collaboration remain viable. Enforce import/command boundaries so a Twitch integration failure cannot freeze ordinary local engine progression. |
| D16 | Snapshot plus canonical event history | Full generic event-sourcing framework or snapshots only | Fast overlay reads plus reproducibility without rebuilding every projection. Event versioning, replay and transactional dual writes need invariant tests. |
| D17 | Server sessions + scoped overlay capability + explicit grants | Browser tokens, shared admin link or broad moderator scopes | Protects live controls and OBS usability. Capability leaks are still read leaks; support revocation, path scoping, redaction and real OBS reauthentication tests. |

## Cross-component matrix: identity to engine

| Decision | C1 Identity | C2 Gateway | C3 Participation | C4 Engine/puzzles |
| --- | --- | --- | --- | --- |
| D1 | Server crypto APIs | Byte-safe buffers | Shared typed grammar | Pure integer transitions |
| D2 | Session plugin boundary | Route-scoped raw parser | Bounded HTTP ingress | No framework imports |
| D3 | No tokens in bundle | No webhook access | Sanitized tallies only | Presentation types only |
| D4 | No auth rendering | No event parsing | Aggregate visual feedback | Graph representation, no authority |
| D5 | Same-origin session | Separate Twitch transport | Chat input stays server-side | Feed never mutates state |
| D6 | Bot + creator grants | Signed callback lifecycle | Native chatter IDs | Twitch-neutral commands |
| D7 | Encrypted grant records | Unique delivery IDs | Ballot/action indexes | Versioned snapshot JSONB |
| D8 | Parameterized secrets query | Durable ingress insert | Atomic upsert | Explicit transaction adapter |
| D9 | Validate state/scopes | Validate after HMAC | Reject malformed commands | Versioned content schemas |
| D10 | Serialize token refresh | Ack after durable insert | Leased command processing | No job logic inside reducer |
| D11 | Denied/revoked grants | Raw-byte tamper fixtures | Bursts/duplicates/cutoffs | Branch and puzzle enumeration |
| D12 | Server-only package | Adapter package | Contracts package | Zero I/O dependency |
| D13 | Secret environment | TLS reachability | Capacity/latency measures | CPU-budget gate |
| D14 | No model credential need | No model in callback | Untrusted chat is data | No generated rules |
| D15 | Consent independent of play | Adapter only | Generic actor/actions | Full season without raid |
| D16 | No credentials in events | IDs link provenance | Stable accepted sequence | Event fold equals snapshot |
| D17 | Secure cookie + CSRF | HMAC not browser auth | Never trust browser actor ID | Only authorized commands |

## Cross-component matrix: episodes to live state

| Decision | C5 Episodes | C6 Custody | C7 Database/work | C8 Live projection |
| --- | --- | --- | --- | --- |
| D1 | Inject clock externally | No async reducer | Pool bound, same-client tx | Event-loop lag budget |
| D2 | In-process reconciler | One atomic service | Durable state outside process | Streaming route lifecycle |
| D3 | Server timers authoritative | Server checks every accept | No DB import in browser | One shared client feed model |
| D4 | Local timer visuals only | Animate after commit | No effect persistence | Coalesced transitions |
| D5 | HTTP commands | HTTP idempotent accept | Read snapshot on reconnect | Heartbeat/buffering tests |
| D6 | Offline is advisory pause | Raid is evidence only | Subscription reconciliation | Adapter health surfaced |
| D7 | Persist deadlines | Lock both channel rows | Unique slots and proof use | Transactional publish intent |
| D8 | SQL close-once marker | Visible lock order | Ordered migrations/claims | Projection query indexes |
| D9 | Phase and window contract | Intent/proof schema | Validate stored versions | Explicit sanitized envelopes |
| D10 | Leased due jobs | Expire safely | Same DB commit with outbox | Retry publication, not gameplay |
| D11 | Restart/pause tests | Concurrent accepts/crashes | Real SQL isolation tests | Drop/reorder/resync tests |
| D12 | Application package | Policy/service boundary | Storage package | Transport independent contracts |
| D13 | Restart reconciliation | Survive deploy midpoint | Managed backup/restore | Deployed SSE acceptance gate |
| D14 | Authored recaps | No inferred proof | No model outcomes stored | Optional narration separate |
| D15 | Episode progresses alone | Optional boundary operation | Separate slots vs custody | Channel follows assignment |
| D16 | Logged phase changes | Logged custody version | Atomic events + state | Snapshot revisions, not raw log |
| D17 | Custodian authorization | Both identities required | Encrypted grants/hashes | Read capability cannot mutate |

## Cross-component matrix: user surfaces to operations

| Decision | C9 Dashboard | C10 OBS | C11 History | C12 Validation | C13 Operations |
| --- | --- | --- | --- | --- | --- |
| D1 | Shared TS models | Supported JS target | Canonical serializer | Same engine in harness | LTS compatibility checks |
| D2 | Same-origin API | Same-origin static assets | Read endpoints | In-process route tests | One service; DB dependency |
| D3 | Accessible components | Separate lightweight route | Reusable timeline | Browser interactions | Static build, no SSR server |
| D4 | Inspectable puzzle board | Ship damage, graph labels | Visual replay later | Real OBS profiling | Asset rights and bundle size |
| D5 | Native reconnect | Cookie/CEF compatibility | Read-only feed | Multi-tab/proxy soak | Headers/timeouts/HTTP limits |
| D6 | Connection health/grants | Show ingestion status | Raid proof attribution | CLI plus genuine Twitch | No bot-verification dependency |
| D7 | Consistent library | Slot-based world selection | Indexed event sequence | Disposable real database | Backups/retention/connection cap |
| D8 | Typed row mapping | Public projection only | Stable queries | Migration/constraint tests | No schema auto-sync |
| D9 | Validate commands/errors | Validate feed envelope | Event upcasters explicit | Schema compatibility fixtures | Reject safely, observable errors |
| D10 | Work health/retry | Recover current snapshot | No duplicate outcomes | Crash at commit boundaries | Lease/retry/dead-letter alerts |
| D11 | Onboarding/keyboard tests | Manual OBS check | Replay hash check | Live/test labels | Clean install + restore drill |
| D12 | One browser app | Small dedicated entry | Shared presentational code | Fixtures cannot enter live bundle | One lockfile and build graph |
| D13 | Public TLS URL | Stable overlay URL | Persistent history | Stage environment | No sleeping demo; price first |
| D14 | Predictable text | Never wait for generation | Fact-based templates | Network-free engine tests | No mandatory AI availability |
| D15 | Continue/park without raid | Same game across hosts | Host-independent world | Solo + multi-hop acceptance | Twitch outage degrades integration |
| D16 | Current snapshot | Skip stale animations | Full lineage and causes | Reconstruct exact state | Content/version retention |
| D17 | Private authenticated controls | Revocable read-only session | Opt-in public sharing | Leakage and CSRF tests | Redact/rotate/disconnect |

## Composition failures that individual library reviews miss

The cinematic title/flight restoration is reviewed against C1–C13 in [ADR 0015](../decisions/0015-cinematic-game-presentation.md). It keeps the approved stack, controller, rules, persistence and authority. Decorative event effects are baselined/deduplicated and bounded; SVG/DOM remain usable without graphics. Executed browser checks and measured software-renderer limitations belong to the rollout evidence, separately from this design review.

| Combination | Failure scenario | Required mitigation/evidence |
| --- | --- | --- |
| Fastify + HMAC + Zod | Default JSON parser changes bytes before signature calculation | Route-specific raw parser; tamper tests with whitespace and Unicode; parse only after verification |
| SSE + HTTP auth + OBS | Capability cannot establish a usable scoped session or proxy buffers state | Deployed OBS smoke test before UI expansion; heartbeat, no buffering, scoped cookie test; switch feed transport if it fails |
| Inbox workers + phase deadlines | A queued vote is processed after close, or a pre-resume message becomes a new vote | Bind ingress to a persisted window under its phase lock; close with an input watermark and drain accepted work before tally finalization; retry/out-of-order tests |
| `pg` pool + custody transaction | Statements run on different connections or target's missing slot is not locked | One checked-out client and persistent channel locks; concurrent target-claim test |
| Database queue + several worlds | One busy chat or poison event delays another world's handoff | Batch claims, per-world ordering, failure isolation, queue-age metrics, mixed-load test |
| Outbox + multiple replicas | Only one instance sees a publication and other connected overlays stay stale | Initial one-replica deployment; explicit cross-instance fan-out gate before scale-out |
| Event log + privacy + replay | Raw chat/identity retained forever just to reproduce rules | Normalize actions, pseudonymize participants, preserve public causes, retention/deletion tests |
| Puzzle bonuses + economy | Repeated solves farm resources or make every strategic cost irrelevant | One solve marker, bounded unlocks, branch enumeration and comparative playtests |
| Raid proof + intent timestamps | Old/duplicate delivery matches a newly armed transfer | One canonical subscription, bounded windows, proof consumption, pair cooldown, visible receiver consent; acknowledge limited correlation |
| Renderer + dense participation | Every chat event triggers an animation or React render | Coalesce aggregates; animate domain changes once; profile actual OBS while load runs |

## Required evidence before calling this architecture validated

### Live integration refinement — 2026-10-26

[ADR 0009](../decisions/0009-bot-delivery-and-account-boundaries.md) retains the approved stack. The following is design/test evidence, not a claim of real chat or raid verification.

| Existing component | Interaction with bot output and authority changes | Evidence or remaining gate |
| --- | --- | --- |
| C1 Identity | Separate operator key, creator/bot grants; role/account locks; late validation cannot replace a fresh grant | OAuth role recovery and validation-race regressions; real bot consent/identity now verified |
| C2 Gateway | Query normalization follows HMAC and exact subscription identity; no sending in the callback | Signed fixture/echo/mirror/dedup tests; three real signed challenges now verified |
| C3 Participation | Queries are read-only and separate from accepted actions; coalescing affects replies only | Slow-send test still applies gameplay |
| C4 Engine/puzzles | Summaries read canonical state; no rule changes or network calls in transitions | Existing balance/replay tests retained |
| C5 Episodes | Replies describe the current phase and legal participation; no host command through chat | Gameplay authority tests; automated timers still pending |
| C6 Custody | Disconnect cancels pending offers; bot output cannot create proof or accept custody | Disconnect/transfer regressions; native two-channel milestone pending |
| C7 Database/work | Same database, separate bounded worker; durable outcomes and no automatic uncertain retry | Real SQL queue/restart tests; replicas and load gates remain |
| C8 Live projection | Typed private diagnostic counts; public/overlay views omit details | HTTP projection tests; proxy/OBS acceptance pending |
| C9 Dashboard | Setup visible after sign-in without granting authority; explicit disconnect | Browser recovery and wrong-key journey |
| C10 OBS | Read-only capability rotation serialized; no operator/creator privileges from overlay cookie | Concurrent rotation and scoped-overlay tests; actual OBS pending |
| C11 History | Authored recap from canonical committed decisions, no raw chat/identities | Query output fixtures; full public navigation pending |
| C12 Validation | Exact staged source exported for independent build/tests; live doctor separated from fixture tests | Local suites, real app/broadcaster validation; live delivery not fabricated |
| C13 Operations | Independent live database/port and HTTPS tunnel, disabled request inspection, credential scans | Public HTTPS and deny probes pass; production hosting, leases/retention pending |

The conservative queue policy can drop/coalesce informational replies under pressure; it does not change game rewards or votes. Review pacing, queue age and fairness against measured multi-channel load before expansion.

### Named bot conversion — 2026-10-26

[ADR 0010](../decisions/0010-explicit-empty-account-bot-conversion.md) resolves the observed manual-disconnect loop within the approved stack.

| Component | Conversion interaction and validation |
| --- | --- |
| C1 Identity | Operator key plus fresh OAuth produces a five-minute browser capability; confirmation revalidates client/account/scopes, consumes once and serializes role changes |
| C2 Gateway | Three cookie-scoped setup routes use same-origin/custom-header protections; signed EventSub/raw-body boundaries remain separate |
| C3 Participation | Selected creator's queued input authority ends under its channel lock; no new viewer command or reward path |
| C4 Engine/puzzles | No engine imports or rules change; balance/replay coverage retained |
| C5 Episodes | Conversion requires no world history, so an existing hosted episode cannot be converted away |
| C6 Custody | Any handoff/custody history blocks conversion; history is checked again under locks to handle a new offer during consent |
| C7 Database/work | Additive encrypted pending-grant table, atomic claim and authority change, startup/minute expiry cleanup; simulation isolation tested |
| C8 Projection | Only the cookie holder sees pending label/expiry; OAuth tokens and capability are absent from JSON/feed payloads |
| C9 Dashboard | Named confirm/cancel replaces the repeated login/disconnect loop; real creator-feed closure refreshes current authority |
| C10 OBS | Selected account's old overlay capabilities end atomically; another broadcaster's access remains intact |
| C11 History | No world, event, handoff or lineage deletion; newly created history blocks the pending confirmation |
| C12 Validation | CSRF/substitution, missing/foreign cookie, creator/operator credentials alone, expiry, cancellation, identity/revocation, one-use race and another Ark's preservation tested |
| C13 Operations | Migration applied separately to live/simulation stores; pending credentials included in exposure scans; no new service, app registration or browser token storage |

The [validation plan](../planning/validation.md) defines executable tests to build: a complete solo season, a collaborative puzzle, same-recipient races, duplicate proofs, crash recovery, mixed-world participation load, real OBS reconnect, deployed SSE smoke, and a genuine two-channel raid. None is marked passed at planning time. If a choice fails, change the smallest boundary that resolves it, update the ADR and repeat the affected cross-component checks.
