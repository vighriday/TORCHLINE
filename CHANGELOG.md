# Changelog

All meaningful product, architecture, and development changes are recorded here. Dates use Asia/Calcutta. No application release has been published.

## Unreleased

### Bot reply delivery — 2026-10-26

- Implemented `!status` and `!history` through the native Send Chat Message API, separate from gameplay commands and ingestion work. Replies are bounded, source-channel-only and require current bot/creator permissions plus the matching enabled chat subscription.
- Added durable reply outcomes, message deduplication, channel coalescing, global bot pacing, provider drop handling and restart quarantine. Ambiguous sends are recorded as uncertain and are not automatically resent.
- Four provider-fixture bot tests cover identity/scope boundaries, echoes/mirrors, slow-network isolation, throttling, provider rejection and restart behavior. Genuine Twitch bot delivery is not yet verified.

### Real Twitch application compatibility — 2026-10-26

- Verified real client-credentials issuance and broadcaster OAuth against Twitch through the development HTTPS tunnel. Genuine chat, bot delivery and native raid acceptance remain separate milestones.
- Fixed real app-token validation responses with `scopes: null`; normalize them to no scopes while retaining required user identity/permission checks. Added a provider-shape regression.
- The owner resumed reviewed incremental pushes after the earlier hold. No merge, release or production deployment is implied.

### Twitch boundary fixes — 2026-10-26 (local)

- Fixed R1–R4 from the authority review: terminal subscription IDs cannot be revived by challenge replay or a delayed creation response; readiness requires the current bot/callback/version/conditions and provider confirmation; dashboard/chat participation shares one identity; malformed and oversized bodies retain 400/413 responses.
- Added subscription identity migration, paginated provider reconciliation, cleanup limited to tracked subscriptions, per-channel reconciliation serialization, automatic bounded reconciliation and signed-delivery metadata without raw chat.
- Added a complete provider-contract OAuth → bot → chat gameplay → signed raid → receiver acceptance journey, plus role, replay, bot replacement, callback and invalid-input regressions. Thirty tests pass across six files. These remain fixture-based integration tests, not actual Twitch authorization or native raid evidence.
- Started an owner-requested ngrok HTTPS tunnel forwarding only the dedicated live port 3001; the simulation remains on 3000. Application registration and real grants are still pending. No further push or deployment is included.

### Local review — 2026-10-26 (unpublished)

- Completed a public capability/authority inventory across all application routes and 13 architecture components. Forty-eight local checks reproduced four defects: replayed challenge revives a revoked subscription, stale bot subscriptions pass readiness, one broadcaster can hold two ballot identities, and invalid JSON/body limits return server errors. Fixes and committed regression coverage remain pending.
- Reran the 25-test baseline successfully and checked dependency advisories (none reported). Confirmed the prior feature push's GitHub Actions run passed; it does not cover the newly found defects.
- Recorded the owner's review-before-push instruction. No further push, application change, merge, deployment or history cleanup is included in this review.

### Implemented — 2026-10-26

- Retained the approved TypeScript/React/Fastify/PostgreSQL stack and game/episode/custody separation; implementation began after the user's review.
- Added pinned workspace dependencies, native Node 24 runtime support, strict type checking, formatting, production browser build, tests and a GitHub Actions verification workflow.
- Audited the original 32 authored paths: 28 colonies, four partial endings, zero wrecks. Rebalanced the complete `ark-v2` season with cumulative damage, leaks, hazardous landing, viable-population thresholds and advance warnings.
- Added exhaustive current-tree analysis: 2,398 terminal branches, 964 colonies, 1,304 partial survivals and 130 wrecks, including hull and oxygen failure. These counts are not player probabilities.
- Implemented viewer discovery, route solving and dependent repair work orders with real resource/system effects, bounded rewards and future decision changes. One viewer repair can change the same host choices from oxygen failure to survival.
- Added canonical physical condition, integrity, scars, reward/cause event IDs and derived presentation severity that persist across chapters, saving and custody changes.
- Implemented PostgreSQL migrations, idempotent commands, event replay, active slots, park/resume, world library and isolated simulated handoff transactions with consent, proof, expiry and race protection.
- Built the functional reference dashboard, challenge/Ark renderers, mobile layout, read-only scoped overlay and SSE updates. Final UI/UX, motion and art direction remain with Claude Design; seven engine-derived fixtures and clean contracts are supplied.
- Added separate bot/creator OAuth, encrypted grants, startup/hourly validation, serialized refresh, webhook authentication, durable normalized chat ingestion, message deduplication and live transfer-readiness checks.
- Added separate ignored simulation/live local environment files and databases, plus Twitch account setup/preflight instructions. No Twitch credentials are committed.

### Verification — 2026-10-26

- Final local run: type-check/production browser build pass, **25 tests across five files pass**, and **two Chromium browser journeys pass**. Balance reports and design fixtures regenerate deterministically; repository privacy/link/whitespace checks pass.
- Browser checks cover cooperative contribution, persistent sacrifice, reload, scoped overlay, simulated creator handoff and a 390px viewport. Actual OBS and genuine Twitch behavior are not established by these checks.
- Fixed JSONB replay comparison, intent timestamp precision, asynchronous opt-in feedback, SSE shutdown and simulation/live worker isolation issues exposed during integration. Only the source can cancel and only the receiver can decline an intent.

### Still unverified or unfinished

- Real Twitch app/bot authorization, public HTTPS challenge, genuine chat, actual OBS and a native two-broadcaster raid.
- Automatic timers, resource allocation, high-load/soak behavior, full worker/retention/reconciliation hardening, final Claude Design integration and production deployment.
- The initial feature push's GitHub Actions run passed; actual deployment and the live verification listed above remain pending. Further publication is held during review.

### Planning baseline — 2026-10-26

- Initialized local Git on `main` and configured the existing TORCHLINE GitHub repository as `origin`.
- Added privacy exclusions for all case variants of the original idea filename, internal notes, local configuration, and credentials.
- Documented product requirements, the complete Ark Protocol season, progressive delivery, and measurable acceptance criteria.
- Researched Twitch OAuth, cloud chat authorization, EventSub raid and chat events, webhook verification, token lifecycle, and platform limits using official sources.
- Proposed the system architecture, data contracts, technology choices, and architecture decision records.
- Added implementation backlog, validation strategy, development and deployment runbooks, submission planning, and a risk register.
- Recorded unresolved broadcaster access, live raid behavior, hosting selection, and conflicting organizer schedule information.
- Reviewed 17 stack/architecture decisions across 13 planned components, including alternative choices, composition failures, and future validation gates.
- Separated persistent gameplay, hosted episodes, and custody so a complete solo season does not require raids.
- Expanded the complete-season gameplay target with cooperative route puzzles and bounded clue/repair interactions beyond voting.
- Refined the presentation/feed recommendation to SVG/DOM and SSE with HTTP commands, retaining explicit Canvas and WebSocket revisit triggers.

### Planning baseline status

- Initial commit `39f59a2` was planning only, before the implementation above.
- Repository checks: local Markdown links resolve, staged whitespace validation passes, and private concept files are ignored and absent from the staged index.
