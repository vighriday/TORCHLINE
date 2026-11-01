# Frontend contract

The final Figma v2 design is adapted into [apps/web/src/final](../../apps/web/src/final/App.tsx). One entry imports one design stylesheet plus its functional extensions. [ADR 0033](../decisions/0033-figma-v2-presentation.md) records compatibility and rendering decisions. Historical presentation source/media are archived outside the application.

## Authority

[useTorchlineSession](../../apps/web/src/useTorchlineSession.ts) owns HTTP state, current-creator SSE, read-only overlay recovery, fragment exchange, mutation errors and explicit reconnect. [GameSession](../../apps/web/src/final/session.tsx) adapts that state to the supplied components. Canonical resources and mission results never originate in local storage, an animation or a random timer.

Every world mutation carries its command ID and expected application revision. The server authenticates the session, current custody, mode and legal phase. Read-only overlays receive no creator integration diagnostics or individual ballots. Graphics, layout and sound cannot authorize a command or a transfer.

The Judge Arena runs an 11-step two-community, two-game relay rehearsal through the same public endpoints as the dashboard. Its practice identities, chat lines, scripted mission results and raid proof are simulated and labelled; the server refuses simulated proof outside simulation mode. Autoplay stops on the inheritance dossier at step 9.

## Saved presentation

The versioned WorldPresentation includes world ID, host/mode, chapter/phase, exact resources, all seven systems, current shared challenge, legal choices/previews, aggregate participation, server clock, capabilities and bounded recent events. worldVersion includes hosting/custody changes; gameVersion sequences gameplay history. [Contracts](../../packages/contracts/src/index.ts) and [projection](../../apps/server/src/projection.ts) remain authoritative.

Stable system IDs are hull, navigation, lifeSupport, shields, cargo, habitat and reactor. Each has integrity, condition, derived severity and permanent event-linked marks. A critical repaired system must retain a danger warning; oxygen reserve and life-support machinery remain distinct. Reconnecting or inheriting redraws saved condition without applying past consequences again.

GameControls renders server-revealed clues, the relay graph, work orders, investigation, allocation, exact choice forecasts, manual/custom timers and private phase controls. The server validates every action again. Spectators see the objective, legal short chat command, resources and latest consequence without requiring a second login.

## LIVEWIRE

The [mission contract](../../packages/contracts/src/livewire.ts) exposes sanitized lifecycle/deadline, three aggregate counts, ballot revision, availability and exact bounded effects. Individual voters are not projected. A streamer opens a supply-cost mission (one in-game supply) at a chapter boundary, locks the commitment, attempts the real game and explicitly attests the result. The illustration cannot judge that attempt. [Rules and economy](../product/livewire-v0.md) remain unchanged.

Each of the three presets has its own illustrated practice feed and game-styled HUD, labeled illustrative: a voxel "Minecraft" lava gap jump, a car-soccer "Rocket League" aerial goal and a "Souls Run" boss attempt. A saved mission reopens in its own preset's feed. No game telemetry, automatic result detection or media upload. 'What if?' shows read-only one-step alternatives and never changes the saved world.

Minecraft and Rocket League are trademarks of their respective owners. TORCHLINE is not affiliated with or endorsed by them; its practice scenes are original illustrations and never read game data.

## OBS and recovery

The same shared projection serves full expedition, transparent compact dock and automatic mode. The overlay has zero mutation inputs/buttons; its scoped capability is exchanged for a path-scoped HttpOnly session and removed from the address bar. Keep complete access links private. Rotation, expiry and custody changes update or end access according to server policy.

Unexpected HTML is a connection error, never displayed parser text. Reconnect only reads snapshots and rebuilds feeds; it does not retry a potentially committed gameplay action. Temporary overlay dependency failure retains saved content with a warning and recovers; genuine revocation stops access. Rich history is fetched through paginated records, not synthesized from a short feed. The Chronicle draws its lineage graph and season record from those records. A revocable public Chronicle link (`/chronicle/#<token>`) is read only, has no session or controls, and works only while the issuing server is reachable. 'Verify this record' replays the stored log and compares SHA-256 digests of the replayed and stored state; it is not a signed attestation, would not detect a consistent rewrite of both, and does not prove that inputs were genuine Twitch input.

## Rendering and accessibility

Ark3D is shared by Awakening, Mission Control, Inheritance, Hangar, Chronicle and OBS miniatures. It receives resources/systems and keeps visual-only camera controls. A stable portal owns projected labels. The owner-requested blue bridge plane is removed everywhere.

Scenes load lazily, self-host fonts, use no external textures and drive manual frames at roughly 30 FPS (20 miniatures), DPR at most 1.5 (1.25 miniatures). Hidden/offscreen scenes pause; reduced motion draws static state and explicit inspection. These are caps, not measured minimum frame rates. Graphics failure offers text fallback; captain graphics retry remounts only the scene. Optional local sound requires a user gesture and never replays an initial history backlog.

All ten destinations must fit mobile and broadcast widths, keep captain controls reachable, preserve keyboard focus and avoid overlapping interactive panels. Native OBS/phone performance and owner visual acceptance remain separate from browser automation. Native OBS 32.2.2 rendered the 30 Oct final-design build in isolated saved practice; the current build is not re-verified in OBS. [Fixtures and surface map](../design/README.md).
