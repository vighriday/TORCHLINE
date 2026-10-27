# Design integration and authority review — 2026-10-27

Scope: curated Claude Design React integration on `feat/gameplay-foundation`. Approved backend stack, deterministic rules, contracts, storage and auth routes remain unchanged. [ADR 0011](../decisions/0011-claude-design-integration.md) and [C1–C13 review](../design/integration-review.md) explain the choices.

## Findings resolved

- Exported prototype rules, fictional users, synthetic timers/votes and demo raid controls differed from production. Excluded all four raw JavaScript exports from the browser bundle. Canonical six-node graphs, resources, marks and capabilities drive the new components.
- First-frame readiness could hide SVG before an offscreen canvas drew. The schematic now remains until an actual rendered frame. Chromium confirms one ready canvas with schematic opacity zero; context loss returns to SVG and removes that canvas.
- An optional reconnect error inserted an extra broadcast grid row and caused telemetry/ship overlap despite no document overflow. Status moved into the header. Sustained fixture streams, bounding-box assertions and visual inspection check all seven states at 720p/1080p. Fit alone was insufficient.
- A separate decision-phase check using a real application overlay grant caught the completed puzzle stacking above current choices. Broadcast now focuses on the current phase; both decision canvas sizes fit without overlap.
- The old prototype showed full historical snapshots/replay attestation and incoming-world views without supporting read contracts. Archive explicitly displays recent canonical events and permanent marks; Relay shows persisted intent stages. No invented API authority or proof was added.
- OBS browser address bars omit the capability after exchange. Added a private **Copy OBS link** action so operators can retain the complete generated source link without exposing it anonymously.

## Public capability/authority boundaries

| Surface | Authority and executed coverage |
| --- | --- |
| Anonymous landing | Creator consent and operator-key form only; no private diagnostics/world mutations. Existing HTTP tests cover denial. |
| Creator command deck | Existing server-session/current-custody checks, expected version and command ID. Server capabilities gate UI; hiding a button is not authorization. Original PostgreSQL/gameplay/browser flows still pass. |
| Live viewers | Ordinary Twitch chat uses signed normalized ingress and server phase rules. No browser role, client simulator or image grants authority. Real chat remains unverified. |
| Operator bot setup | Existing bearer key, one-use consent, named conversion and history protections preserved. Updated fixture-provider browser journey enters through Broadcast. |
| Relay | Actual source/receiver statuses and consent; live mode never renders simulated-evidence control. Existing live/simulation proof and custody tests remain in the 54-test suite. No new incoming-world read endpoint. |
| Archive/Ark | Canonical projection only, persistent marks, no client save or replay certification. Visual preferences/route drafting/navigation leave the world unchanged. |
| OBS | Early dedicated read-only render branch. No creator, simulator or operator button rendered; existing capability/session and rotation checks remain. Rendering fixtures do not establish actual OBS/native authority. |
| Assets | Local licensed fonts and lazy renderer only. Browser test observes no external asset/service requests. Raw exports, private inputs, environment and local tools remain ignored. |

## Evidence and limits

Local build/typecheck and formatting pass. All 54 tests across eight files pass. Five Chromium journeys pass, including cooperation/physical damage/reload/simulated handoff, bot conversion, responsive workspaces/keyboard/reduced motion/graphics recovery, and fourteen broadcast fixture-size combinations. Screenshots are ignored local review artifacts. The cinematic chunk is roughly 135 kB gzip, separate from the roughly 81 kB initial browser bundle. Rendering is limited to 30 FPS/DPR 1.5, suspended offscreen/hidden, and explicitly disposed; these constraints are not a hardware benchmark.

Real provider recheck validates the app, one creator grant, one bot grant and all three required current chat/stream subscription configurations. The three signed challenge records are historical deliveries. Public callback probes currently fail because the ngrok account credential is missing; the owner deferred configuring it. No genuine gameplay chat action, accepted bot send, actual OBS session or native raid transfer has been recorded. No production hosting/deployment is claimed.

The secret scanner now identifies the live application before claiming public-response coverage. A tunnel error produces partial evidence and exit 2. Explicit artifact-only scans still cover configured secrets, saved/pending grants, Git/index/working files, browser output and local logs; they do not verify a public deployment. See [owner launch guide](../operations/owner-launch-guide.md).
