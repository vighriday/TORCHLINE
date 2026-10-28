# Frontend and Claude Design integration contract

Status: contract implemented; Claude Design exports integrated on 2026-10-27. [ADR 0011](../decisions/0011-claude-design-integration.md) preserves transport and authority while adapting the six surfaces into typed React. [Seven generated fixtures](../design/README.md) exercise the contract at both broadcast sizes. Actual OBS and owner usability/accessibility acceptance remain pending.

## Boundaries

The browser receives a versioned `WorldPresentation` with world/chapter/phase, current host/mode, resource meters, physical systems, current challenge, legal choices with exact previews, aggregate participation, recent semantic events and a concise spectator recap. It does not receive refresh tokens, individual ballots or authority to change resources. Domain state is projected on the server. Artwork and animation must not determine outcomes.

Physical system records contain stable system ID, integrity, current condition, permanent scar markers, and last-change event/community provenance. The presentation adds derived severity (`stable`, `compromised`, `critical`, `lost`) so a recently repaired but critically weak system does not appear healthy. Hull integrity, oxygen reserve and life-support machinery are separate. Components use stable IDs such as `navigation`, `lifeSupport`, `shields`, `cargo`, `habitat`, `reactor` and `hull`; never infer destruction from a localized label or a CSS class.

## Replaceable surfaces

| Surface | Data/input | Responsibilities |
| --- | --- | --- |
| Ark renderer | Systems, resources, semantic event cues, reduced-motion preference | Map stable system IDs to original art layers; show scars and repairs consistently |
| Challenge renderer | Nodes/edges, revealed clues, constraints, work-order progress | Explain shared problem; keyboard/text alternatives; mobile-readable command examples |
| Choice panel | Legal choices, affordability and deterministic preview | Present costs, immediate effects, known future hazard and projected ending |
| Spectator recap | Current crisis, previous commitment, inherited cause, phase | Explain what's happening without requiring participation or watching earlier chapters |
| Host controls | Allowed actions and current version | Start/close/commit/pause; stale action errors; private authentication |
| History | Public semantic events and cause IDs | Trace damage and repairs across chapters and host changes |

All mutation calls carry the expected world version and command ID. The backend enforces identity, mode, role and custody. Renderers never call Twitch directly. A shared client/controller handles SSE reconnect and snapshot replacement; visual components remain unaware of transport.

Initial connection waits for valid state before presenting mode/launch actions. The client rejects unexpected HTML/malformed responses, preserves domain authorization errors and exposes a read-only reconnect action ([ADR 0024](../decisions/0024-preview-connection-recovery.md)). A reconnect refreshes snapshots/feed without replaying a command; a lost response may already have committed. Transport status is separate from action errors. These changes do not alter presentation wire fields/version or authority.

## Semantic visual cues

The [encounter revision](../decisions/0022-encounter-presentation.md) consumes existing chapter/phase, systems/marks and semantic events without changing wire fields/version. `ArkView` projects passive system positions and local camera focus; `ChallengeView` optionally accepts a display title and forwards relay scans through its existing callback. `EncounterLayer` baselines initial chapter state, shows a dismissible arrival only on chapter change and never issues commands. `CrewUplink` opens native Twitch chat/copies public commands; it does not authenticate or post as a viewer. The OBS variant remains read only with no new buttons.

Current cue kinds are `damage`, `repair`, `sacrifice`, `discovery`, `challenge-solved`, `chapter-arrived` and `world-ended`, each with event ID and an optional stable system ID. Cargo jettison is a sacrifice on `cargo` with a persistent jettison mark. Custody has a separate audit record and currently appears as changed host/world revision; a dedicated handoff animation cue is a future contract extension. Claude Design can map existing cues to motion/sound without changing rules. Reconnecting renders current physical state and does not replay every past explosion. Animation is optional, interruptible and independent of command acknowledgement.

Provide fixtures for pristine, navigation-sacrificed, leaking, repaired-but-scarred, cargo-jettisoned, inherited and wrecked worlds. Generate them from actual engine actions so the visual contract cannot drift from real outcomes. A handoff changes host metadata and world revision; it preserves world ID, systems, scars, resources and cause history. The next chapter's explicit start generates its arrival cue.

