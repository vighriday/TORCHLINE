# Implementation and verification status

Updated 2026-10-26. Architecture approval was given before implementation. This is the current evidence record; earlier proposed documents remain the wider target architecture.

**Integration follow-up:** the [public capability and authority review](../reviews/2026-10-26-public-authority.md) reproduced four cases in baseline `00250ce`. All four have fixes and passing regression coverage. A complete provider-contract OAuth/bot/chat/signed-raid journey is tested. Real application identity and broadcaster grants now validate against Twitch through the public development origin. Dedicated bot consent and genuine chat/native raid acceptance remain external gates. The owner has resumed reviewed incremental pushes.

## Working locally

- Strict TypeScript workspace on Node 24.22.1, Fastify 5, React 19/Vite, Zod 4 and PostgreSQL 17 with `pg`/SQL migrations.
- Complete five-chapter `ark-v2` deterministic game, all three endings, exact choice previews, pauses and untimed host-controlled interaction windows.
- Viewer clue discovery, constrained route submission, cooperative repair prerequisites, globally bounded rewards and latest-account advisory votes.
- Real resource/system consequences: restored shields reduce later damage; repairs prevent leaks; route solutions unlock precision salvage; one viewer's repair can turn an otherwise fatal oxygen trajectory into survival.
- Persistent physical integrity, current condition, scar history, event provenance and read-model severity. These values survive chapter changes, PostgreSQL reload and custody transfer.
- PostgreSQL snapshots/events, replay validation, idempotent commands, active-slot constraints, park/resume, world library and transactional custody.
- Explicitly labeled simulator with multiple creators, source preparation, isolated synthetic proof, receiver acceptance, duplicate-proof/accept handling, expiry and competing-recipient protection.
- Functional reference browser UI, versioned presentation models, scoped read-only channel overlays, SSE reconnect and desktop/mobile viewport checks. Claude Design owns the final visuals.
- Twitch code paths for separate bot/creator OAuth, one-use state, encrypted tokens, startup/hourly validation, serialized refresh, revocation handling, manual subscription reconciliation, raw-byte HMAC, durable normalized chat ingress and transfer-readiness checks.
- Operator-key-protected bot setup before/after sign-in, safe recovery from an accidental empty creator registration, explicit creator disconnect preserving world history, and atomically rotated read-only overlay capabilities.
- Durable `!status`/`!history` bot replies with source-only sends, channel coalescing, global pacing, provider drop outcomes and uncertain-send quarantine. Slow outbound chat cannot block gameplay ingestion.
- Private per-creator integration diagnostics plus real-service and secret-exposure verification commands; anonymous/overlay projections exclude those diagnostics.

## Executed evidence

- `pnpm build`: type-check and production browser build pass.
- `pnpm test`: **44 tests across seven files pass**, covering domain, balance, replay, real PostgreSQL races/constraints, HTTP authorization, OAuth/webhook fixtures, token lifecycle/races, worker mode isolation, bot delivery policy, account-role recovery, stale creator mutations, the four reviewed defects and a complete provider-contract chat/raid journey.
- `pnpm test:browser`: **three journeys pass** in headless Chromium, including shared contribution → repair → sacrifice → reload → read-only overlay → simulated two-creator transfer, plus the live-mode bot setup/recovery flow against a fixture provider. A 390px viewport has no horizontal overflow.
- Real-service verification: public HTTPS health/readiness and anonymous/unsigned denial probes pass; real app token mint/validation, broadcaster grant identity/scopes and EventSub API reads pass. The real app-token response exposed nullable scopes, now normalized without granting user permissions.
- Public secret scan passes across committed/staged Git objects, tracked working files, built browser assets, local logs and nine public responses, including probes for local environment/Git/private-input paths. Configured secrets and saved grant tokens are not found; OAuth's public Client ID is treated separately.
- `pnpm audit:legacy`: original tree has 32 paths, 28 colonies, four partial endings, zero wrecks.
- `pnpm audit:balance`: 2,398 terminal branches; 964 colonies, 1,304 partial survivors, 130 wrecks (86 hull, 44 oxygen). Equivalent clue ordering/routes collapsed; no allocation/timer coverage is implied.
- Seven [Claude Design fixtures](../design/README.md) are generated from actual engine commands.

Browser evidence is Chromium, **not actual OBS**. Contract OAuth/webhook tests use an isolated database and local provider fixtures, **not a genuine Twitch account or raid**. Numerical reachability does not establish enjoyable difficulty or creator adoption.

## External verification still required

The owner registered the Twitch application and authorized real creator accounts. The intended bot initially entered the creator flow; a tested recovery path is provided in [account setup](../operations/twitch-setup.md). Complete dedicated bot consent, then verify the genuine signed callback, chat action and bot output. Actual OBS and two consenting live broadcasters performing a native raid remain unverified. The live transfer route checks current grants, exact subscriptions and stream status before preparation/acceptance; its complete journey is still provider-fixture evidence.

A development ngrok tunnel forwards only to the dedicated live process on 3001; simulation stays on 3000 with a separate database. No production deployment or public submission exists. The initially authorized push published planning baseline `39f59a2` to `main` and gameplay milestone `00250ce` to `feat/gameplay-foundation`; [GitHub Actions](https://github.com/vighriday/TORCHLINE/actions/runs/40319660913) passed for that milestone. Reviewed incremental pushes resumed after the owner's explicit instruction. Repository visibility remains private; no merge or history rewrite is included.

Incremental remote evidence: [real app-token compatibility `dd9bd53`](https://github.com/vighriday/TORCHLINE/actions/runs/40360396761), [bot delivery `68a39b1`](https://github.com/vighriday/TORCHLINE/actions/runs/40362011225) and [account/authority `1d9437c`](https://github.com/vighriday/TORCHLINE/actions/runs/40362972047) each passed GitHub Actions. Account/authority also passed its exact staged-source local build, 44 tests and three browser journeys. These CI runs use fixtures, not genuine chat/raid evidence.

## Deliberate first-slice limits and next work

- Interaction windows are explicitly host-controlled. Automatic deadlines, full timer recovery, per-account cooldown/rate-limit policies and resource allocation remain pending.
- Gameplay chat supports `!scan`, `!route`, `!patch`, `!vote`. Query replies for `!status`/`!history` are implemented and fixture-tested; genuine delivery remains pending. Proactive announcements remain future work.
- Early ingress binds a window under the world lock. Close/pause refuses while accepted input is pending. Per-phase/ballot tables and finer write partitioning are needed before claiming the planned large-chat throughput.
- The worker is single-instance with bounded polling. Worker leases, cross-instance fan-out, durable retry/dead-letter diagnostics and scheduled retention cleanup require further production hardening.
- Reconciliation now paginates provider records, serializes per channel, runs on startup/authorization and bounded periodic batches, and retires tracked subscriptions for obsolete configurations. Untested public-provider behavior, transient-error handling and broader network scale still require further evidence.
- Current event replay reconstructs the game from accepted commands under immutable rules and checks stored effects. Hosting/custody revisions have their own transaction/audit records; they do not mutate game sequence numbers.
- Load/soak targets, backup restore, deployment rollback, actual OBS frame time, final accessibility/usability playtesting, public history navigation and final Claude Design integration remain unverified or unfinished.
- The HTTP server binds loopback by default. This is a local functional slice, not a claim of production readiness.

The next priority is early real Twitch verification alongside timer/input hardening and design integration. Authentic raid custody remains the defining technical milestone; a simulator does not satisfy it.
