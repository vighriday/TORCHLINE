# 0023 — Deliberate cinematic loading and explicit fallback

Accepted/implemented 2026-10-28 after the owner observed a large schematic flashing before 3D appeared.

The fallback was painted by default while motion eligibility, the lazy module and the first WebGL frame were still pending. Give `ArkView` three explicit presentation states: loading, cinematic and schematic. Hide the schematic visually and from the accessibility tree during cinematic startup, reserve the same scene dimensions, show a small visual-uplink status and fade in only after an actual rendered frame. Projected system markers start hidden until their first valid position arrives.

Schematic remains an intentional preference and the small-screen/reduced-motion/graphics-failure path. A stalled visual startup falls back after 20 seconds; this cosmetic timeout never controls a game deadline. Cleanup cancels it and disposes a late/failed renderer. Do not eagerly bundle Three.js, add another engine, block the launch/commands on graphics, or remove the accessible fallback to hide the symptom.

| Component | Review |
| --- | --- |
| C1 Identity | No account/session/credential changes |
| C2 Twitch | No API/webhook/chat behavior changes |
| C3 Participation | Existing controls remain usable while scenery loads |
| C4 Engine | No rules/state/content changes; no transition depends on rendering |
| C5 Episodes | Cosmetic startup timer is separate from persisted phase timing |
| C6 Custody | Renderer readiness grants no custody or native proof |
| C7 Database | No schema/write changes |
| C8 Projection | Current snapshot and event baseline remain authoritative; no replay on readiness |
| C9 Dashboard | Stable scene size and first-frame fade replace fallback flash |
| C10 OBS | Shared passive loading status; no new controls/capabilities |
| C11 History | Physical systems/marks and DOM summaries remain available |
| C12 Validation | Delayed real module request, first frame, unchanged brand/launch bounds, context loss and zero world writes |
| C13 Operations | Existing lazy local assets, renderer disposal and motion budgets retained |

Focused browser evidence delays the production 3D chunk, checks actual computed visibility, releases it, checks opacity/layout and forces graphics loss back to SVG. Full-suite and native acceptance evidence is recorded separately. Reference: existing Three.js lifecycle sources E14 in the [source register](../research/sources.md). Revisit based on hardware/native OBS observation, without making the game wait for scenery.
