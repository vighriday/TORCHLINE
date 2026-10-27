# Claude Design integration review

Reviewed 2026-10-27. The local exports are reference inputs; all production values come from `WorldPresentation` and the existing authenticated dashboard snapshot.

| Supplied surface | Production adaptation |
| --- | --- |
| Creator Dashboard | Bridge shell, chapter objective, resource telemetry, cooperation and consequential choices; scoped creator tools |
| ArkView | Shared modular Ark, seven system conditions, permanent damage/repair/sacrifice marks; schematic plus optional cinematic renderer |
| ChallengeView | Six canonical graph nodes, server-revealed clues, real signal costs, keyboard route submission and work orders |
| Live Overlay | Read-only broadcast composition with current crisis, resource telemetry and real Twitch command guidance |
| World Inheritance | Relay with preparation, authentic evidence and acceptance states; no fake streams, counts or proof controls in live mode |
| World History | Current Ark's bounded canonical log, causal references and permanent system record; no fabricated replay attestation |
| `ark3d.js` | Geometry/art direction adapted into a typed, bounded renderer with complete cleanup |
| `support.js`, `torchline-data.js`, `torchline-sim.js` | Reference only. Export runtime, fictional data and competing client rules excluded |

The visual language retains Tektur headings, Saira body text, Kode Mono telemetry, amber/cyan status accents, dark panels, modular ship geometry and restrained motion. Fonts are served locally with their OFL licenses. No external font or renderer CDN is required by the application.

## Cross-component decision review

This is a design review. Executed checks are recorded separately in the implementation status and changelog.

| Component | Constraint and integration decision |
| --- | --- |
| C1 Identity/consent | Existing cookies/OAuth remain the only creator identity. Operator key stays a password field; no credentials enter art assets or visual preferences. |
| C2 Twitch gateway | No prototype message generator in production. Signed raw webhook validation and durable ingestion remain unchanged. |
| C3 Participation | Graph, work orders and votes submit existing commands; live viewers use Twitch chat. No optimistic canonical resources or invented audience ticks. |
| C4 Engine/content | Actual six-node puzzle and engine previews replace design fixtures. Physical marks determine ship appearance. Renderer has no transition authority. |
| C5 Episode controller | Start/pause/resume/close/commit use server capabilities. No fake deadlines, keyboard auto-commit or new client timers. |
| C6 Custody | Relay reflects persisted intent status. Live mode has no simulated evidence button. Receiver acceptance remains explicit and server-authorized. |
| C7 Database/work | No schema change or client save store. Rendering cannot alter snapshots, inbox or outbox. |
| C8 Live projection | Existing snapshots/SSE and revisions remain authoritative; renderer lifecycle follows world identity. No per-message animation fan-out. |
| C9 Dashboard | Semantic navigation, labels, visible next actions, preserved functional controls and actionable errors. Responsive layout, keyboard access and reduced motion. |
| C10 OBS | Separate read-only composition; capability exchange stays in URL fragment and existing secure session. One optional canvas, 30 FPS target and bounded DPR. Actual OBS remains an external test. |
| C11 History/replay | Only projected events/causes and permanent marks shown. Last 30 non-vote events explicitly labeled; no fabricated full history or replay validation. |
| C12 Validation | Existing real PostgreSQL/simulation/OAuth journeys retained; add responsive, overlay, fallback, reduced-motion and render-state coverage. Simulated evidence remains visibly separate. |
| C13 Operations | Lazy local renderer assets; no runtime CDN or new network service. Original reference workspace ignored. Stable build and secret scans remain release gates. |

## Limits

The current contract does not expose a recipient's incoming ship snapshot before acceptance, complete custody lineage or historical chapter snapshots. Relay and Archive explain these limits. Adding a read API later requires party/current-custodian checks, expiration and disconnect tests; a client-side prototype cannot fill that gap safely.

Performance claims require measurement. Chromium screenshots, frame limits and cleanup tests do not prove the actual OBS browser's GPU performance or native mobile Twitch usability.
