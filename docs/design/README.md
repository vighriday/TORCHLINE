# Claude Design handoff

**October 30: the owner is supplying a final replacement design.** The current interface and UI-LAB direction are archived references. Use the [final replacement checklist](final-frontend-replacement.md) and [ADR 0032](../decisions/0032-final-frontend-replacement.md); do not extend the old visual direction or combine its global styles with the incoming design. Functional contracts and generated physical-state fixtures below remain authoritative. Final design integration and visual acceptance are pending.

[LIVEWIRE v0](../product/livewire-v0.md) adds a functional mission workspace and compact/automatic read-only overlay. `WorldPresentation.livewire` exposes bounded tallies, a ballot revision, saved lifecycle/deadline, exact effects and solo/evidence labels; canonical outcome cues remain the existing damage/repair events. No voter roster or raw actor identity is projected. The optional renderer `detailsExpanded` setting changes initial disclosure only. Claude Design can replace the visual treatment without moving authority or game rules into components.

See the [October 28 encounter review](encounter-review.md) for the owner-requested game presentation revision, actual-motion checks and remaining visual/native acceptance. It retains this presentation contract and the original design vocabulary.

The owner-supplied Claude Design exports are now adapted into the typed React application. This directory contains the canonical fixtures and [integration review](integration-review.md); [ADR 0011](../decisions/0011-claude-design-integration.md) records the renderer boundaries. The ignored local `frontend-design/` workspace preserves the original exports; production does not load its runtime, simulator or fictional data. Actual OBS and owner visual/usability acceptance remain open.

Start with [the presentation contract](../architecture/frontend-contracts.md), then inspect the generated fixtures:

- [Pristine Ark](fixtures/pristine.json)
- [Sacrificed navigation](fixtures/navigation-sacrificed.json)
- [Leaking life support](fixtures/leaking.json)
- [Repaired machinery with persistent scars](fixtures/repaired-with-scars.json)
- [Jettisoned cargo](fixtures/cargo-jettisoned.json)
- [Same Ark inherited by another host](fixtures/inherited.json)
- [Wreck](fixtures/wreck.json)

Regenerate with `pnpm design:fixtures`. Every fixture is labeled simulation and produced by actual engine commands. Preserve the schema version, stable system IDs, integrity, condition, severity, scar/event IDs, challenge constraints, exact choice previews and phase capability flags. `worldVersion` is the application/custody revision; `gameVersion` sequences immutable gameplay events.

The replaceable components are `ArkView`, `ChallengeView` and the surfaces in `DeckViews` in `apps/web/src`. The controller owns HTTP commands and SSE updates. The Ark has shared SVG and lazy Three.js renderers; optional local visual preferences cannot modify canonical state. Components accept presentation props/callbacks, respect reduced motion and never call Twitch or use animation completion to resolve outcomes. Locally licensed fonts avoid runtime CDN requests.

Design for both participants and spectators. The current crisis, objective, effects of the last action, permitted commands and imminent risks should be understandable on a 720p stream. Mobile Twitch viewers participate in ordinary chat. They must not need to solve a drag puzzle or open a second authenticated application.
