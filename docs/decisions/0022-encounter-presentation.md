# 0022 — Playable encounter presentation and crew onboarding

Accepted/implemented 2026-10-28 after the owner rejected the game's presentation as insufficiently game-like. This explicitly reopens presentation work while preserving the approved stack, authored rules, durable gameplay and Twitch/custody boundaries.

## Decision and alternatives

Extend Claude Design's existing Three.js flight scene and typed React HUD. Add an authored radiation front (solar glow, moving particles/rays and expanding front), chapter color/space atmosphere, sector transmissions, actual-world ship-system anchors/inspection, discoverable relay interaction and visible mechanical rewards. Keep the original modular vessel, persistent geometry/marks, event-driven damage/repair/scan effects and adaptive renderer. Do not replace the application with another prototype, client engine or Phaser runtime: there is already a complete domain engine and shared React/SVG/Three presentation contract to preserve.

The screenshot was a prelaunch view, while the live world was already active. That does not resolve the broader review: the encounter lacked a visible radiation front, animation consequences read as transient notifications, and the app did not explain where Twitch chat was. Crew Uplink now exposes a direct Twitch popout link from the validated broadcaster login and a legal current command to copy. Route relay nodes accept keyboard/pointer scans through the existing authenticated command callback. The success reward remains canonical authored text, not a cosmetic reward.

Arrival transmission follows an observed chapter change, never an animation-triggered command. Initial/reloaded state is baselined; old arrivals/explosions are not replayed. Ship anchors project actual system positions at bounded frequency and focus only the camera/local inspection. CSS atmosphere illustrates the authored encounter; it never causes resource loss. Keep imperative camera/anchor updates outside React's gameplay state. `WorldPresentation` wire fields/version do not change; `ChallengeView.displayTitle` is an optional component prop.

## Every component reviewed

| Component | Constraint and executed boundary |
| --- | --- |
| C1 Identity | Native `world.host` comes from validated Twitch login; URL restricted to Twitch hostname and encoded validated login; no tokens/roles in graphics |
| C2 Twitch | Link opens Twitch only on user action; copying a public command never sends it; bot/HMAC/EventSub/scopes unchanged |
| C3 Participation | SVG relay scan goes through existing host-authorized callback; viewer chat remains signed ingress; real clues/rewards and legal phase rules remain authoritative |
| C4 Engine | No engine/content/reward/balance changes, client-side rules, network or clock added to transitions |
| C5 Episodes | Existing persisted phase clock keeps running independently; transmission can be dismissed and never advances/pauses/commits |
| C6 Custody | Read-only receiver inherits canonical physical systems/marks; no arrival animation is a native raid or consent claim |
| C7 Storage | No schema/history migration; inspection/camera/motion preserves canonical state/revision |
| C8 Projection | Existing bounded semantic tail, initial baselining, renderer cue dedup and low-frequency DOM-only anchor projection |
| C9 Dashboard | Launch guidance, direct chat access, current command, actionable relay graph and clearly stated challenge consequence; keyboard path tested |
| C10 OBS | Same scene, passive anchors, no new buttons/inputs/creator powers; 720p/1080p/mobile and reduced-motion coverage retained; native CEF unverified |
| C11 History | Scars and inspection show actual integrity/condition/mark kind/chapter; reload keeps discovered clues and condition without old spectacle |
| C12 Validation | 91 automated tests, existing seven browser journeys plus a new real-engine motion/pixel/inspection/relay/reload journey; simulated live-link fixture is UI evidence only |
| C13 Operations | Existing lazy local renderer, no CDN/dependency/service change; 30FPS cap, adaptive DPR and 320-particle ceiling retained; three simple storm draw objects; current asset lookup fixed separately in ADR 0021 |

## Evidence and remaining limits

Production build/typecheck and all 91 automated tests pass. All eight Chromium journeys pass, including every engine-derived physical-state fixture at 720p/1080p and responsive/keyboard/reduced-motion/graphics-failure paths. New encounter test checks both changing composited canvas bytes and advancing rendered frames, then confirms inspection does not mutate the world, relay scan does persist, next command updates and reload does not replay arrival. The Twitch popout-link test uses a labeled presentation fixture; it is not native chat proof.

Actual public HTTPS/overlay/secret checks and current deployment evidence are in the implementation status. Local rendered review/recordings use isolated simulation worlds, not owner saves. Native OBS, hardware/mobile enjoyment and owner visual acceptance remain separate gates. Revisit based on those observations, not a claim that a screenshot or unit suite proves game feel.
