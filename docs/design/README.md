# Claude Design handoff

This directory contains semantic data fixtures for the final visual experience. The current React UI is a functional reference, not the approved visual design.

Start with [the presentation contract](../architecture/frontend-contracts.md), then inspect the generated fixtures:

- [Pristine Ark](fixtures/pristine.json)
- [Sacrificed navigation](fixtures/navigation-sacrificed.json)
- [Leaking life support](fixtures/leaking.json)
- [Repaired machinery with persistent scars](fixtures/repaired-with-scars.json)
- [Jettisoned cargo](fixtures/cargo-jettisoned.json)
- [Same Ark inherited by another host](fixtures/inherited.json)
- [Wreck](fixtures/wreck.json)

Regenerate with `pnpm design:fixtures`. Every fixture is labeled simulation and produced by actual engine commands. Preserve the schema version, stable system IDs, integrity, condition, severity, scar/event IDs, challenge constraints, exact choice previews and phase capability flags. `worldVersion` is the application/custody revision; `gameVersion` sequences immutable gameplay events.

The replaceable components are `ArkView` and `ChallengeView` in `apps/web/src`. The controller owns HTTP commands and SSE updates. Final components should accept presentation props and callbacks, respect reduced motion, and never invent state, call Twitch, or use animation completion to resolve outcomes.

Design for both participants and spectators. The current crisis, objective, effects of the last action, permitted commands and imminent risks should be understandable on a 720p stream. Mobile Twitch viewers participate in ordinary chat. They must not need to solve a drag puzzle or open a second authenticated application.
