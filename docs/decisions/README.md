# Architecture decision records

ADRs 0001–0007 were approved for implementation on 2026-10-26. Their original proposed status describes the earlier planning snapshot; approval is recorded here. Runtime behavior still requires implementation evidence. Record a replacement ADR when changing a material decision.

| ADR | Decision | Stress-review coverage |
| --- | --- | --- |
| [0001](0001-game-episodes-and-custody.md) | Separate persistent game, hosted episodes and custody | D15 |
| [0002](0002-typescript-modular-monolith.md) | TypeScript modular monolith and shared browser application | D1, D2, D3, D12 |
| [0003](0003-postgresql-transactions-and-history.md) | PostgreSQL, explicit SQL, durable work and replay history | D7, D8, D10, D16 |
| [0004](0004-native-twitch-integration.md) | Cloud bot webhooks and authentic consented raid transfers | D6, D17 |
| [0005](0005-presentation-and-live-delivery.md) | Presentation boundary, SSE reads and HTTP commands | D4, D5 |
| [0006](0006-deterministic-gameplay-and-validation.md) | Deterministic authored gameplay and layered validation | D9, D11, D14 |
| [0007](0007-hosting-security-and-growth.md) | Always-on hosting, scoped access and evidence-led growth | D13, D17 |
| [0008](0008-balanced-consequences-and-physical-state.md) | Reachable catastrophe, meaningful challenge rewards and persistent physical state | D4, D9, D11, D14–16 |
| [0009](0009-bot-delivery-and-account-boundaries.md) | Durable bot output, explicit account roles and private diagnostics | D6–8, D10, D11, D17 |
| [0010](0010-explicit-empty-account-bot-conversion.md) | Named, one-use confirmation for an empty creator's bot conversion | D6–8, D11, D17 |
| [0011](0011-superseded-presentation.md) | Superseded presentation decision; see ADR 0033 | D3–5, all C1–C13 |
| [0012](0012-scoped-world-records.md) | Complete paginated world records and consent-scoped incoming previews | D5, D7, D10, D16, all C1–C13 |
| [0013](0013-versioned-cooperation.md) | Immutable cooperation rules, bounded allocation and explicit vote freezing | D9, D11, D15–16, all C1–C13 |
| [0014](0014-durable-episode-policy.md) | Persisted phase deadlines, worker fencing and scoped input recovery | D5, D7–11, D15–17, all C1–C13 |
| [0015](0015-cinematic-game-presentation.md) | Superseded presentation decision; see ADR 0033 | D3–5, all C1–C13 |
| [0016](0016-live-verification-and-tunnel.md) | Credential-safe live tunnel, exact origin adoption and genuine verification boundaries | D6–8, D13, D17, all C1–C13 |
| [0017](0017-bounded-input-and-history.md) | Persisted input admission, fair work and indexed public history | D7–11, D16–17, all C1–C13 |
| [0018](0018-encrypted-recovery.md) | Authenticated consistent backup and isolated verified restore | D7–8, D10–11, D13, D16–17, all C1–C13 |
| [0019](0019-release-runtime-boundaries.md) | Strict release configuration, browser policy, feed bounds and process recovery | D2, D5, D7, D10–11, D13, D17, all C1–C13 |
| [0020](0020-release-container.md) | Reproducible non-root application image and CI smoke | D1–3, D7–8, D11–13, D17, all C1–C13 |
| [0021](0021-current-static-assets.md) | Current hashed public assets without restart; missing assets stay outside SPA fallback | D2–3, D5, D11, D13, D17, all C1–C13 |
| [0022](0022-encounter-presentation.md) | Superseded presentation decision; see ADR 0033 | D3–5, D9, D11, D15–17, all C1–C13 |
| [0023](0023-cinematic-startup.md) | Superseded presentation decision; see ADR 0033 | D3–4, D11, D15–17, all C1–C13 |
| [0024](0024-preview-connection-recovery.md) | JSON transport, honest initial connection and read-only reconnect after uncertain responses | D2–3, D5, D8, D11–13, D17, all C1–C13 |
| [0025](0025-readme-experience.md) | Superseded presentation decision; see ADR 0033 | Documentation tooling, all C1–C13 |
| [0026](0026-versioned-preview-releases.md) | Aligned private app versions, explicit preview tags, release notes and source verification | Release metadata, all C1–C13 |
| [0027](0027-recover-participation-and-overlay.md) | Durable chat-loss pause, admitted-work drain and read-only overlay reconnection | Recovery, all C1–C13 |
| [0028](0028-local-revocation-and-bot-diagnostics.md) | Session-scoped self-revocation and honest private bot outcomes | Identity/observability, all C1–C13 |
| [0029](0029-independent-replies-and-database-budgets.md) | Independent outbound replies and bounded runtime/maintenance database work | Reliability/operations, all C1–C13 |
| [0030](0030-spatial-hud-and-saved-controls.md) | Superseded presentation decision; see ADR 0033 | Presentation/reliability, all C1–C13 |
| [0031](0031-livewire-v0.md) | Finite, versioned missions in the persistent Ark; isolated release boundary | Gameplay/participation/custody, all C1–C13 |
| [0032](0032-final-frontend-replacement.md) | Archive rejected visuals and replace one presentation entry while retaining real session/game/overlay behavior | Presentation/controller boundary, all C1–C13 |
| [0033](0033-figma-v2-presentation.md) | Preserve the final ten-screen Figma design, corrected shared Ark and Minecraft scene with real state | Presentation/rendering, all C1–C13 |
| [0034](0034-dashboard-feed-recovery.md) | Recover authenticated dashboard SSE feeds after transient failures without accepting stale authority | Recovery/presentation, C1–C13 |
| [0035](0035-relay-rehearsal-and-attributed-inheritance.md) | Guided practice relay through public endpoints, attributed inheritance dossier, lineage view and finished-voyage release | Custody/presentation/recovery, all C1–C13 |
| [0036](0036-public-chronicle-links.md) | Revocable, hash-stored public Chronicle links so communities can follow an Ark across channels | Access/privacy/presentation, all C1–C13 |

The [component stress review](../architecture/decision-stress-review.md) evaluates all choices across all component boundaries. The [validation plan](../planning/validation.md) defines the future evidence needed to accept their runtime behavior.

For a new ADR, record context, decision, strongest alternative, consequences, dependencies, validation and revisit trigger. Link relevant requirements, component matrix rows and sources. Do not replace an explicit user preference with a local guideline.
