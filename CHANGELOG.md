# Changelog

## 2026-10-29 — Story-first README

- Replaced the engineering-heavy entry page with a plain-language game introduction, two real opening choices, a viewer-contribution example, actual gameplay and optional 3D/flight-log exploration.
- Kept setup, architecture, commands and verification in expandable sections. Added two Mermaid diagrams and clear links to current evidence; real Twitch/OBS/raid gates remain explicit.
- Extended repository checks to cover HTML image/link references. Added deterministic README proof regeneration and drift checks to CI without new runtime dependencies.
- Local production build/typecheck, format, repository links, negative missing-image check, media structure/duration, reduced-motion selection and staged credential scan pass. Full source CI is tracked separately; the previously reported run 40737973250 failed at npm bootstrap with ECONNRESET, and newer source f1a8d4c already passed the complete suite.
- README source `fa6dc1b` passes CI 40814601546: all 97 tests, 11 browser journeys, generated proof/fixture consistency, release image and restricted-container smoke. Media source `84f3a58` also passes its full run. Native Twitch acceptance remains separate.
- Clarified the local browser-install directory and optional media-generation prerequisites. Local play is the primary try-it path; the temporary preview is explicitly availability-dependent.

## 2026-10-29 — Inspectable README media

- Created original hero artwork and icons, a handoff illustration, actual saved-simulation footage and a native GitHub 3D export of the game vessel. Preserved simulation/pending-live labels and reduced-motion stills; raw captures remain ignored.
- Generated the opening choices and a one-viewer repair counterfactual through current ark-v3 rules, with deterministic replay checks and a synthetic searchable flight log.
- Added optional, isolated capture/generation recipes and asset provenance. Documentation tooling is excluded from the release build; application rules, permissions and design are unchanged.
- Reviewed supported GitHub formats and all thirteen component boundaries. GitHub's Markdown API preserves disclosures/picture sources; local light/dark/mobile rendering, two diagrams, keyboard disclosure and reduced-motion selection pass. Native GitHub STL/CSV viewer support is documented rather than claimed as a live browser acceptance test.

## 2026-10-28 — Preview connection recovery

- Reproduced the live JSON error: ngrok returned an HTML warning page to browser-agent API requests. Added its documented header only on free-preview hosts, JSON response validation and short recoverable messages without raw parser/upstream output.
- Replaced the false initial launch/simulation screen with a branded connection state. Added read-only retry/feed reattachment, separated action errors from transport status and preserved committed state after a lost response. No mutation is automatically retried.
- Corrected overlay waiting copy and the launch button's accessible name. Added six client regressions and two fault-injected browser journeys; local build/typecheck, all 97 tests and all 11 browser journeys pass.
- Reviewed an older CI timeout in the three-page custody journey: run that state/permission journey with reduced motion, while dedicated cinematic/encounter tests retain actual moving WebGL checks. A renderer commit's initial CI failed at npm bootstrap with ECONNRESET, before source validation; the completed newer run is recorded below.
- Final source `f1a8d4c` passes CI 40738778152: 97 tests, 11 browser journeys, unchanged fixtures and restricted image smoke. Real fresh-browser JSON/3D, public read-only overlay and secret/permission probes pass; native Twitch/OBS/raid acceptance remains separate.

## 2026-10-28 — Cinematic startup polish

- Removed the transient full-size schematic during 3D startup. A stable visual-uplink state fades into the first rendered frame; system labels wait for valid projected positions.
- Preserved intentional schematic, mobile/reduced-motion and graphics-failure behavior, with bounded visual startup and no dependency between graphics readiness and game controls/timers.
- Added a real delayed-chunk browser regression for visibility, fixed layout, first-frame opacity, graphics loss and zero world writes.

## 2026-10-28 — Encounter motion and command review

- Carry the title's saved reduced-motion preference into every flight-deck CSS effect, alongside the existing SVG fallback and system preference. Browser coverage checks actual animation styles after reload.
- Crew command guidance respects repair prerequisites: A and B must be patched before suggesting C. Exclude the unused work-order D node. These are presentation suggestions; server rules and permissions remain authoritative.
- Source `b1574e9` passes CI 40732891048: 91 tests, eight browser journeys, fixture consistency and release-image smoke. Real HTTPS serves matching current build assets; public overlay and ten-response secret checks pass. Native chat/OBS/raid and owner visual acceptance remain open.

## 2026-10-28 — Playable encounter presentation

