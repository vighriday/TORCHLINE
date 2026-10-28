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

Recorded an isolated actual-engine simulation: scanned all relays, submitted a valid route, received the canonical reward, committed a navigation sacrifice and entered chapter 2. Persistent navigation loss and the changed encounter survive the transition. The first 27-second software sample measured 19 FPS at DPR 0.5; this is a constrained capture sample, not hardware/native OBS acceptance. Actual public HTTPS overlay verification also passes with the owner's live world, zero controls/private diagnostics and denied creator writes; genuine chat counters remain zero.
