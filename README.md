# TORCHLINE

**The stream ends. The world doesn't.**

TORCHLINE is a persistent cooperative Twitch experience. A creator and their chat change a shared world; a native Twitch raid can pass that world to another consenting creator, carrying its damage, resources, history, and unresolved consequences.

The first season, **The Ark Protocol**, follows a damaged colony ship through five branching chapters. The product's defining moment is the receiving community discovering that another community's earlier decision has become its responsibility.

## Project status

Research, product planning, and repository setup completed on **October 26, 2026**. Architecture and scope are proposed for review. **There is no application implementation, deployment, or completed live integration test yet.**

The plan covers the full product vision and a progressively expanding hackathon build. It assumes no fixed team size or development-hour budget. Access to two consenting broadcasters remains an external dependency.

Repository: [vighriday/TORCHLINE](https://github.com/vighriday/TORCHLINE).

## Start the review here

| Document | Purpose |
| --- | --- |
| [Product requirements](docs/product/requirements.md) | Experience, scope, acceptance criteria, full product direction |
| [Game design](docs/product/game-design.md) | Five chapters, participation, branching consequences, endings |
| [System design](docs/architecture/system-design.md) | Runtime boundaries, custody transfer, recovery, deployment shape |
| [Twitch integration research](docs/research/twitch-integration.md) | APIs, grants, subscriptions, delivery limitations, feasibility gate |
| [Technology choices](docs/planning/technology.md) | Stack, alternatives, and trade-offs |
| [Component decision review](docs/architecture/decision-stress-review.md) | Every proposed architectural choice checked across component boundaries |
| [Roadmap](docs/planning/roadmap.md) | Dependency gates and progressive delivery before submission |
| [Feasibility and risks](docs/research/feasibility-and-risks.md) | Unproven assumptions, external dependencies, mitigations |
| [Documentation index](docs/README.md) | Complete documentation map |

## Proposed implementation

TypeScript throughout; React and Vite for the creator dashboard, OBS overlay, and lineage view; a long-running Fastify service for Twitch OAuth, signed EventSub webhooks, HTTP commands, and server-sent live updates; PostgreSQL with explicit SQL transactions for custody, snapshots, events, and durable work. The game engine is deterministic and independent of Twitch and raid delivery. Runtime generative AI is optional future work.

One deployment and one database keep operations manageable while preserving strong transaction boundaries. Modules can be extracted later when measured load warrants it.

## Repository layout

```text
apps/                 planned server and browser application boundaries
packages/             planned engine, contracts, storage, Twitch adapters
assets/               asset provenance and future original/licensed visuals
tests/                planned fixtures, concurrency, integration, browser tests
infrastructure/       future deployment and local-service definitions
docs/
  product/            requirements and game rules
  architecture/       runtime design, data model, interfaces
  research/           verified sources, Twitch findings, feasibility
  planning/           roadmap, backlog, stack, validation, submission
  operations/         development and hosting procedures
  decisions/          architecture decision records
```

These directories currently contain planning notes, not executable scaffolding. Installation commands, dependencies, CI, and environment templates will be added with the first implementation phase and verified before they are advertised as working.

## Privacy and contribution

The original private concept file and `docs/internal/` are ignored by Git. Do not copy raw source notes into commits, issues, recordings, or submission attachments. Versioned specifications are curated planning documents. Keep all Twitch credentials, tokens, overlay capabilities, and local environment files out of Git.

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CHANGELOG.md](CHANGELOG.md). No open-source license has been selected; repository visibility does not grant a license to reuse the project.