- Reopened presentation work after owner review: added visible radiation-front motion, chapter atmosphere/sector transmission, ship-attached persistent-system inspection and clearer mission/reward presentation using the existing Claude Design scene and React contracts.
- Added keyboard/pointer relay interaction through canonical commands and a Crew Uplink with direct native Twitch chat and current-command copying. No automatic chat, fake participation, engine rule or authority change.
- Preserved read-only OBS, mobile/SVG, reduced motion, graphics failure recovery, persisted scars and no historical effect replay. New test compares composited moving frames, checks inspection leaves state unchanged and relay discovery persists across reload.
- Production build/typecheck, 91 automated tests and all eight Chromium journeys pass locally. Native OBS, genuine chat/replies/raid and owner visual acceptance remain separate gates; source CI is recorded independently.

## 2026-10-28 — Current frontend asset delivery

- Fixed startup-enumerated static routes serving SPA HTML for newly rebuilt JS/CSS names. Public dist files now resolve through the existing static plugin at request time; missing assets/API paths return404 and creator mutations remain authenticated.
- Added a regression for post-start asset creation, JavaScript content type/bytes, missing routes and authority. No engine, storage or Twitch behavior changed.

## 2026-10-28 — SSH HTTPS verified

- Owner registered the prepared SSH public key; restored the live HTTPS origin through Windows OpenSSH with strict pinned host verification. Native ngrok remains quarantined/unused. Restarted the existing private database and live/simulation processes.
- Real public health/readiness/authority denials, all three exact provider subscriptions and real app/broadcaster/bot grants pass. Ten selected public response secret probes pass with 15 private fingerprints. Actual public Chromium overlay cookie/SSE/read-only checks pass; its temporary grant was removed and no live Ark exists yet.
- Diagnosed owner-reported `redirect_mismatch`: server sends the new correct callback, so the existing Twitch console allowlist must be updated. No callback state/query was retained. Genuine gameplay chat/replies, OBS CEF and native raid remain unverified; no gameplay/design/code change.

## 2026-10-28 — Candidate evidence recorded

- Implementation `9750048` passes GitHub Actions 40678887999: all 90 tests, seven browser journeys, fixture consistency, real release image build and restricted-container smoke with graceful SIGTERM. Local dependency audit and 15-fingerprint artifact scan pass.
- Both local stores/services are current and ready. Real grants and exact 3/3 subscription metadata validate; HTTPS recovery, real chat/bot visibility, native OBS, native raid and production hosting/remote-backup/soak gates remain explicitly open. Recorded the final review and essential owner checklist without changing gameplay/design.

## 2026-10-28 — Honest live acceptance tooling

- Prepared project-only OpenSSH HTTPS fallback after Windows Defender quarantined native ngrok; verified the official server fingerprint. The executable was not restored/exempted. Public-key registration is the remaining account dependency, so preview reachability is reported offline.
- Real-service diagnostic now shares all-page subscription pagination and labels historical callback delivery explicitly; added repeated-cursor regression. Added timestamp-baselined aggregate chat/action/send/linked-transfer evidence and an expiring read-only public Chromium overlay probe with no trace/capability output.
- Added current owner checklist, deployment readiness/authority report and superseding status. Real grants and 3/3 subscription metadata validate; zero applied chat/accepted send/live custody remains the honest native evidence. Public overlay/OBS/native raid acceptance is pending.

## 2026-10-28 — Linux shutdown correction

- Linux process CI exposed a genuine graceful-shutdown deadlock: the last-registered Fastify close hook ended the PostgreSQL pool before the worker lease hook could release its client. Shutdown now awaits application cleanup before ending the owned pool, including fatal lease loss.
- Added a bounded per-stop assertion so shutdown failures report their signal/stage instead of hanging the whole recovery test. Windows kill/restart evidence remains distinct from Linux SIGTERM.

## 2026-10-28 — Reproducible release image

- Added a pinned multi-stage application image, allowlisted build context, production-only runtime dependencies, non-root user, readiness healthcheck and source revision label.
- Added Linux CI image build/smoke against an isolated schema: migrations, private-path/dev-tool exclusion, read-only filesystem, assets/security/anonymous denial and graceful shutdown. Local Docker and cloud deployment are unavailable; CI results are recorded separately.
- Documented migration/start/verify/rollback order and the single-replica limitation. No registry publish, hosting provision or production deployment occurred.

## 2026-10-28 — Runtime and feed boundaries

