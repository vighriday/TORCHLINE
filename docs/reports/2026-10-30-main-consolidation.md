# Main consolidation — October 30, 2026

The owner requested one reviewed main baseline before further engineering. This operation consolidates source and release metadata; it does not deploy, change Twitch roles or close live acceptance gates. The integration branch is `chore/consolidate-preview-2`; subsequent engineering starts on `feat/release-hardening` from the promoted main revision.

## Branch and recovery review

| Source | Disposition |
| --- | --- |
| `main` at 39f59a2 | Original planning baseline; advance by fast-forward, preserving published history |
| `feat/gameplay-foundation` at 89fa019 | Entire history already in the final-design candidate; no separate cherry-picks needed |
| `feat/livewire-v0` at 663888a | Entire history already in the final-design candidate, including missions, migrations, replay, recovery and tests |
| `feat/frontend-replacement` at 57e1d1e | Current ten-screen design, final model/layout fixes and corrected README media; use as the integration base |
| `qa/audit-2026-10-29` at e305550 | One missing commit: merge its two concurrency regressions and dated assessment; retain its original evidence limitations |
| Local `design` at 04053f3 | Superseded prototype presentation; do not import it or its mock server. Keep its branch/worktree intact |

All local/remote refs, worktree status, recent reflogs and unreachable commits were inspected. The three unreachable commits are superseded versions: an amended LIVEWIRE command boundary (the retained version excludes internal commands from the public schema and adds regression coverage), a QA attribution amendment with identical files, and a database-budget documentation correction. None contains a missing feature to recover.

UI-LAB has one extra blank line in its guide and an untracked fixture server. Neither is part of the functioning application; neither is imported, removed or overwritten. Owner-local comparison images in the original workspace also remain outside this release. No remote branch is removed, tag moved, history rewritten or private source staged.

## Verification and correction

The recovered QA tests pass against disposable real PostgreSQL under the declared Node 24 runtime: 64 competing commands produce one saved mutation; 64 duplicate accepts produce one custody event. This rerun does not turn the dated QA report's synthetic provider evidence into live acceptance.

Final-design follow-up CI at 2bae3c0 passed 16/17 browser journeys, exposing one timing-save failure. A focused regression reproduces the actual defect: a real SQL update materializes the default clock, its actual SSE snapshot reaches the browser, and the captain's unsaved manual selection changes to timed. The fix keeps a local draft until it matches saved state or the chapter/world changes, and disables preparation inputs during an outstanding save. The regression verifies persisted manual durations and reload; no Twitch fixture or outbound reply is needed.

Release version, README and all seven private manifests advance together to **0.1.0-preview.2**. The existing preview.1 and presentation archive tags remain immutable. A new annotated preview tag identifies the reviewed main source; its prerelease is published only after Verify passes for that exact source revision.

Local integration checks on October 30:

| Check | Result |
| --- | --- |
| Engine/API/real PostgreSQL | 136 tests in 32 files pass, including recovered QA tests |
| Timing/cooperation browser repeat | Both journeys pass twice; four executions, with persistence, SSE and reload assertions |
| Production build / strict TypeScript | Pass |
| Formatting / aligned versions | Pass; seven private manifests at preview.2 |
| Balance, seven design fixtures and README replay proof | Regenerate without changes to their committed artifacts |
| Repository links / whitespace / private exclusions | Pass; 90 Markdown files |

Exact-source remote Verify and promotion evidence are recorded in the [preview.2 release](https://github.com/vighriday/TORCHLINE/releases/tag/v0.1.0-preview.2). Publication requires passing CI for its exact source; a pending run is not counted as passing. Local browser repeats are not a full remote-suite acceptance.

The last frontend-only CI run at 57e1d1e passed 14/17 journeys: actual frame progression exceeded its 15-second observation budget, while the forty-viewport and three-browser journeys reached their overall time limits. Integration retains every graphics, business and custody assertion, uses longer bounded CI-only budgets for those three measured cases, and retains local budgets. Real changed pixels and more than eight new frames are still required. This verifies correctness on shared software rendering, not supported live FPS or sustained OBS performance.

## Gates that remain open

- Owner final-design review, sustained native OBS/outgoing broadcast performance and real mobile stream readability.
- Genuine gameplay chat → persisted consequence → visible overlay; historical query delivery does not satisfy this.
- Authentic native raid, separate consenting receiver and preserved Ark/history. The bot remains a bot.
- Permanent deployment, off-host backup durability, deployed recovery/soak and the remaining audit projection/ordering and broader balance work.

Merging this development preview is safe source consolidation, not a production-readiness declaration. [Final frontend evidence](2026-10-30-final-frontend.md) · [LIVEWIRE evidence](2026-10-30-livewire-v0.md) · [Current status](../planning/implementation-status.md) · [Release policy](../operations/releases.md).
