# ADR 0033: Preserve the final Figma v2 design

October 30, 2026. Status: adaptation in progress on `feat/frontend-replacement`.

The owner supplied `frontend-design/figma-v2` as the sole visual source. Preserve its ten screens, Ark/cockpit, voxel scene, typography, controls and animations while replacing prototype data with canonical state. Remove superseded UI, media and guidance from current source. The raw export remains untouched and ignored; [input checksums](../design/source-checksums.txt) identify its four source files.

## Decisions

Retain React 19.3.1, Vite 8.3.5 and Three.js 0.186.1. Pin the export's React Three Fiber 9.8.2 and Drei 10.7.9 to preserve its actual geometry, lighting, controls and labels. Rewriting these scenes into a different renderer would change the supplied design and add conversion risk. Fiber's [official compatibility guidance](https://r3f.docs.pmnd.rs/getting-started/introduction) pairs v9 with React 19; no new major/alpha renderer is introduced.

Pin Tailwind and its Vite adapter to the supplied 4.2.2. Retain the full custom stylesheet and its layers, with one presentation entry at cutover. Do not ship Figma hosting/editor/analytics plugins. Self-host exact Barlow Condensed and IBM Plex Mono weights and their SIL OFL licenses; no runtime font CDN or external texture is needed.

Keep both scenes lazy. Drive manual frames at roughly 30 FPS, 20 for miniatures, bounded/adaptive DPR (0.75 floor on sustained expensive frames), and pause automatic frames while hidden/offscreen or reduced motion is selected. `frameloop="never"` prevents OrbitControls from independently scheduling a continuous RAF loop. User inspection and canonical updates can redraw a reduced-motion scene. These are implementation limits, not measured guarantees for every GPU/OBS host.

Give Drei HTML labels a stable, separately owned portal. An initial browser run exposed a DOM cleanup error when the default target changed; explicit ownership fixes the reproduced failure while preserving the label. Graphics failure has a styled text fallback and retry, not another ship model. Animation and audio never apply commands or verify real attempts.

Pass saved resources, passenger count and physical marks into the ship/cockpit. At the owner's explicit request, remove the floating blue rectangular plane at the bridge nose. Preserve the bridge shell, running light, damage/debris and cockpit. All surfaces share this corrected model; capture media only afterward.

## Component review

| Component | Required boundary |
| --- | --- |
| C1 identity | Existing sessions and separate bot consent; no secrets in UI/media |
| C2 Twitch | Signed server ingress unchanged; provider status is not gameplay proof |
| C3 participation | Real counted input; remove random prototype voting and retain admission limits |
| C4 engine | Exact existing consequences, stable systems and historical replay; no browser resource writes |
| C5 episodes | Saved server timing, recovery and legal phase controls |
| C6 custody | Source preparation, authentic native evidence and receiver consent; no local accept shortcut |
| C7 storage | Existing SQL/migrations/transactions; no fixture backend substituted |
| C8 projection | Reuse HTTP/SSE and scoped read recovery; inherited ordering audit stays open |
| C9 dashboard | All ten screens and missing functional states use the same supplied design |
| C10 OBS | Transparent/read-only compact, full and auto sources; no host controls |
| C11 history | Actual paginated events, causes, custody and permanent marks; no fictional voyage |
| C12 validation | Adapt behavioral browser tests; label rendered practice and provider fixtures separately |
| C13 operations | Real backend serves the build; atomic restart, private archives, local licenses and reproducible capture |

## Evidence boundary

The corrected awakening, mission and cockpit were visually inspected after build/restart. A fresh build, 134 automated tests and all 15 replacement browser journeys pass, including actual moving pixels, cold loading/context retry, seven physical-state fixtures at both broadcast sizes, all ten screens, saved cooperation/allocation, paid mission/recovery/history/replay, custody and zero-control overlays. The Minecraft journey also passes with voxel first-frame readiness asserted. Media review, fresh native OBS and owner acceptance are separate. Genuine Twitch gameplay and native raid verification remain open.
