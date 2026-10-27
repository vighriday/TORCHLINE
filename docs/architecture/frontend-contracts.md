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

## Semantic visual cues

Current cue kinds are `damage`, `repair`, `sacrifice`, `discovery`, `challenge-solved`, `chapter-arrived` and `world-ended`, each with event ID and an optional stable system ID. Cargo jettison is a sacrifice on `cargo` with a persistent jettison mark. Custody has a separate audit record and currently appears as changed host/world revision; a dedicated handoff animation cue is a future contract extension. Claude Design can map existing cues to motion/sound without changing rules. Reconnecting renders current physical state and does not replay every past explosion. Animation is optional, interruptible and independent of command acknowledgement.

Provide fixtures for pristine, navigation-sacrificed, leaking, repaired-but-scarred, cargo-jettisoned, inherited and wrecked worlds. Generate them from actual engine actions so the visual contract cannot drift from real outcomes. A handoff changes host metadata and world revision; it preserves world ID, systems, scars, resources and cause history. The next chapter's explicit start generates its arrival cue.

## Player and spectator clarity

The reference interface always shows the current goal, phase, one-sentence crisis, available commands, challenge progress and the most recent consequence. Explain the landing threshold before it becomes fatal. Mobile Twitch viewers participate through short chat commands; no additional sign-in, drag interaction or private browser tab is required. Essential clues and feedback must be legible on a 720p broadcast, with text/icon states, high contrast, reduced motion and no reliance on sound/color alone.

Schema/package: `packages/contracts`. Projection: server application boundary. Final rendering: replaceable components in `apps/web`. Contract fixtures and consumer tests must accompany later design integration. Richer animations/assets can be added without replacing the engine, persistence or Twitch adapter.

## Integrated consumers

Complete Archive and inheritance preview use versioned `world-records-2026-10-27.1` DTOs. Current custodians can read `/api/worlds/:id/view` and paginated `/history`; each public page excludes participant identities/ballots and pins the game sequence. `/api/handoffs/:id/preview` returns a read-only `WorldPresentation` only to connected offer parties while source custody, frozen revision, opt-in and expiry remain current. These GETs grant no mutation or native proof authority. See [ADR 0012](../decisions/0012-scoped-world-records.md).

`ArkView` and lazy `ark-scene.ts` share physical systems/resources; stable event IDs position persistent marks. DOM summaries preserve all seven system records even when WebGL is active. Reduced motion or screens at most 700px use SVG. A failed context returns to SVG. The canvas is decorative, one per visible workspace, limited to 30 FPS and DPR 1.5; hidden/offscreen animation stops and unmount disposes geometry/materials/renderer. No textures or postprocessing are allocated. First-frame readiness gates hiding the schematic.

`DeckViews` supplies navigation, resource telemetry, all-six-resource forecasts, participation guidance, bounded Archive, actual Relay progress and a separate read-only broadcast composition. Archive explicitly labels the recent 30 non-vote events; richer historical snapshots are not fabricated. Overlay status/recap never imply native raid verification. `main.tsx` retains the existing HTTP/SSE controller and operator/creator flows. The schema version is unchanged because no wire fields or mutation authority changed.
