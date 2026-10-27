# Architecture decision records

ADRs 0001–0007 were approved for implementation on 2026-10-26. Their original proposed status describes the earlier planning snapshot; approval is recorded here. Runtime behavior still requires implementation evidence. Record a replacement ADR when changing a material decision.

| ADR | Decision | Stress-review coverage |
| --- | --- | --- |
| [0001](0001-game-episodes-and-custody.md) | Separate persistent game, hosted episodes and custody | D15 |
| [0002](0002-typescript-modular-monolith.md) | TypeScript modular monolith and shared browser application | D1, D2, D3, D12 |
| [0003](0003-postgresql-transactions-and-history.md) | PostgreSQL, explicit SQL, durable work and replay history | D7, D8, D10, D16 |
| [0004](0004-native-twitch-integration.md) | Cloud bot webhooks and authentic consented raid transfers | D6, D17 |
| [0005](0005-presentation-and-live-delivery.md) | SVG/DOM presentation, SSE reads and HTTP commands | D4, D5 |
| [0006](0006-deterministic-gameplay-and-validation.md) | Deterministic authored gameplay and layered validation | D9, D11, D14 |
| [0007](0007-hosting-security-and-growth.md) | Always-on hosting, scoped access and evidence-led growth | D13, D17 |
| [0008](0008-balanced-consequences-and-physical-state.md) | Reachable catastrophe, meaningful challenge rewards and persistent physical state | D4, D9, D11, D14–16 |
| [0009](0009-bot-delivery-and-account-boundaries.md) | Durable bot output, explicit account roles and private diagnostics | D6–8, D10, D11, D17 |
| [0010](0010-explicit-empty-account-bot-conversion.md) | Named, one-use confirmation for an empty creator's bot conversion | D6–8, D11, D17 |
| [0011](0011-claude-design-integration.md) | Canonical React design integration and optional bounded cinematic Ark | D3–5, all C1–C13 |
| [0012](0012-scoped-world-records.md) | Complete paginated world records and consent-scoped incoming previews | D5, D7, D10, D16, all C1–C13 |
| [0013](0013-versioned-cooperation.md) | Immutable cooperation rules, bounded allocation and explicit vote freezing | D9, D11, D15–16, all C1–C13 |
| [0014](0014-durable-episode-policy.md) | Persisted phase deadlines, worker fencing and scoped input recovery | D5, D7–11, D15–17, all C1–C13 |

The [component stress review](../architecture/decision-stress-review.md) evaluates all choices across all component boundaries. The [validation plan](../planning/validation.md) defines the future evidence needed to accept their runtime behavior.

For a new ADR, record context, decision, strongest alternative, consequences, dependencies, validation and revisit trigger. Link relevant requirements, component matrix rows and sources. Do not replace an explicit user preference with a local guideline.
