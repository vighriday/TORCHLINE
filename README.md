# TORCHLINE

**The stream ends. The world doesn't.**

TORCHLINE is a persistent cooperative Twitch experience. A creator and their chat change a shared world; a native Twitch raid can pass that world to another consenting creator, carrying its damage, resources, history, and unresolved consequences.

The first season, **The Ark Protocol**, follows a damaged colony ship through five branching chapters. The product's defining moment is the receiving community discovering that another community's earlier decision has become its responsibility.

## Project status

Architecture approved and the first functional gameplay slice implemented on **October 26, 2026**. The reference application runs locally with PostgreSQL: complete five-chapter gameplay, cooperative investigation/challenges/allocation, persistent physical damage/repairs, combined choice previews, persisted phase timing and recovery, complete history, overlays and isolated simulated custody transfers. New Arks use ark-v3; existing worlds retain ark-v2 replay semantics.

Claude Design exports are integrated into a cinematic title, ship-centered React flight deck, cooperative challenges, read-only broadcast HUD, Relay, Hangar and Archive. Canonical chapter/events and persistent condition drive bounded ship effects; SVG remains the accessible/mobile fallback. Release hardening adds persisted input limits/fairness, indexed history, encrypted restore drills, strict runtime/security/feed boundaries and a CI-verified non-root image. Real grants/subscription metadata and earlier signed challenges are verified; **current HTTPS is offline pending SSH public-key registration after native ngrok was quarantined**. Genuine chat/replies, actual OBS and a native raid remain acceptance gates. Start with the [live checklist](docs/operations/live-release-checklist.md) and [release report](docs/reports/2026-10-28-release-readiness.md).

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
| [Claude Design handoff](docs/design/README.md) | Stable renderer interfaces and seven real-engine state fixtures |
| [Twitch setup](docs/operations/twitch-setup.md) | Account registration, local secrets, OAuth and live verification |
| [Owner launch guide](docs/operations/owner-launch-guide.md) | Exact ordered steps, current account status, hosting, OBS and live acceptance |

## Run the functional slice

Prerequisites: **Node 24** (see `.node-version`), pnpm 12.4.2, and PostgreSQL 17 binaries. On this Windows machine, PostgreSQL is already installed; the local helper creates its own password-protected cluster on `127.0.0.1:54329` and leaves the existing database service alone.

```powershell
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:migrate
pnpm build
pnpm dev
```

Open **http://localhost:3000** and choose **Launch the Ark** (or press Enter). This opens an actual saved simulation as alpha. **Choose another simulated captain** selects beta/gamma for separate local communities. Start a chapter, discover clues, submit a route or repair work order, and commit a choice. Crew/pacing settings and simulation chat are expandable controls. A raid is never needed to finish the season. Use separate browser profiles for two simulated creators when rehearsing custody. The receiver must opt in and have no active world.

On this workspace's original Node 22 installation, first select the checksum-verified local Node 24 runtime for the current shell: `$env:PATH = "$PWD\.tools\node24;$env:PATH"`. A clean checkout should install Node 24 normally. Stop this project's private database with `pnpm db:down`. `PG_BIN` can override the local PostgreSQL binary directory.

`pnpm db:up` creates an ignored `.env` for simulation with generated local credentials and keys. `pnpm live:prepare` creates the separate live database and `.env.live`; put Twitch configuration there as described in the [setup guide](docs/operations/twitch-setup.md). Do not overwrite generated keys with placeholders. Public hosting requires an appropriate HTTPS origin and, where needed, `HOST=0.0.0.0`; no deployment has occurred.

## Implementation

TypeScript throughout; React and Vite for the creator dashboard, OBS overlay, and lineage view; a long-running Fastify service for Twitch OAuth, signed EventSub webhooks, HTTP commands, and server-sent live updates; PostgreSQL with explicit SQL transactions for custody, snapshots, events, and durable work. The game engine is deterministic and independent of Twitch and raid delivery. Runtime generative AI is optional future work.

One deployment and one database keep operations manageable while preserving strong transaction boundaries. Modules can be extracted later when measured load warrants it.

## Repository layout

```text
apps/                 executable server and React command deck / OBS view
packages/             engine, contracts, storage and Twitch adapters
assets/               asset provenance and future original/licensed visuals
tests/                domain, concurrency, integration and browser tests
infrastructure/       future deployment and local-service definitions
docs/
  product/            requirements and game rules
  architecture/       runtime design, data model, interfaces
  research/           verified sources, Twitch findings, feasibility
  planning/           roadmap, backlog, stack, validation, submission
  operations/         development and hosting procedures
  decisions/          architecture decision records
```

The package boundaries above now contain executable modules. See [the status report](docs/planning/implementation-status.md) for implemented versus planned behavior, limitations, and verification evidence.

## Validate

```powershell
pnpm build
pnpm test
pnpm exec playwright install chromium --only-shell
pnpm test:browser
pnpm audit:legacy
pnpm audit:balance
pnpm design:fixtures
pnpm check:repo
```

Tests create disposable schemas inside the configured development database. They do not truncate existing worlds. Browser tests use isolated servers on ports 3100/3101 and separate schemas. GitHub Actions passed the initial gameplay milestone; later commits require their own CI results. Real chat, native raid and OBS verification remain separate gates. The [Twitch setup guide](docs/operations/twitch-setup.md) explains real-service checks and the public secret scan.

## Privacy and contribution

The original private concept file and `docs/internal/` are ignored by Git. Do not copy raw source notes into commits, issues, recordings, or submission attachments. Versioned specifications are curated planning documents. Keep all Twitch credentials, tokens, overlay capabilities, and local environment files out of Git.

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CHANGELOG.md](CHANGELOG.md). No open-source license has been selected; repository visibility does not grant a license to reuse the project.
