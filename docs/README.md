# Documentation

Research checked **2026-10-26**. Architecture is approved and the first gameplay foundation is implemented. [Implementation status](planning/implementation-status.md) distinguishes tested local behavior from the wider target and external verification. Delivery follows dependencies and measured progress without assumed staffing or fixed development hours.

## Review sequence

1. [Product requirements](product/requirements.md) — what the product must deliver and why.
2. [Game design](product/game-design.md) — what a complete season feels like and how it resolves.
3. [Twitch integration](research/twitch-integration.md) — verified platform capabilities and limits.
4. [System design](architecture/system-design.md), [data/contracts](architecture/data-and-contracts.md), and [component decision review](architecture/decision-stress-review.md) — consistency, recovery, and trade-offs across all components.
5. [Technology](planning/technology.md), [roadmap](planning/roadmap.md), and [backlog](planning/backlog.md) — implementation decisions and order.
6. [Feasibility and risks](research/feasibility-and-risks.md) — what remains uncertain.

## Engineering and delivery references

| Document | Use |
| --- | --- |
| [Source register](research/sources.md) | Official references, verification date, findings and limitations |
| [Validation plan](planning/validation.md) | Engine, custody, security, load, UI, and real Twitch acceptance |
| [Hackathon plan](planning/hackathon.md) | Organizer requirements, schedule conflict, demo, and evidence |
| [Development guide](operations/development.md) | Repository structure, future local setup, fixtures, privacy checks |
| [Deployment runbook](operations/deployment.md) | Proposed hosting, configuration, operations, and recovery |
| [Decision register](decisions/README.md) | Proposed architecture decisions and revisit triggers |
| [Changelog](../CHANGELOG.md) | Meaningful project changes |
| [Claude Design handoff](design/README.md) | Renderer interfaces and seven engine-derived physical-state fixtures |
| [Twitch account setup](operations/twitch-setup.md) | Owner registration, local configuration and live verification steps |
| [Owner launch walkthrough](operations/owner-launch-guide.md) | Ordered beginner steps with current setup, exact confirmations, hosting and OBS |
| [Design integration review](design/integration-review.md) | Six-surface mapping, excluded prototype logic and thirteen-component stress review |
| [Balance evidence](reports/balance-ark-v2.json) | Exhaustive authored-choice/challenge enumeration and ending witnesses |
| [Public capability and authority review](reviews/2026-10-26-public-authority.md) | All route/component boundaries, four reproduced defects, evidence and pruning recommendations |
| [Design and launch authority review](reviews/2026-10-27-design-integration.md) | Integrated consumers, resolved visual defects, exact verification scope and deferred public HTTPS |

The local source concept remains outside version control. No document in this index requires it to run, test, or judge the future application.
