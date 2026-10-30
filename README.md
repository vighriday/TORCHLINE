<p align="center"><strong>TORCHLINE</strong> · THE ARK PROTOCOL</p>
<p align="center"><strong>The stream ends. The world doesn't.</strong></p>

<a href="assets/readme/awakening.png"><img src="assets/readme/awakening.png" width="1440" alt="TORCHLINE's Awakening: the persistent Ark rolls above a planet. Final Figma v2 design, with the corrected ship nose."></a>

<p align="center"><a href="#a-stream-that-leaves-something-behind">The idea</a> · <a href="#livewire--your-next-attempt-matters">Minecraft LIVEWIRE</a> · <a href="#try-it">Play</a> · <a href="#what-is-proven">What is proven</a> · <a href="docs/README.md">Docs</a></p>

<p align="center"><a href="docs/releases/v0.1.0-preview.1.md">v0.1.0-preview.1</a> · Development preview · Built with Codex for the Codex x TwitchCon Hackathon</p>

## A stream that leaves something behind

**A shared survival game that remembers its community.** Your audience is aboard a ship carrying 216 people. Viewers uncover clues, solve emergencies and choose where to help. The captain makes the hard calls. Every repair, sacrifice and mistake stays with that same Ark.

Play all five chapters on one channel. Or prepare a handoff and perform a genuine Twitch raid: the next captain inherits your passengers, damaged systems and unfinished story. **A raid moves the world. It isn't required to enjoy it.**

<picture>
  <source media="(prefers-reduced-motion: reduce)" srcset="assets/readme/awakening.png">
  <img src="assets/readme/ark-roll.gif" width="960" alt="Actual final-design Ark footage. Saved practice presentation, not Twitch acceptance footage.">
</picture>

<sub>Recorded from the integrated app. [Full-size still](assets/readme/awakening.png) · [SVG animation container](assets/readme/ark-roll.svg) · [Capture and provenance](assets/readme/README.md).</sub>

## LIVEWIRE — your next attempt matters

Keep playing your usual game. Before a difficult Minecraft jump, open one mission. Chat chooses which Ark system is at risk. Lock that commitment, make the attempt, then confirm what happened. A small repair or scar is written to the real saved ship—once.

<a href="assets/readme/minecraft-livewire.png"><img src="assets/readme/minecraft-livewire.png" width="1440" alt="Minecraft LIVEWIRE: an illustrative lava-gap challenge above the persistent Ark's tactical mission dock."></a>

<details>
<summary><strong>▶ See the Minecraft mission scene move</strong></summary>

<picture>
  <source media="(prefers-reduced-motion: reduce)" srcset="assets/readme/minecraft-livewire.png">
  <img src="assets/readme/minecraft-livewire.gif" width="960" alt="Actual browser capture of the Minecraft illustration and saved mission dock. The streamer judges the real attempt; the illustration is not game telemetry.">
</picture>

The scene illustrates the attempt; it does not read Minecraft or decide the result. Missions cost one supply, have a finite allowance and cannot resurrect a destroyed system. [Exact rules](docs/product/livewire-v0.md).

</details>

## Your chat can change who survives

<a href="assets/readme/mission-control.png"><img src="assets/readme/mission-control.png" width="1440" alt="Mission Control with the actual saved radiation-storm chapter, resource meters, cooperative relay challenge and captain controls."></a>

Discover a relay with `!scan A`, connect the safe route, patch failing equipment or help divide repairs. Solving the shared problem changes resources, ship condition and future choices. Voting is only one part of the job.

<details>
<summary><strong>◇ You're the captain. Save navigation—or save everyone?</strong></summary>

The storm arrives before the shield challenge is solved.

| Your commitment | What the next chapter inherits |
| --- | --- |
| Sacrifice navigation | All 216 people survive. Guidance is destroyed. You face a blind jump. |
| Seal the rear habitat | 168 people survive. Navigation remains available. The sealed habitat stays in the record. |

These are real engine results. [Inspect the generated proof](assets/readme/proof.json).

</details>

<details>
<summary><strong>One viewer. Four oxygen. A different ending.</strong></summary>

Follow the same planned captain's route twice. Without a chapter-three life-support repair, oxygen runs out before landing. With that repair, 156 passengers reach the surface with four oxygen remaining. It saves the voyage, without guaranteeing a perfect colony.

Open the [flight recorder](assets/readme/flight-log.csv) and search **patch** in GitHub's table. The record comes from deterministic engine commands and is checked by replay. It is a saved simulation, not a real audience session.

</details>

```mermaid
flowchart LR
  A[Chat finds a way] --> B[Captain commits]
  B --> C[The same Ark changes]
  C --> D[Next chapter]
  D --> A
  G[Your usual game] --> L[LIVEWIRE mission]
  L --> C
  C --> R[Prepared native raid]
  R --> N[Next captain accepts]
  N --> D
  style C fill:#172322,stroke:#df9d47,color:#e1dccf
  style L fill:#172322,stroke:#76c6c5,color:#e1dccf
```

## Try it

For saved practice, use the [development guide](docs/operations/development.md). With Node 24, pinned pnpm and an isolated PostgreSQL database configured:

```powershell
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pnpm start
```

Set `WORLD_MODE=simulation` and `LIVEWIRE_ENABLED=true` in your ignored local environment. Open its configured origin, choose **Launch the Ark**, then use **Command OS** for all ten destinations. The Judge Arena guides you through actual saved practice. No Twitch messages are sent in that mode.

For the real stream, follow the [owner setup guide](docs/operations/owner-launch-guide.md) in order: HTTPS → exact Twitch callback → broadcaster/bot consent → subscriptions → OBS → genuine chat → native raid. Keep the bot's role and every private OBS link private.

## What is proven

| Layer | Honest status |
| --- | --- |
| Saved survival + LIVEWIRE | Implemented with actual PostgreSQL, deterministic consequences, replay and automated tests |
| Final design | Ten screens integrated; browser, graphics and native acceptance are recorded separately in [current status](docs/planning/implementation-status.md) |
| Twitch | Real consent, signed callbacks and incoming query chat observed; genuine chat changing the Ark still needs acceptance |
| Bot replies | Provider accepted sends; other viewers did not see them. Replies are optional and independently paused |
| Native raid + permanent hosting | Still open. Simulation does not satisfy either gate |

This is a development preview, not a production-ready claim. The original release is protected while the final-design feature branch is verified. [Critical audit](docs/reviews/2026-10-29-comprehensive-audit.md) · [LIVEWIRE acceptance](docs/operations/livewire-v0.md).

<details>
<summary><strong>For builders and judges</strong></summary>

React and TypeScript present the world. A pure engine decides consequences. PostgreSQL saves state, history and custody together. Twitch supplies signed input; a read-only stream updates the dashboard and OBS. Animations and bot replies never decide game outcomes.

```powershell
pnpm test
pnpm test:browser
pnpm audit:balance
pnpm design:fixtures
pnpm readme:proof
pnpm check:repo
```

[Requirements](docs/product/requirements.md) · [Architecture](docs/architecture/system-design.md) · [Decisions](docs/decisions/README.md) · [Twitch research](docs/research/twitch-integration.md) · [Changelog](CHANGELOG.md) · [Security](SECURITY.md).

The creator supplied the vision and final design direction. Codex helped research, implement and verify the system. The owner-supplied Figma v2 design supplies the final visual experience. [Asset provenance](assets/design-provenance.md).

</details>
