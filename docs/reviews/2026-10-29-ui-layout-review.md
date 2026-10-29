# UI layout review — October 29, 2026

The owner's report exposed defects that the existing passing width checks did not detect. The review uses actual application screens and saved simulation state, plus anonymous access to the actual public HTTPS site. It preserves the approved React/TypeScript components and Claude Design's visual treatment.

## Findings and corrections

| Finding | Correction |
| --- | --- |
| Fixed offsets put ship labels, resource values, decisions and mission content into competing space | Separate heading/status/ship/resources/mission/footer regions; stage-local labels and reserved caption space |
| Narrow internal mission scrolling hid clues/tools on the captain screen | Allow document flow and scrolling; retain all puzzle content and actions |
| Resource numbers shifted when only some resources had deltas | Reserve consistent label/meter/delta rows; use two columns on phones |
| Short Hangar/Broadcast views appeared vertically centered like landing pages | Top-align the workspace content |
| Raw event IDs and repeated technical filler cluttered Archive | Keep story, dates, consequences and cause links visible; preserve identifiers in the data and link anchors |
| Mobile public Twitch status/setup overlapped launch copy | Flow branding, ship, launch, account/setup and footer separately on phones/tablets |
| Large-screen captain footer styling leaked into the 1080p OBS composition | Scope captain breakpoint changes to captain mode; keep OBS padding/geometry independent |
| Reduced-motion/narrow layouts offered a view toggle that could not enable 3D | Describe the simplified view accurately and disable that unavailable action |
| Graphics retry left the failed-renderer flag set | Clear failure and recreate the scene; verify real rendered frames return without changing saved state |
| Saved Manual timing reverted in the form; custom policy could become defaults | Project saved durations and preserve them across reload/save; separate timing and crew-setting drafts |
| Repaired critical systems appeared healthy; passenger meters disagreed | Give integrity warnings priority in both schematic/status labels; use capacity 216 consistently |

## Coverage and evidence boundaries

The local visual inventory includes title/onboarding, preparation and pacing, every command-deck workspace, investigation, route discovery, allocation, advice/commit, damaged continuation, pause, later chapter encounters and ending screens. Representative desktop, compact, tablet and mobile screenshots were visually inspected. Additional wide-screen captures cover the supplied 1920px use case. Current-rule colony/partial/wreck states come from replayable authored campaigns, not invented presentation values. Their zero-reserve witnesses are a reachability check, not exhaustive v3 balance analysis.

The completed inventory contains **145 captures: 29 states at five sizes** (1920×1080 through 390×844), with no detected horizontal overflow or controls outside the horizontal viewport. Eight real public anonymous title/bot-setup captures test the actual HTTPS entry point. The internal gameplay inventory is clearly labeled simulation and stays in an isolated database/schema. No live world or Twitch chat is modified for these layout checks. Screenshots, recordings, OBS profiles and capability URLs remain under ignored `.local/` rather than being added to Git.

Browser guards now compare meaningful region rectangles and verify the actual commit target is not covered. The suite also covers saved Manual/custom policy, keyboard/route interactions, real pixel/frame motion, graphics loss and retry, mobile handoff preview, read-only overlays and seven physical-state fixtures at 720p/1080p. Checking that a document has no horizontal scrollbar remains useful, but is insufficient on its own.

An initial complete run exposed two cold-start/timing failures; their focused repetitions passed. A subsequent run passed 12/13 and caught the real OBS footer regression described above. These failures were investigated rather than hidden by loosening the overlap assertions. The final local run passes all 107 automated tests and all 14 browser journeys. A later run attempted while the private PostgreSQL cluster was offline is recorded as an environment failure, followed by that successful complete rerun.

## Remaining gates

The complete 14-journey browser suite passes. Native OBS renders the current build at 1280×720 with the 3D Ark, no host controls and zero page-control permissions; its screenshot was visually inspected. A controlled app outage/reconnect also succeeds without source reload or canonical-state change. Native gameplay updates, link rotation, deliberate source refresh and broadcast output remain separate. Genuine viewer-command effects and the authentic two-broadcaster raid remain external acceptance steps. A07 state/fan-out performance and A11 snapshot assignment/ordering remain release risks. This UI pass does not mark the product production-ready or claim a general accessibility certification.

The final Archive reading pass was rebuilt, rechecked in four existing gameplay/layout browser journeys and recaptured in the same 145-capture inventory with no horizontal clipping/overflow findings. Native OBS then reverified both the final script and stylesheet. Record identifiers remain in canonical data and event anchors; the reading view keeps dates, summaries, resource consequences and inherited-cause links.
