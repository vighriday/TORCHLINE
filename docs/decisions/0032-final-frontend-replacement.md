# ADR 0032: Replace the visual application from one owner-supplied design

Date: October 30, 2026. Status: controller separation retained; final Figma v2 adapted, regression and acceptance in progress.

The owner rejected the current presentation and the separate UI-LAB direction. The next interface must follow the incoming complete design. Supplement missing screens using that same design vocabulary. Existing screenshots, fonts, animated treatments and components are historical references, not competing art direction.

## Decision and archive

Start `feat/frontend-replacement` from `663888a`, the latest verified LIVEWIRE source. Preserve that commit as `archive/frontend-before-final-2026-10-30`. The original release, LIVEWIRE preview and UI-LAB worktree remain unchanged. UI-LAB has uncommitted work and branches before the latest recovery/index/verifier changes; its untracked development server uses mutable in-memory fixtures. It is not the functional backend for the replacement.

Local, ignored archives preserve the tracked frontend, UI-LAB's committed history/frontend and its dirty patch/untracked demo server with SHA-256 checksums. Only the already-public verified source tag is published. Unreviewed UI-LAB changes, archives, raw design inputs and private configuration are not staged.

Extract the existing session/feed/reconnect/mutation lifecycle into [useTorchlineSession](../../apps/web/src/useTorchlineSession.ts). Keep HTTP validation in [api.ts](../../apps/web/src/api.ts), scoped read-only feed recovery in [overlay-feed.ts](../../apps/web/src/overlay-feed.ts), public records/history types and server-side presentation contracts. No dependencies, API fields, authority, rules or migrations change.

[main.tsx](../../apps/web/src/main.tsx) mounts only the final presentation. The prior tracked presentation source, fonts, media and generators are retired; the archive tag preserves them. [ADR 0033](0033-figma-v2-presentation.md) records exact dependencies and rendering decisions.

The owner-supplied figma-v2 is the sole visual source. All ten destinations and both 3D experiences are retained while prototype state is replaced with canonical data. Final visual/native acceptance is assessed on this build.

## Alternatives and consequences

- Reusing UI-LAB in place would combine dirty unreviewed visuals with an older functional baseline. Keep its work intact and use a clean worktree instead.
- Dropping a standalone export over `apps/web` could lose Twitch/session/mission/overlay behavior and install prototype state. Adapt markup and assets into typed React components using canonical state and callbacks.
- Keeping the old CSS under a new visual skin risks exactly the overlap and inconsistent states the owner rejected. One final presentation entry with explicit stylesheet ownership is the cutover boundary.
- Extracting every endpoint into a new frontend framework would delay the actual design and create speculative abstractions. Move the shared lifecycle now; migrate remaining real action callbacks as their final screens are adapted.

## Component stress review

This is a design review, not new provider evidence.

| Component | Constraint for replacement |
| --- | --- |
| C1 identity | Keep session/OAuth/bot conversion and self-disconnect; no browser tokens or new roles |
| C2 Twitch | Reuse signed server ingress and honest integration status; no direct browser Twitch calls |
| C3 participation | Keep normal/chat/mission commands and server admission; no local votes counted as native input |
| C4 engine | Consume canonical state, exact choice previews and system IDs; animation never resolves an outcome |
| C5 episodes | Preserve phase/timing/pause/recovery controls and server timestamps |
| C6 custody | Preserve preparation, native evidence and receiving consent; unresolved missions still fence transfer |
| C7 storage | Same SQL and migrations; preparation uses a fresh simulation schema and no live grants |
| C8 projection | Preserve snapshot/SSE cleanup, reauthentication and replacement access fragments; inherited ordering audit remains open |
| C9 dashboard | Map every existing creator action to final screens, including loading/error/stale/empty states |
| C10 OBS | Keep scoped read-only sources, transparency, compact/full/auto, source reload and grant rotation |
| C11 history | Preserve paginated records, inherited causes, physical scars and mixed-history replay |
| C12 validation | Retain behavior/security/SQL tests; adapt visual selectors intentionally and recheck final visual states |
| C13 operations | Keep one real backend serving the build; no mock substitute, new service or public deployment |

## Acceptance and revisit

Use the [replacement checklist](../design/final-frontend-replacement.md). Run build, format, the existing automated suite and browser journeys after extraction. Those tests protect behavior of the reference, not final-design fidelity. After actual replacement, inspect every specified surface at mobile, 720p and 1080p, reduced motion, failure and persistent-damage states; repeat native OBS. Genuine Twitch gameplay, native raids, managed hosting and inherited P1 audit debt stay separate gates. Revisit if the final export needs a material runtime dependency or contract extension.
