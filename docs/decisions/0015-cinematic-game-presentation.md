# 0015 — Restore the supplied cinematic game presentation

Accepted 2026-10-27 following the owner's screenshot review. The previous integration retained useful controls but reduced the supplied title/flight choreography to a scrolling dashboard. The product needs a playable, ship-centered screen and authored visual consequences. Claude Design remains the art-direction source; its prototype engine, fictional accounts and client timers remain excluded.

## Renderer foundation

`ark-model.ts` adapts the supplied modular geometry, locally generated metal/glow textures, atmosphere, habitat windows and shield shell into typed Three.js. Canonical conditions and permanent marks determine missing hull plates, destroyed navigation, sealed habitat sectors, life-support leaks and detached cargo. Repair scars retain event-derived placement across reload and custody. Oxygen failure does not explode an intact hull.

`ark-scene.ts` adds bounded cosmetic chapter environments, scan/repair sweeps, sparks/vapor, camera settling and chapter-entry warp. Its API accepts the existing physical state plus optional public chapter/events. Initial histories are baselined, event IDs deduplicated, and a reconnect containing more than three new historical events skips spectacle rather than replaying an explosion backlog. Cosmetic effects never publish commands or change resources. A 320-particle cap, instanced stars/environment/window/plate geometry, 30-FPS scheduling and maximum DPR 1.5 bound work. Sustained low measured frame rate reduces render resolution to a 0.5 floor. Context loss and reduced motion retain SVG/DOM; hidden/offscreen work stops. Cleanup disposes unique geometry, material and texture resources.

The foundation was delivered separately in `bff4851`; its [GitHub workflow](https://github.com/vighriday/TORCHLINE/actions/runs/40538369570) passed. That renderer-only milestone did not complete the title/flight experience.

## Consumer rollout

`TitleScreen` restores the supplied metallic title, vessel composition and keyboard launch. Its neutral unsaved Ark is explicitly labeled. Launch uses actual server-side simulation creation or the existing live OAuth route. Captain selection, account tools and operator bot setup retain their original permissions and are placed in accessible disclosures. Reduced-motion preference persists locally and the operating-system preference is respected.

`FlightDeck` replaces the scrolling Bridge with the ship-centered game, chapter objective, six real resource meters, phase clock, cooperative investigation/allocation/puzzle and decision cards. Votes and previews come from the server. Recorded semantic events drive scans, repair sweeps, sacrifice/damage effects and transient consequence banners. The puzzle graph is foregrounded; reward detail and keyboard route entry remain expandable. At narrow sizes the layout flows vertically instead of scaling a fixed desktop canvas. Archive, Hangar, Relay and Broadcast setup remain available through navigation.

The broadcast consumer uses the same scene and HUD with no mutation controls, simulator or creator settings. It retains actual command guidance, votes, resource consequences, a known hazard warning and ending reason. Persistent condition renders on initial load and after transfer; reconnect/reload does not replay old spectacle. A dedicated custody-arrival animation remains future work and cannot substitute for native proof.

Browser checks found and corrected two interaction defects: native disclosure state carried across account changes, and an open simulator drawer covered the next decision. Account disclosures now have distinct identities; phase changes close the simulator drawer. Input tests wait for the canonical phase acknowledgement before opening the next drawer. No force-click bypass is used.

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

Initial 1365×768 Chromium renders show the restored title/model and real challenge/commit screens without page errors. The first software-rendered full-screen sample measured only six FPS at full resolution, motivating adaptive resolution. A later single-scene sample after twelve seconds measured 22 FPS at DPR 0.5, with 62 draw calls, 18,724 triangles and no active particles. This is a measured software fallback sample, not a universal frame-rate or hardware/OBS pass. Cold software WebGL startup receives a separate bounded wait in the browser journey; the schematic stays visible until first paint.

The dedicated cinematic journey verifies keyboard launch, graphics/motion toggles, actual discovery and sacrifice cues, bounded particle/DPR telemetry and saved damage without historical effect replay. Existing journeys cover mobile cooperation, keyboard route entry, all seven physical-state fixtures at 720p/1080p, graphics failure, readonly overlays, bot onboarding and consented simulated inheritance. Real native OBS, hardware/mobile playtesting, restored public HTTPS and genuine chat/raid acceptance remain external gates. Repository and configured-secret artifact scans cover the rollout; an offline public origin is not reported as a public security pass.

The completed local rollout passes build/typecheck, all 77 tests across twelve files and all seven browser journeys in one final run. Earlier parallel validation hit a bot-fixture timeout; the full sequential rerun passed without altering the test or its timeout. Both local origins pass readiness and serve the matching JavaScript/CSS asset hashes after restart. The original private input hash is unchanged and private inputs/design originals remain ignored and absent from the index.
