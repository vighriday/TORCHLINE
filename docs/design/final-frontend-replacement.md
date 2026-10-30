# Final frontend replacement

October 30, 2026. **Final design supplied; adaptation and visual cutover in progress.** `frontend-design/figma-v2` is the only visual source, including all ten screens, Ark/cockpit and Minecraft-style LIVEWIRE scene. This document inventories behavior to preserve; it does not prescribe another visual direction.

## Working location and recovery

- Branch: `feat/frontend-replacement`, based on verified source `663888a`.
- Worktree: `E:\Projects\TORCHLINE\.local\worktrees\frontend-replacement`.
- Archived source: Git tag `archive/frontend-before-final-2026-10-30`.
- Ignored local archive: `E:\Projects\TORCHLINE\.local\archives\frontend-2026-10-30`, including checksums and UI-LAB dirty work. UI-LAB itself is left intact.
- Final export: ignored `E:\Projects\TORCHLINE\frontend-design\figma-v2`. Keep it untouched. Reviewed adaptations/assets and license/provenance records become tracked source.

The existing practice preview remains on port 3103. Replacement configuration reserves loopback port 3104 and the separate `frontend_replacement_preview` simulation schema, with independent local secrets and no Twitch credentials. It does not switch the live release or real Ark. Do not use the UI-LAB fixture server for functional verification.

## Integration foundation

[main.tsx](../../apps/web/src/main.tsx) only mounts one frontend. [ReferenceFrontend](../../apps/web/src/ReferenceFrontend.tsx) temporarily owns current markup and the five existing global stylesheet imports. [useTorchlineSession](../../apps/web/src/useTorchlineSession.ts) owns session snapshots, current-creator SSE, scoped overlay lifecycle, fragment replacement, busy/error handling, explicit reconnect and versioned command submission. The hook imports no presentation component or stylesheet. Its local setters are existing reference-controller behavior, not server authority. New presentation components receive state and action callbacks; the server still validates every mutation.

The extraction deliberately retains existing lifecycle semantics. It does not claim to fix inherited A07 participant/history amplification or A11 global HTTP/SSE ordering concerns. Remaining endpoint callbacks are still in the reference entry and records/history consumers; migrate them deliberately with the matching final screens.

## Required surface map

| Surface | Real behavior to carry over | Required alternate states |
| --- | --- | --- |
| Entry/onboarding | Creator OAuth, practice launch, resume/create, mode disclosure | Initial connection, signed-out, no world, saved world, HTML/upstream failure, retry |
| Creator/account setup | Bot operator authorization/conversion, subscription readiness, self-disconnect, sign-out | Missing configuration, pending consent, failed/revoked grant; no secret disclosure |
| Main game | All phases, legal choices, exact costs, warnings, spectator context | Ready, investigation, allocation, voting, awaiting commit, ending; all three endings |
| Cooperative play | Existing clue graph, scan/path/patch, crew work/allocation and ballot commands | Unknown clues, progress, success/failure, closed/expired input |
| Captain controls | Start/close/commit, saved timing, pause/resume, parking | Busy, insufficient resources, stale version, lost response, changed custody |
| LIVEWIRE | Open/pause/resume, three target counts, explicit lock, solo, attestation, cancellation | No votes, ties, unavailable system, timeout, paid allowance, reload and result |
| Ark/physical condition | All seven stable system IDs, exact resources, scars and semantic cues | Pristine, sacrificed navigation, leaking, repaired scars, lost cargo, inherited, wreck |
| Hangar | Real world library, read saved records, park/resume | Empty library, parked/terminal worlds, no active slot, authority failure |
| Archive | Paginated history, choices, consequences and inherited cause links | Empty/loading/error, multiple pages, same Ark after host change |
| Relay/handoff | Opt-in, current recipients, preparation, temporary preview, accept/decline/cancel | No receiver, expiry, missing native proof, changed source, unresolved mission; simulation labeled |
| Broadcast setup | Actual scoped link generation/rotation, full/compact/auto destinations | Private link handling, no active Ark, reconnect, revoked grant, replacement fragment |
| OBS/spectators | Transparent read-only render, ship/phase/mission updates, chat instructions | 720p/1080p, first load, hidden source, reconnect, source reload, expired/rotated access; zero host controls |

Use the [versioned frontend contract](../architecture/frontend-contracts.md), [LIVEWIRE rules](../product/livewire-v0.md) and engine-generated [physical-state fixtures](README.md). Renderer choice, user-facing names, art and layout may change with the final design; canonical system IDs, real outcomes, event provenance and authority cannot be inferred from artwork.

## Cutover sequence

1. Inventory the complete final export: screens, breakpoints, styles, assets/fonts/licenses, motion/audio, focus/keyboard and empty/error states. Separate artwork/markup from prototype data and handlers. Record exact source checksums; do not run unreviewed export scripts or install dependencies merely because the export names them.
2. Map each surface above to the new design. Extend absent functionality using that design's tokens, spacing, components and motion language. A missing design screen must not hide or remove an existing working capability.
3. Adapt to strict TypeScript/React and real DTOs/actions. Retain the current stack and controller boundaries; do not transplant simulated votes, missions, account labels or fictional telemetry as real state.
4. Replace the single presentation entry. Remove retired component/style imports and then obsolete source/assets after checking all consumers, including README/media tools. Load one design system. Do not publish a placeholder page, stack old and new roots or retain a visible old/new switch.
5. Review every route and alternate state at 390px mobile, 1280×720 and 1920×1080, with long text, scrolling, keyboard/focus, reduced motion and lost/replaced connections. Inspect hit targets/overlaps and passive spectator readability. Effects remain interruptible, bounded and independent of outcome acknowledgement.
6. Run existing engine/SQL/API/security/backup tests and full browser journeys. Update selectors only to match intentional semantic changes, preserving assertions about saved effects, authority, recovery and read-only sources. Recheck native OBS transparency, performance, source refresh and link rotation on the actual final build.
7. Update the implementation report, asset provenance, changelog and screenshots with exact evidence. Keep simulated activity, native OBS, genuine Twitch gameplay and native raid proof distinct. Promote the replacement only after functional and visual checks, leaving the archive recoverable.

## Current evidence

The extracted session/reference boundary passes a fresh build, 134 automated tests in 31 files and all 16 browser journeys. Its CSS output is unchanged. This verifies preservation of existing behavior, not final-design fidelity. The supplied design's adaptation, appearance and OBS performance require fresh acceptance after cutover; no new genuine Twitch or raid claim is made.
