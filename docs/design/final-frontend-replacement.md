# Final frontend cutover

Subsequent source consolidation: [preview.2 and main](../reports/2026-10-30-main-consolidation.md). The isolation statements below describe the original cutover; all preserved feature history is included in the consolidated baseline.

Worktree: feat/frontend-replacement, based on the verified LIVEWIRE source 663888a. The original release and UI-LAB worktree remain untouched. The owner-supplied figma-v2 export is the only design source. Its raw files are ignored and unchanged.

## Preservation

The archive tag archive/frontend-before-final-2026-10-30 retains the prior published implementation. Ignored local ZIP/bundle/patch archives preserve presentation assets and the unrelated UI-LAB work, including its uncommitted files. No archive or raw/private input is staged. The final application has one entry and no appearance switch or competing stylesheet.

All ten supplied destinations, Ark/cockpit, voxel scene, original typography, controls and animations are retained as typed adaptations. The car-soccer and boss-courtyard LIVEWIRE feeds were wired in after this cutover ([ADR 0037](../decisions/0037-cross-game-livewire-relay.md)). Existing engine, SQL, Twitch roles, auth, HTTP/SSE and historical replay remain the functional foundation. Missing challenge/account/recovery/history states use the supplied design tokens. [Surface map](README.md) · [contract](../architecture/frontend-contracts.md).

## Verification gates

- Real saved chapter, cooperation, allocation, commit and inherited damage.
- Supply-cost LIVEWIRE mission (one in-game supply), count/lock/reload/attest, one physical consequence, replay and OBS.
- Creator/bot separation, operator confirmation and server authority.
- Initial HTML failure, lost response, read-only reconnect, overlay rotation/revocation.
- All ten screens, seven physical fixtures, mobile/720p/1080p, keyboard/settings and unobstructed controls.
- Actual moving pixels, cold scene loading, graphics failure/retry, static reduced-motion scene.
- Fresh final-build native OBS, owner visual acceptance, genuine chat-driven effects and native raid remain independently assessed.

At the 30 Oct cutover the final-design regression passed 134 automated tests and all 15 browser journeys locally, plus an affected voxel repeat with real voxel readiness. As of 1 November 2026, 164 Vitest tests in 43 files on real PostgreSQL and 25 Playwright journeys pass, with CI green. Native OBS 32.2.2 rendered the 30 Oct final-design build in isolated saved practice; the current build is not re-verified in OBS. Earlier presentation evidence is not reused as final-design acceptance. Media is captured only after removing the blue bridge panel. The release assessment records executed results without promoting simulation to provider evidence.

TORCHLINE's practice scenes are original illustrations and never read game data.