- Added validated production HTTPS/DB TLS, independent keys, exact OAuth redirect and bounded operational configuration; startup failures redact dependency details.
- Added same-origin browser policy, framing/device restrictions, request timeouts and per-channel/global authenticated feed ceilings with disconnect cleanup. Existing Claude Design rendering and read-only OBS authority remain intact.
- Added real HTTP feed-flood/slot-reuse tests and actual subprocess kill/replacement checks: ship state/resources survive, interrupted timing pauses once and worker ownership can be reacquired. Linux CI separately checks graceful SIGTERM; Windows termination is not labeled graceful.

## 2026-10-28 — Verified encrypted recovery

- Added operator-only consistent PostgreSQL snapshots encrypted with an independent AES-GCM key; credentials never enter command arguments or plaintext dump files. Restore authenticates before SQL, refuses the source/nonempty targets and verifies all table fingerprints plus versioned world replay.
- A deployment-shaped public-schema test caught and fixed the fresh-database schema collision. Wrong keys, corruption and overwrite protections pass. CI uses matching PG17 CLI tools rather than the runner's changing native PostgreSQL version.
- Created and successfully restored the actual local live archive into scratch: 25 tables / 25 rows / zero live worlds. Gameplay replay is proven by the separate isolated fixture. Off-machine retention, managed recovery and production RPO/RTO remain external deployment gates.

## 2026-10-28 — Bounded participation and history

- Added persisted per-viewer/world input budgets, a per-world pending ceiling and fair channel batches. Duplicate deliveries do not spend allowance; stale/unsupported commands are ignored before admission. Fixed offline notifications overtaking previously accepted chat during the initial fairness implementation.
- Indexed public history and custody pages; Twitch action projections read a bounded event tail. Complete immutable history and versioned replay remain intact.
- Added optional expiry for temporary read-only overlay capabilities while preserving ordinary OBS links and creator authority boundaries. Migration 008 applied to both local stores.
- 85 automated tests across 15 files pass, including concurrent admission, refill/backlog/fairness, a synthetic 50,000-ballot query-plan check and overlay expiry/permissions. This is automated PostgreSQL evidence, not genuine chat or deployed load capacity.

## 2026-10-27 — Restored genuine HTTPS ingress

- Added credential-safe tunnel/origin helpers and included the ngrok environment token in exposure scans. The old hostname belonged to a different account; the current account's assigned origin now reaches the existing live service.
- Verified real public health/readiness and authorization denials, three fresh signed Twitch callback challenges, exact 3/3 enabled subscriptions and current app/creator/bot grants. Ten selected public response secret probes pass.
- Genuine chat, accepted/visible bot replies, native OBS and native raid custody remain separate gates; no production gameplay/proof was synthesized. Updated owner steps for the new exact redirect.

## 2026-10-27 — Playable cinematic title and flight HUD

- Restored the supplied metallic title/launch choreography and ship-centered game screen in typed React. Captain and read-only broadcast views share real resources, phase clocks, puzzles, allocation, advisory votes, consequences and persistent ship condition.
- Connected recorded discovery, repair, sacrifice, damage and chapter events to bounded effects; reload preserves damage without replaying history. Kept setup/history/custody tools, accessible route entry, reduced motion, mobile SVG and graphics failure recovery.
- Corrected account-menu state reuse and simulation drawer overlap found by browser journeys. No backend, game rules, schema, grant or authority changed.
- Added cinematic launch/effect/reload coverage and updated design contracts/provenance. A measured software fallback sample reached 22 FPS at DPR 0.5; actual OBS and native Twitch play remain unverified.
- Verified production build/typecheck, 77 tests across twelve files and all seven Chromium journeys. Repository/format/artifact-secret checks pass; both local services serve the current build. Public HTTPS remains offline.
- Follow-up visual QA removes cropped decorative topology captions from the full-screen SVG fallback; the accessible ship description and physical records remain available.

## 2026-10-27 — Cinematic renderer foundation

- Restored richer Claude Design ship geometry, procedural surface/glow treatment, canonical detached cargo/sealed sectors/damage and bounded chapter/event effects. No game rules or authority changed.
- Added effect baselining/deduplication, particle/geometry bounds, adaptive resolution and complete GPU cleanup. Full title/flight consumers are a separate integration step; native OBS remains unverified.

## 2026-10-27 — Continuation evidence

- Recorded the full runtime rollout's successful CI, 77 automated tests, six Chromium journeys, current real-provider grant/subscription checks and exact external dependencies. Both local services run from the reviewed source with migration 007.

