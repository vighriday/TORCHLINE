# Encounter presentation review — October 28

The owner found that the current frontend still felt like a landing page and utility panels. The visual revision keeps Claude Design's typography, modular vessel, cinematic/SVG paths and flight composition, with a stronger authored encounter and a clearer path into play. [ADR 0022](../decisions/0022-encounter-presentation.md) records the component review.

## What changed in the running game

- Radiation Storm now has a moving solar front/rays/glow; chapter atmosphere, sector readout and arrival transmission frame the ship as an encounter. Existing shoals, debris, planet, persistent leaks/scars and semantic effects remain in the same renderer.
- Ship-attached telemetry follows projected 3D positions. Captain inspection focuses the camera and shows actual system integrity, condition and permanent mark history without changing a save. The overlay displays passive labels.
- The mission names its immediate objective and keeps the actual reward visible. Pointer/keyboard relay scanning persists through the existing command path; discovered signal paths animate and reveal the actual clues. Route/work-order constraints remain unchanged.
- Crew Uplink explains where to participate, opens the broadcaster's actual Twitch popout and copies an eligible current command. It neither posts chat nor impersonates a viewer. Simulation remains visibly labeled and separate.
- Chapter transmission never blocks authoritative timing or grants rewards. Dismiss, reduced-motion, SVG/graphics-failure and mobile paths remain available. Reload renders current state without replaying old arrivals/explosions.
- Fixed public asset lookup so a rebuilt JS/CSS hash can load without restarting gameplay. Missing assets return 404 rather than HTML. This was a real delivery issue, separate from the visual review.

## Executed evidence

Build/typecheck, 91 automated tests and all eight Chromium journeys pass. New motion coverage compares actual composited canvas frames as well as frame progress; tests inspect canonical state before/after camera focus, scan a relay by keyboard and verify persisted clues/no replay after reload. Existing coverage retains full solo/cooperative decisions, physical-state fixtures, read-only overlay, simulated inheritance and fixture-provider bot setup. These are automated/local simulation results, not genuine Twitch chat or OBS CEF.

Ignored review frames/recordings are under `.local/game-review/`; original design inputs remain ignored and unmodified. User visual acceptance is still required. Do not label the software-rendered sample a universal FPS, hardware or OBS performance guarantee.

Recorded a 29-second isolated actual-engine simulation: scanned all relays, submitted a valid route, received the canonical reward, committed a navigation sacrifice and entered chapter 2. Persistent navigation loss and the changed encounter survive the transition. Software-recorded samples measured 15–19 FPS at DPR 0.5; these are constrained capture samples, not hardware/native OBS acceptance. Actual public HTTPS overlay verification also passes with the owner's live world, zero controls/private diagnostics and denied creator writes; genuine chat counters remain zero.

Final accessibility/command review carries the title's saved reduced-motion preference through all flight-deck CSS effects and keeps work-order command suggestions behind the actual repair prerequisites. The browser journey checks stored and operating-system motion preferences separately. Canonical rules still enforce every command independently of suggestions.

Encounter milestone `b1574e9` passes [CI 40732891048](https://github.com/vighriday/TORCHLINE/actions/runs/40732891048), including 91 tests, all eight browser journeys, fixture consistency and release-image smoke. Public JS/CSS bytes match that source's production build. This evidence establishes delivery and automated behavior; it does not establish owner visual acceptance or native OBS performance.

## Startup polish follow-up

The owner then identified a transient full-size schematic before 3D and raw parser text on the title. [ADR 0023](../decisions/0023-cinematic-startup.md) replaces that flash with explicit loading, first-frame fade and intentional accessible fallback. Scene dimensions stay stable and system markers wait for their first projected position. Mobile/reduced-motion, explicit schematic and graphics failure remain valid fallback paths.

[ADR 0024](../decisions/0024-preview-connection-recovery.md) fixes the independently reproduced ngrok HTML response with its documented host-scoped API header and sanitized JSON handling. Initial connection no longer presents a false launch/mode before state arrives. Retry reads the current save and reattaches the live feed; it cannot replay a mutation. Overlay waiting copy and the launch button's accessible name are corrected.

Source `f1a8d4c` passes local build/typecheck, 97 automated tests and 11 browser journeys. The affected three-page custody/mobile journeys also pass after separating their software-GPU work from dedicated motion tests. A real fresh anonymous Chromium profile completed the normal ngrok visit flow without a global request-header override: both application API calls returned JSON with the app's own preview header, 3D became ready, no parser/page errors appeared and no mutation was sent. Actual public overlay still reads the live Ark with zero controls/private diagnostics and denied writes. Source CI is recorded separately; this is Chromium evidence, not native OBS or Twitch gameplay proof.

The same source passes [CI 40738778152](https://github.com/vighriday/TORCHLINE/actions/runs/40738778152), including all 97 tests/11 journeys, fixtures and restricted release-image smoke. No source assertion was disabled or timeout enlarged to obtain this result.
