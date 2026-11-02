# ADR 0042 — LIVEWIRE presets use generic names

Date: 2026-11-02. Status: Accepted. Amends [ADR 0037](0037-cross-game-livewire-relay.md).

## Context

Two of the three LIVEWIRE practice presets were labelled with real game titles. The hackathon rules exclude third-party trademarks from the submission. The presets only pick an illustrated practice scene; the streamer always names the game they actually play, so the labels never needed a real title.

## Decision

1. The presets are now **Voxel Survival**, **Car Soccer** and **Souls Run**. The Judge Arena script, its introduction and every test use the same generic names. Internal scene keys (`voxel`, `rocket`, `souls`) are unchanged.
2. Documentation, ADRs and the changelog describe the scenes generically.
3. README stills captured before the rename have the old names blurred, and the two README animations that showed them were retired in favour of stills that link to the same moments in the video. The demo video blurs the names too.

## Consequences

- No behaviour, rule or saved data changes: missions store the free-text game name, and older practice worlds keep whatever name they were given.
- New captures show the generic names directly.