## Player and spectator clarity

The reference interface always shows the current goal, phase, one-sentence crisis, available commands, challenge progress and the most recent consequence. Explain the landing threshold before it becomes fatal. Mobile Twitch viewers participate through short chat commands; no additional sign-in, drag interaction or private browser tab is required. Essential clues and feedback must be legible on a 720p broadcast, with text/icon states, high contrast, reduced motion and no reliance on sound/color alone.

Schema/package: `packages/contracts`. Projection: server application boundary. Final rendering: replaceable components in `apps/web`. Contract fixtures and consumer tests must accompany later design integration. Richer animations/assets can be added without replacing the engine, persistence or Twitch adapter.

## Integrated consumers

Complete Archive and inheritance preview use versioned `world-records-2026-10-27.1` DTOs. Current custodians can read `/api/worlds/:id/view` and paginated `/history`; each public page excludes participant identities/ballots and pins the game sequence. `/api/handoffs/:id/preview` returns a read-only `WorldPresentation` only to connected offer parties while source custody, frozen revision, opt-in and expiry remain current. These GETs grant no mutation or native proof authority. See [ADR 0012](../decisions/0012-scoped-world-records.md).

`ArkView`, `ark-model.ts` and lazy `ark-scene.ts` share physical systems/resources, chapter and public events; stable event IDs position persistent marks. The optional `panel`, `flight` and `title` variants change framing, never state or authority. DOM summaries preserve all seven system records even when WebGL is active. Reduced motion or screens at most 700px use SVG. A failed context returns to SVG. The decorative canvas is one per visible scene, scheduled at at most 30 FPS with DPR capped at 1.5. Two slow frame samples reduce resolution toward a 0.5 floor. Hidden/offscreen animation stops; unmount disposes unique geometry, materials, local procedural textures and renderer. There is no postprocessing or external texture download. First-frame readiness gates revealing the cinematic scene; fallback is explicit.

Renderer startup has explicit loading/cinematic/schematic states ([ADR 0023](../decisions/0023-cinematic-startup.md)). Keep scene dimensions stable; show a visual-uplink status until the first real frame, then fade in 3D. The schematic is visible only when selected, on small screens/reduced motion, or after visual failure/timeout. System markers remain hidden until positioned. The loading status never blocks controls or changes canonical timing/state.

Renderer effects baseline the first event history, deduplicate IDs with a bounded set, cap cues and particles, and suppress spectacle on a reconnect backlog of more than three new events. Rendering current damage remains mandatory even when spectacle is suppressed. Only zero hull causes physical breakup; oxygen/passenger loss alone does not explode an intact ship. Pausing, resuming, a context failure or switching views cannot apply a command or replay old consequences.

`TitleScreen` provides the game entry and existing account/OAuth setup. `FlightDeck` shares the ship, telemetry, challenge, actual vote balance, exact six-resource changes and recorded consequence banners between captain and spectator views. Interactive controls invoke the existing controller; the spectator view has no mutation buttons or simulator. `DeckViews` retains navigation, paginated Archive and actual Relay progress. The live projection retains thirty public events; Archive pages the complete public event and custody record. Rich historical snapshots are not fabricated. Overlay status/recap never imply native raid verification.

Presentation `2026-10-27.1` adds investigation/allocation/awaiting-commit phases, optional aggregate cooperation and optional hosted `clock` metadata. The latter carries server time, deadline, paused duration and recovery reason; it never authorizes closure from the browser. `EpisodeView` renders countdown, cooperation and host settings with the existing Claude Design panels. Both dashboard and broadcast use it. New close capabilities are false on all read-only records/overlays. Raw inspection/preference/ballot actor maps never enter public DTOs. Individual input-update events are excluded from spectator history; locked plans and committed consequences remain visible. Historical ark-v2 worlds have no cooperation or automatic deadline. Rebuild all clients after changing presentation version.
