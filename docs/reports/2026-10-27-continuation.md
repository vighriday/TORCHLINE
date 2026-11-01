# Implementation continuation — 2026-10-27

Branch: `feat/gameplay-foundation`, tracking `origin/feat/gameplay-foundation`. No merge, history rewrite, visibility change or cloud deployment. Reviewed source milestone: `0b8925c`.

## Completed

- Complete paginated gameplay/custody history, parked/terminal inspection and exact consent-scoped offered-Ark previews (`6351142`). Access ends on custody loss, expiry, cancellation, opt-out or disconnect.
- Immutable ark-v3 cooperation (`c17b840`): optional investigation reveals a usable shared clue; latest-account repair preferences divide a declared 0–10-power reserve; useful repairs spend actual power with the captain's choice. Combined previews include allocation. Physical scars and causal events persist. Oxygen recovery cannot repair a leaking machine. Frozen advice records captain alignment/override. Existing ark-v2 worlds keep their original rules.
- Hosted timing/recovery (`0b8925c`): persisted phase deadlines, standard/manual settings, early closure, awaiting-commit, pause/resume remaining time, pause-before-park, explicit resume after restart/disconnect/offline, and no automatic narrative commitment or offline resource drain. Custody transfers clear the outgoing host's pacing while preserving game state.
- Twitch foundations extended: inspect/allocate chat parsing, signed offline pause handling, durable retry/backoff/quarantine, private queue diagnostics, narrowly scoped current-window chat recovery and worker ownership fencing. No new Twitch scopes were requested.
- Presentation consumers remain connected to canonical state. Dashboard/mobile/overlay share phase guidance, repair plans, clock and physical systems. The 720p overlay uses compact information. React sibling keys no longer collide.

## Executed verification

| Boundary | Evidence and limits |
| --- | --- |
| Engine/storage/HTTP | 77 tests across 12 files passed locally. After the final clock-read/custody-pacing changes, all 16 affected storage/episode tests passed again. CI then tested the complete source. |
| Rules | Historical v2 exhaustive audit retains 2,398 terminal branches and all endings. V3 normalization checks 112,211 weight/budget combinations; regressions cover latest preference, no participation, caps, overkill, affordability, exact combined previews, clues, frozen advice and replay. This is not exhaustive enumeration of every multi-chapter allocation trajectory or a playtest. |
| Browser | Six Chromium journeys passed: gameplay/handoff, onboarding, seven physical fixtures at 720p/1080p, responsive/keyboard/graphics recovery and the new mobile investigation/allocation/frozen-advice journey with read-only overlay. Native OBS is not implied. |
| CI | [Engine milestone](https://github.com/vighriday/TORCHLINE/actions/runs/40517462173), [browser correction](https://github.com/vighriday/TORCHLINE/actions/runs/40522734937), and [complete runtime rollout](https://github.com/vighriday/TORCHLINE/actions/runs/40523579079) succeeded. Runtime CI includes formatting, build, tests, browser journeys, balance/fixture generation and repository checks. |
| Private inputs | Fingerprint scans passed for Git/index, browser artifacts and selected local logs. Original private idea hash is unchanged and it remains ignored/outside the index; secrets/overlay capabilities are excluded. Public HTTPS responses could not be established while the tunnel is offline. |
| Local services | Separate simulation/live databases migrated through 007. Services restarted from reviewed source; readiness passes on ports 3000/3001. Anonymous mutations, integration/records reads, overlay and unsigned-webhook access deny authority. |

The owner-reported [failed records workflow](https://github.com/vighriday/TORCHLINE/actions/runs/40515143258) captured its browser baseline before chapter start completed. The corrected test waits for persisted phase and excludes only display-clock time from canonical comparisons. Further browser testing exposed duplicate React sibling keys and new overlay overflow; both were fixed. A partial-staging formatting failure in [40522605008](https://github.com/vighriday/TORCHLINE/actions/runs/40522605008) was corrected without rewriting history; the next correction and full rollout workflows passed.

## Real Twitch evidence and external dependencies

The October 27 read-only provider recheck validates the real application, one broadcaster grant, one bot grant and 3/3 exact current enabled chat/online/offline subscriptions. The database holds three historical genuine signed challenges. There are still **zero** applied genuine chat actions, accepted native bot sends and live custody changes. Fixture deliveries do not replace those milestones.

1. Restore the saved ngrok account credential (already deferred by the owner), run the tunnel to port 3001 and confirm actual HTTPS health/callback delivery. Existing validated grants do not require another registration.
2. Verify real `!inspect`/`!scan`/`!allocate`/`!vote` in their open phases, then visible `!status`/`!history` bot replies. A signed offline notification must pause a running episode, with explicit resume.
3. Test an actual OBS Browser Source: current private grant, 1280×720/1920×1080, refresh/cookie persistence, reduced-motion/fallback, reconnect and frame time. Native automation could not initialize because its kernel-assets path was missing; no OBS app action or broadcast occurred.
4. Arrange two consenting live broadcasters: opted-in idle receiver, ready-boundary source intent, real native raid evidence and explicit receiver acceptance before expiry. Verify identical world/scars and former-host authority loss. Never manufacture proof to complete this gate.

Exact owner steps and confirmations remain in the [launch guide](../operations/owner-launch-guide.md). No manual test was used as a reason to halt independent implementation.

## Recommended next work

Restored HTTPS plus native chat/OBS/raid acceptance has highest product value. Independent hardening can continue with measured chat bursts and per-account flood/backpressure policy, avoiding full-history reads in hot input paths, long-outage/reconnect recovery, retention, backup restore and deployment rollback. Multi-instance fan-out remains deliberately unsupported; keep one replica. Seeded mission variants, wreck rescue/visual replay and explicit helper roles remain roadmap expansions, not implemented features. Owner usability/accessibility and gameplay-depth playtests remain needed even though numerical reachability and automated journeys pass.
