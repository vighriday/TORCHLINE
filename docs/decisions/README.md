# Architecture decision records

All decisions below are **proposed for product/architecture review** as of 2026-10-26. They establish a coherent recommendation, not a claim that implementation or testing has occurred. Update status after review and record a replacement ADR when changing a material decision.

| ADR | Decision | Stress-review coverage |
| --- | --- | --- |
| [0001](0001-game-episodes-and-custody.md) | Separate persistent game, hosted episodes and custody | D15 |
| [0002](0002-typescript-modular-monolith.md) | TypeScript modular monolith and shared browser application | D1, D2, D3, D12 |
| [0003](0003-postgresql-transactions-and-history.md) | PostgreSQL, explicit SQL, durable work and replay history | D7, D8, D10, D16 |
| [0004](0004-native-twitch-integration.md) | Cloud bot webhooks and authentic consented raid transfers | D6, D17 |
| [0005](0005-presentation-and-live-delivery.md) | SVG/DOM presentation, SSE reads and HTTP commands | D4, D5 |
| [0006](0006-deterministic-gameplay-and-validation.md) | Deterministic authored gameplay and layered validation | D9, D11, D14 |
| [0007](0007-hosting-security-and-growth.md) | Always-on hosting, scoped access and evidence-led growth | D13, D17 |

The [component stress review](../architecture/decision-stress-review.md) evaluates all choices across all component boundaries. The [validation plan](../planning/validation.md) defines the future evidence needed to accept their runtime behavior.

For a new ADR, record context, decision, strongest alternative, consequences, dependencies, validation and revisit trigger. Link relevant requirements, component matrix rows and sources. Do not replace an explicit user preference with a local guideline.
