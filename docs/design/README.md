# Final design

The owner-supplied **Figma v2** export is the sole visual source. All ten destinations, the rolling Ark, interactive cockpit and the voxel "Minecraft" lava gap jump are adapted from it into strict TypeScript/React. The car-soccer "Rocket League" aerial goal and "Souls Run" boss attempt feeds were supplied by the owner on 1 November 2026 as Figma-generated scene files and adapted in-repo, giving three LIVEWIRE practice feeds. All shipped code and assets adapted from the export are committed; the raw export is a non-shipped design input identified by [source-checksums.txt](source-checksums.txt), which covers only the original export. [Design provenance](../../assets/design-provenance.md) lists each source. [ADR 0033](../decisions/0033-figma-v2-presentation.md) records the renderer decisions.

The application mounts one design system from [final/App.tsx](../../apps/web/src/final/App.tsx). It uses the existing PostgreSQL backend, signed Twitch ingress, deterministic engine, session controller and scoped overlays. Prototype votes, outcomes, fictional creators and browser-owned resources are excluded.

| Destination | Real connection |
| --- | --- |
| Awakening | Actual practice creation/resume or creator OAuth |
| Mission Control | Saved chapters, challenges, allocation, exact costs, timers, physical ship record and the inheritance dossier after a handoff |
| LIVEWIRE | Supply-cost mission (one in-game supply), counted ballots, locked commitment, one streamer-attested consequence and an illustrated practice feed per preset |
| Inheritance | Current offers, opt-in, frozen preview, native evidence requirements and receiver consent |
| Hangar | Actual world library, parking, resume and saved memorials |
| Creator Studio | Separate creator/bot setup, subscription health and private OBS sources |
| World Chronicle | Paginated events, causes and custody records; lineage graph and season record; revocable read-only public links that work only while the issuing server is reachable; "What if?" one-step alternatives; "Verify this record" (a replay digest comparison, not a signed attestation) |
| Field Manual | Current game and mission rules |
| Judge Arena | 11-step two-community, two-game relay rehearsal through the real endpoints; practice identities, chat lines, mission results and raid proof are simulated and labelled; autoplay stops on the dossier at step 9 |
| Settings | Local motion, contrast, captions, optional sound and control guidance |

The shared Ark receives all seven saved systems, resources and marks. Navigation sacrifice changes the model; marks persist after repairs and custody changes. The floating blue nose panel has been removed at the owner's request. The running light and bridge shell remain. Every screen uses this same corrected component.

Motion is decorative. A loading state precedes the lazy scene; graphics failure leaves text/controls available. Reduced motion retains a static 3D view. Rendering is manually scheduled with bounded pixel ratio and hidden/offscreen suspension. These limits do not establish acceptable performance on every device or native OBS.

## Physical-state fixtures

[Pristine](fixtures/pristine.json) · [navigation sacrificed](fixtures/navigation-sacrificed.json) · [leaking](fixtures/leaking.json) · [repaired with scars](fixtures/repaired-with-scars.json) · [cargo jettisoned](fixtures/cargo-jettisoned.json) · [inherited](fixtures/inherited.json) · [wreck](fixtures/wreck.json).

Regenerate with `pnpm design:fixtures`. These are actual deterministic engine results labeled simulation. They verify presentation coverage, not genuine Twitch acceptance. See the [frontend contract](../architecture/frontend-contracts.md), [cutover record](final-frontend-replacement.md) and [current implementation status](../planning/implementation-status.md).

At the 30 Oct cutover: build, 134 automated tests, all 15 replacement browser journeys and affected repeats passed locally. As of 1 November 2026, 164 Vitest tests in 43 files on real PostgreSQL and 25 Playwright journeys pass, with CI green. Native OBS 32.2.2 rendered the 30 Oct final-design build in isolated saved practice; the current build is not re-verified in OBS. That run covered refresh, rejected old access and the transparent replacement dock with its miniature/resources over loopback; it is not genuine Twitch/public-edge or outgoing broadcast acceptance. [Evidence and remaining work](../reports/2026-10-30-final-frontend.md).

Minecraft and Rocket League are trademarks of their respective owners. TORCHLINE is not affiliated with or endorsed by them; its practice scenes are original illustrations and never read game data.
