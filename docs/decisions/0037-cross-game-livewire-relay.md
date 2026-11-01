# ADR 0037 — Cross-game LIVEWIRE feeds, two-game relay and mission ledger

Date: 2026-11-01. Status: accepted and implemented on the platform-completion branch.

## Context

LIVEWIRE's promise is that a creator keeps playing their own game while their audience's choices change the same persistent Ark. The presentation did not yet show that:

- The LIVEWIRE deck offered three game presets (Minecraft, Rocket League, Souls Run) but drew the Minecraft scene for all of them, only recoloured. The Figma design had separate arena and boss-courtyard feeds that were never wired in.
- A saved mission reopened in whichever preset the browser last selected, not the preset it was opened with.
- The Judge Arena relay showed the custody handoff but never a LIVEWIRE mission, so a judge could not see two communities in two different games acting on one Ark.
- The receiver's dossier named captain decisions and debts but not the attested results from other games that had damaged or repaired the ship. The lineage graph dropped any event before chapter one, so a mission opened at launch disappeared.

## Decision

1. **One illustrative feed per preset.** `challenge` shows the voxel lava jump, `match` the arena aerial goal, `boss` the courtyard duel. Each feed is its own lazily loaded chunk under the existing frame budget and reduced-motion rules. A game-styled HUD (hotbar and hearts, scoreboard and boost ring, boss bar and vitals) mirrors the feed phase. Outcome banners appear only after the streamer-attested result is saved. Every feed keeps the label "ILLUSTRATIVE GAMEPLAY — NOT GAME TELEMETRY"; nothing reads or detects a real game.
2. **The saved mission decides the scene.** A reload, or a second browser, renders the scene of the saved stake's preset. The captain's preset picker changes only the next mission.
3. **Two-game relay.** The rehearsal adds two missions, both through the public LIVEWIRE endpoint as the named practice captain. Alpha streams Minecraft; chat stakes the hull on a lava jump that fails (−6, streamer-attested). After the handoff, the receiver streams Rocket League; their chat stakes the same hull on an aerial goal that scores (+3). Both channels are shown side by side. The channel whose captain acts next is live; the other holds a still frame. Each saved result stays pinned to the channel that attested it. If LIVEWIRE is disabled on a deployment, the relay notes it and continues without missions.
4. **Mission ledger.** The arrival projection and the season record list every attested LIVEWIRE result: game and attempt named when the mission opened, outcome, target and effect from the saved resource delta, and the attesting community. The dossier shows it as "What other games did to it". The lineage graph includes missions opened before chapter one in the first chapter column.

## Alternatives considered

- **One parameterised scene.** Recolouring a single scene was cheaper but contradicted the design and made every preset look like Minecraft.
- **Game outcome detection.** Reading results from a game would be stronger evidence, but it is not available across games and would be an unverifiable claim. Results stay streamer-attested and labelled.
- **Storing mission metadata in the arrival.** The open and resolve events already hold the game, attempt, outcome and delta. The ledger reads them with one query and adds no stored fields.

## Consequences

- A judge watching the rehearsal sees the cross-game claim directly: a Minecraft failure and a Rocket League repair, by two communities, on one Ark, in under two minutes.
- The receiving crew learns which game damaged their hull and who attested it before acting.
- Each extra feed is downloaded only when a creator selects it.

## Validation

- `tests/browser/livewire.spec.ts`: each preset renders its own feed and HUD; a saved Rocket League mission reopens in the arena after reload; the existing Minecraft persistence and OBS journey still passes.
- `tests/custody-arrival.test.ts`: a mission attested before a handoff appears in the receiver's dossier with its game, attempt, outcome, delta and community, and in the season record after the voyage ends.
- `tests/browser/relay-rehearsal.spec.ts`: the relay saves exactly one failure (chapter 0, hull −6, `streamer_attested`, alpha) and one success (hull +3, beta), shows both in the lineage, and keeps the blind-jump debt and custody assertions.

## Revisit trigger

Revisit if LIVEWIRE adds a game-verified evidence type, or if presets are opened with free-text game names that need their own scenes.
