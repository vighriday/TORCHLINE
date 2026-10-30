# Final design

The owner-supplied **Figma v2** export is the sole visual source. All ten destinations, the rolling Ark, interactive cockpit and Minecraft LIVEWIRE scene are adapted into strict TypeScript/React. The raw export stays untouched and ignored. [Source checksums](source-checksums.txt) identify the input; [ADR 0033](../decisions/0033-figma-v2-presentation.md) records the renderer decisions.

The application mounts one design system from [final/App.tsx](../../apps/web/src/final/App.tsx). It uses the existing PostgreSQL backend, signed Twitch ingress, deterministic engine, session controller and scoped overlays. Prototype votes, outcomes, fictional creators and browser-owned resources are excluded.

| Destination | Real connection |
| --- | --- |
| Awakening | Actual practice creation/resume or creator OAuth |
| Mission Control | Saved chapters, challenges, allocation, exact costs, timers and physical ship record |
| LIVEWIRE | Paid mission, counted ballots, locked commitment and one streamer-attested consequence |
| Inheritance | Current offers, opt-in, frozen preview, native evidence requirements and receiver consent |
| Hangar | Actual world library, parking, resume and saved memorials |
| Creator Studio | Separate creator/bot setup, subscription health and private OBS sources |
| World Chronicle | Paginated events, causes and custody records |
| Field Manual | Current game and mission rules |
| Judge Arena | Guided access to the real saved practice loop |
| Settings | Local motion, contrast, captions, optional sound and control guidance |

The shared Ark receives all seven saved systems, resources and marks. Navigation sacrifice changes the model; marks persist after repairs and custody changes. The floating blue nose panel has been removed at the owner's request. The running light and bridge shell remain. Every screen uses this same corrected component.

Motion is decorative. A loading state precedes the lazy scene; graphics failure leaves text/controls available. Reduced motion retains a static 3D view. Rendering is manually scheduled with bounded pixel ratio and hidden/offscreen suspension. These limits do not establish acceptable performance on every device or native OBS.

## Physical-state fixtures

[Pristine](fixtures/pristine.json) · [navigation sacrificed](fixtures/navigation-sacrificed.json) · [leaking](fixtures/leaking.json) · [repaired with scars](fixtures/repaired-with-scars.json) · [cargo jettisoned](fixtures/cargo-jettisoned.json) · [inherited](fixtures/inherited.json) · [wreck](fixtures/wreck.json).

Regenerate with `pnpm design:fixtures`. These are actual deterministic engine results labeled simulation. They verify presentation coverage, not genuine Twitch acceptance. See the [frontend contract](../architecture/frontend-contracts.md), [cutover record](final-frontend-replacement.md) and [current implementation status](../planning/implementation-status.md).

Fresh verification: build, 134 automated tests, all 15 replacement browser journeys and affected repeats pass. Native OBS 32.2.2 renders the exact final build, refreshes, rejects old access and displays the transparent replacement dock with its miniature/resources. This is isolated saved practice over loopback, not genuine Twitch/public-edge or outgoing broadcast acceptance. [Evidence and remaining work](../reports/2026-10-30-final-frontend.md).
