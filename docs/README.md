# Documentation

**Current: [v0.1.0-preview.4](releases/v0.1.0-preview.4.md).** It hosts a disposable practice demo at https://torchline-demo.onrender.com ([ADR 0039](decisions/0039-hosted-practice-demo.md)) and fixes native raid readiness. [v0.1.0-preview.3](releases/v0.1.0-preview.3.md) added the Judge Arena relay rehearsal (two practice communities, two LIVEWIRE games, labelled simulated raid proof), the attributed inheritance dossier, Chronicle lineage, revocable public Chronicle links, *What if?* one-step alternatives, *Verify this record* replay digests, per-preset LIVEWIRE feeds and a one-command Docker preview that CI starts on every push. [ADR 0035](decisions/0035-relay-rehearsal-and-attributed-inheritance.md) · [ADR 0036](decisions/0036-public-chronicle-links.md) · [ADR 0037](decisions/0037-cross-game-livewire-relay.md) · [ADR 0038](decisions/0038-one-step-decision-alternatives.md).

All ten screens of the final Figma v2 frontend use actual saved state. Promotion of source does not deploy a live service or close owner/provider acceptance gates; nothing is deployed. [Current implementation status](planning/implementation-status.md) · [Final design](design/README.md) · [Cutover](design/final-frontend-replacement.md) · [ADR 0033](decisions/0033-figma-v2-presentation.md). As of 30 October 2026: [main consolidation and preview.2](reports/2026-10-30-main-consolidation.md) · [final frontend implementation and evidence](reports/2026-10-30-final-frontend.md).

Genuine viewer chat → saved gameplay was observed on 30 Oct. On 2 Nov a recorded overlay update from live chat, visible bot replies ([ADR 0040](decisions/0040-bot-moderator-role.md)) and a live attested LIVEWIRE result were verified. Native raid transfer and permanent hosting remain open. [October 29 diagnosis](reports/2026-10-29-integration-diagnosis.md) and [critical audit](reviews/2026-10-29-comprehensive-audit.md) retain historical provider/security evidence. [LIVEWIRE rules](product/livewire-v0.md) and [acceptance](operations/livewire-v0.md) describe the default-off extension.

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
| [Hackathon plan](planning/hackathon.md) | Dated planning record: organizer requirements, schedule conflict, demo, and evidence |
| [Development guide](operations/development.md) | Runnable saved practice, the one-command Docker preview, configuration, checks and privacy rules |
| [Deployment runbook](operations/deployment.md) | Proposed hosting, configuration, operations, and recovery |
| [Versions and releases](operations/releases.md) | Preview tags, seven-package alignment, release notes and immutable source snapshots |
| [Backup and restore](operations/backup-and-restore.md) | Encrypted snapshots, isolated recovery, replay checks and external durability gates |
| [Decision register](decisions/README.md) | Architecture decisions, status and revisit triggers |
| [Changelog](../CHANGELOG.md) | Meaningful project changes |
| [October 29 integration diagnosis](reports/2026-10-29-integration-diagnosis.md) | Account/channel/application evidence, independent reply degradation, SQL recovery and actual native OBS rendering |
| [October 27 continuation report](reports/2026-10-27-continuation.md) | Completed gameplay/timing/recovery/history, fixed CI failure, exact native evidence and remaining work |
| [Final Figma v2 design](design/README.md) | Renderer interfaces and seven engine-derived physical-state fixtures |
| [Twitch account setup](operations/twitch-setup.md) | Owner registration, local configuration and live verification steps |
| [Owner launch walkthrough](operations/owner-launch-guide.md) | Ordered beginner steps with current setup, exact confirmations, hosting and OBS |
| [Essential live release checklist](operations/live-release-checklist.md) | Current SSH recovery, exact OAuth, real chat/bot, OBS and two-creator native raid steps |
| [Existing-account live test](operations/controlled-account-live-test.md) | Verify chat/gameplay/OBS now with the owner's broadcaster and bot accounts; add a second broadcaster only for the authentic raid |
| [October 28 release readiness](reports/2026-10-28-release-readiness.md) | Executed reliability/security/container evidence and remaining external release gates |
| [Balance evidence](reports/balance-ark-v2.json) | Exhaustive ark-v2 authored-choice/challenge enumeration and ending witnesses; current ark-v3 rules use the bounded exploration in `tests/balance-v3.test.ts` |
| [Public capability and authority review](reviews/2026-10-26-public-authority.md) | All route/component boundaries, four reproduced defects, evidence and pruning recommendations |

The local source concept remains outside version control. No document in this index requires it to run, test, or judge the application.