## 2026-10-27 — Hosted cooperation and durable recovery

- New Arks explicitly use ark-v3; old Arks retain replay-compatible ark-v2. Twitch/simulator parsing and designed React/mobile/overlay views support investigation, normalized allocation and frozen advice. Presentation is versioned 2026-10-27.1.
- Persisted phase deadlines, standard/manual pacing, early host closure, paused remaining time, pause-before-park, explicit resume and restart recovery. Story choices never auto-commit.
- Added database/schema/mode worker fencing, signed offline pause handling, disconnect pause, persisted input backoff/quarantine and narrowly scoped current-window recovery diagnostics/controls.
- Fixed a 720p overflow from the new episode details; the broadcast uses a compact header clock and aggregate plan while the dashboard keeps full explanations.
- Native OBS remains unverified: both computer-use entry points failed before initialization. HTTPS and real chat/raid acceptance still require the deferred tunnel credential and real-service session.

## 2026-10-27 — Browser baseline and Ark reconciliation fix

- Wait for the persisted chapter phase before recording a browser baseline (GitHub run 40515143258); compare canonical state independently of display clock timestamps.
- Give sibling Ark and consequence components distinct React keys to prevent stale duplicated ship details.

## 2026-10-27 — Immutable cooperation rules

- Added ark-v3 investigation priorities, fixed-budget repair preferences, combined consequence previews and explicit vote freezing. Existing ark-v2 histories retain their original rules.
- Added exhaustive allocation arithmetic and regression tests for real consequences, affordability, lethal overkill, caps and replay. Runtime adoption/timing follows separately; no additional live verification is claimed.

All meaningful product, architecture, and development changes are recorded here. Dates use Asia/Calcutta. No application release has been published.

## Unreleased

### Complete records and inheritance previews — 2026-10-27

- Added creator-only, paginated gameplay/custody history and read-only inspection of parked and terminal worlds. History omits individual ballots, actor identifiers, raw commands and proof payloads; the former custodian loses future record access after transfer.
- Added exact frozen-Ark previews for the two parties of a current offer, with connected consent, mode, expiry, revision and current source custody checked under the existing lock order. Cancellation, acceptance, opt-out and disconnect end preview access.
- Connected Archive, Hangar and Relay to actual records; complete event pages and community lineage replace the recent-tail limitation. Normal dashboard/OBS snapshots now query a bounded event tail.
- Added six PostgreSQL/API permission, paging and revocation tests; all 60 tests across nine files and five browser journeys pass, including receiver inspection before simulated acceptance. Simulator evidence now uses the database clock to avoid application/database timing races; native proof rules are unchanged.

### Owner launch walkthrough and honest verification — 2026-10-27

- Added a beginner launch guide covering the existing accounts/app, HTTPS restoration, exact redirect/configuration, creator/bot consent, subscriptions, real chat, private OBS links, native raid acceptance and proposed always-on hosting. No production deployment or purchase occurred.
- Rechecked the real Twitch app, creator/bot grants and exact 3/3 subscription metadata successfully. Public probes fail while the owner's ngrok credential remains deferred; actual chat/output, OBS and native transfer remain unverified.
- Secret scans now identify the live application before claiming public coverage, report partial evidence for an offline/error origin, support explicitly scoped artifact-only scans and include a locally saved ngrok credential when present. Private artifacts pass the configured fingerprint scan. Clarified verifier guidance so an unreachable origin does not automatically imply missing server credentials.
- Clarified read-only simulation guidance and connected inherited causes to readable ship-log entries. Recorded the complete design/authority review and remaining gates.

### Canonical command deck and broadcast integration — 2026-10-27

- Adapted Claude Design into typed React Bridge, Relay, Hangar, Broadcast and Archive views while preserving the working HTTP/SSE controller, creator/bot setup, gameplay commands, park/resume, overlays and consented custody flow.
- Added shared cinematic/SVG Ark views from canonical physical systems and permanent marks, locally served fonts, reduced-motion/mobile fallback, bounded 30 FPS/DPR, visibility suspension, context-loss recovery and GPU disposal. No prototype runtime, client rules, sample creators or fake timers/votes ship in the application.
- Improved keyboard route building, phase guidance, actual six-resource forecasts and private OBS-link copying. Relay reflects persisted proof/consent states; Archive labels its bounded canonical log instead of inventing history or replay attestations.
- Preserved all 54 engine/storage/Twitch-authority tests and the existing browser journeys. Expanded to five browser journeys covering seven engine-derived ship states at 720p/1080p, non-overlapping broadcast composition, all workspaces at 320–1440px, keyboard, reduced motion, local assets and graphics recovery. Visual QA caught and fixed first-frame blanking and reconnect-status layout overlap. Actual OBS, real chat/output and native raid remain separate gates.

