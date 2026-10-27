# 0015 — Restore the supplied cinematic game presentation

Accepted 2026-10-27 following the owner's screenshot review. The previous integration retained useful controls but reduced the supplied title/flight choreography to a scrolling dashboard. The product needs a playable, ship-centered screen and authored visual consequences. Claude Design remains the art-direction source; its prototype engine, fictional accounts and client timers remain excluded.

## Renderer foundation

`ark-model.ts` adapts the supplied modular geometry, locally generated metal/glow textures, atmosphere, habitat windows and shield shell into typed Three.js. Canonical conditions and permanent marks determine missing hull plates, destroyed navigation, sealed habitat sectors, life-support leaks and detached cargo. Repair scars retain event-derived placement across reload and custody. Oxygen failure does not explode an intact hull.

`ark-scene.ts` adds bounded cosmetic chapter environments, scan/repair sweeps, sparks/vapor, camera settling and chapter-entry warp. Its API accepts the existing physical state plus optional public chapter/events. Initial histories are baselined, event IDs deduplicated, and a reconnect containing more than three new historical events skips spectacle rather than replaying an explosion backlog. Cosmetic effects never publish commands or change resources. A 320-particle cap, instanced stars/environment/window/plate geometry, 30-FPS scheduling and maximum DPR 1.5 bound work. Sustained low measured frame rate reduces render resolution to a 0.5 floor. Context loss and reduced motion retain SVG/DOM; hidden/offscreen work stops. Cleanup disposes unique geometry, material and texture resources.

The foundation is delivered before the title/flight consumers. Those consumers must wire recorded cues, preserve all authenticated actions in accessible menus, keep OBS read only and make the puzzle readable in the viewport. They cannot claim completion from a renderer-only commit.

## Component stress review

| Component | Constraint / decision |
| --- | --- |
| C1 Identity | No identity or token reaches the renderer; existing account/session actions are preserved. |
| C2 Twitch | No prototype chat generator, CDN or competing integration. Native acceptance status remains explicit. |
| C3 Participation | HUD consumes actual clues, work orders, allocations and advisory totals; effects cannot create participation. |
| C4 Engine | Immutable game rules unchanged; renderer maps canonical conditions and real event cues. |
| C5 Episodes | Display existing server deadlines; no cinematic timeout advances a phase or commits a choice. |
| C6 Custody | Scars retain stable IDs; a visual arrival never constitutes native raid evidence or acceptance. |
| C7 Storage | No database or save migration. Procedural cosmetic randomness is outside transitions and cannot affect replay. |
| C8 Projection | Existing presentation fields; baseline/deduplicate/coalesce effects, do not replay old explosions. |
| C9 Dashboard | Game screen foregrounds ship/puzzle/choices; setup and simulation tools remain keyboard-accessible. |
| C10 OBS | Shared scene/HUD without mutation controls; 720p/1080p composition, real CEF performance still requires acceptance. |
| C11 History | Permanent marks and causes remain authoritative; menus retain complete records. |
| C12 Validation | Compare rendered screenshots, exercise semantic effects/reload, graphics failure and responsive controls; distinguish software Chromium from actual OBS. |
| C13 Operations | Same pinned Three.js, lazy local renderer, no new services/assets downloads; profile resolution adaptively and record limits. |

## Verification scope

Initial 1365×768 Chromium renders show the restored title/model and real challenge/commit screens without page errors. The first software-rendered full-screen sample measured only six FPS at full resolution, motivating adaptive resolution; that sample is not a performance pass. Consumer integration, its full browser regressions and post-adaptation measurements are recorded in the subsequent rollout. No actual OBS or native Twitch acceptance is implied.