### Claude Design integration review — 2026-10-27

- Reviewed all six visual surfaces and four JavaScript references. Recorded the canonical-state mapping, prototype differences, provenance, source checksums and all thirteen component boundaries in ADR 0011 and the design review.
- Preserve original exports in the ignored local design workspace; version curated adaptations instead. Added locally served, licensed design fonts. Application integration and its verification are recorded in subsequent increments.

### Genuine Twitch bot and callback milestone — 2026-10-26

- Verified real broadcaster and bot identities/scopes after owner consent and the named account conversion. Received three genuine signed webhook challenges; Twitch reports current chat/online/offline subscriptions enabled with the expected bot, callback, version and conditions.
- Extended the read-only live verifier to check exact enabled subscription metadata and accepted native bot-send outcomes. It still sends no chat or synthetic proof.
- Genuine gameplay chat effects and visible bot output remain pending owner commands; actual OBS and the native two-broadcaster raid remain separate milestones.

### Direct bot conversion — 2026-10-26

- Replaced the repeated manual-disconnect loop with a named conversion after operator-protected Twitch bot consent. An active empty creator can explicitly confirm or cancel; accounts with world/handoff/custody history remain protected.
- Added encrypted five-minute pending grants and a browser-bound, one-use HttpOnly cookie. Confirmation revalidates Twitch identity/scopes and atomically ends only the selected creator's local authority before installing the bot grant. No token is exposed in JSON, URLs or browser storage.
- Added history-race, replay/concurrency, CSRF/account substitution, expiry/cancel, provider revocation/identity and simulation-isolation coverage. All 54 tests across eight files and three browser journeys pass. The owner completed actual bot conversion and Twitch grant validation; genuine chat/output and native raid remain pending.
- Fixed the stale creator-feed warning after conversion by refreshing current authority when that feed closes; the browser regression includes delayed state loading during conversion.

### Bot consent recovery feedback — 2026-10-26

- Split bot-role denials into active creator connection versus existing Ark/handoff history, and identify the account Twitch actually authorized.
- Added a readable browser recovery page with a return link and explicit disconnect instructions. Signing out and disconnecting are distinct actions; the existing operator/OAuth checks and world-history protections remain enforced.
- Extended the onboarding browser journey through this denial and retry, and added escaped-output/no-authority-change coverage. Genuine bot delivery remains unverified until dedicated consent and real chat testing succeed.

### Live verification tooling and runbooks — 2026-10-26

- Added real-service preflight for public HTTPS, anonymous/unsigned denials, actual app/grant validation, EventSub reads and live delivery/custody evidence. Reports only sanitized metadata and keeps prerequisites separate from failures; it sends no chat or synthetic proof.
- Added exposure scans for configured credentials and saved tokens across committed/staged Git objects, tracked files, browser assets, local logs and selected public responses. Local environment files, operator keys and the original concept remain ignored.
- Updated setup/recovery instructions, component stress review, authority review and implementation evidence. Dedicated live/simulation ports remain independent; no production deployment or merge is included.

### Creator authority and bot onboarding — 2026-10-26

- Made operator-protected bot setup available after creator sign-in. Added explicit disconnect and recovery for an accidental empty creator registration, with serialized role changes and no deletion of world/custody history.
- Added private creator diagnostics for subscription identity/readiness, signed deliveries, applied chat, bot outcomes and custody changes. Anonymous/overlay responses exclude those details; private responses are not cached.
- Made overlay-link rotation atomic and rechecked connected creator authority under mutation locks. Late validation/refresh results cannot overwrite or revoke a newly authorized token pair.
- Added role-recovery, stale-authority, overlay-race and token-race regressions plus a browser journey for wrong-key denial, disconnect and bot consent. Current full suite: 44 tests across seven files and three browser journeys; real bot/chat/raid acceptance remains pending.

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

- Genuine chat effects, visible bot delivery, actual OBS and a native two-broadcaster raid. Real app/broadcaster/bot authorization, named conversion, public HTTPS, three signed challenges and current enabled chat/stream subscriptions are now verified.
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
