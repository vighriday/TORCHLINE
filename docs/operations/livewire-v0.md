# Run and verify LIVEWIRE v0

Use `feat/livewire-v0`, based on release source `89fa019`. The original `feat/gameplay-foundation` worktree and preview remain separate. Do not replace the live database with test fixtures.

## Local practice

Use the normal [development setup](development.md) with Node 24, pnpm 12.4.2 and an isolated development PostgreSQL database. In its ignored `.env`, set `LIVEWIRE_ENABLED=true` and `WORLD_MODE=simulation`. Run `pnpm db:migrate`, `pnpm build`, then `pnpm dev`. Use the configured local origin.

Create/resume an Ark, open **LIVEWIRE** in the command navigation, then open a mission. Use **Practice chat** to send `!stake 2`; lock and confirm a result. Check the same ship's resources and Archive. Return to Bridge and continue the chapter. Practice inputs are explicitly simulated and never go to Twitch.

At a zero-vote opening, select **Solo system** before locking. If the 45-second window expires, the allowance stays spent; continue the chapter or use another chapter boundary rather than trying to reopen it. A completed mission can be revisited in the ship log.

## Overlay

Generate an OBS link in Captain tools/Broadcast and choose **Open compact OBS dock**. Copy that destination, including its private fragment, into a Browser Source. Use 1280×720 or 1920×1080 at 30 FPS. The transparent page places a small dock at the lower right; crop/position it as required. It cannot control the Ark or OBS.

- Full view: existing OBS URL, unchanged.
- Compact view: add `?view=compact` before the private fragment.
- Automatic view: add `?view=auto`; compact between chapters, full expedition during chapter activity.

All views share the same scoped read grant. Generating a new grant rotates them together. The exchange removes the private fragment while retaining the presentation setting. Do not publish access links, screenshots containing them, cookies or local session files.

## Real Twitch acceptance — still required

Use the existing [account setup and live guide](controlled-account-live-test.md). Keep hriday29 as broadcaster and hriday_29 as bot. The existing app/scopes/webhook connection suffice; no new Twitch application or outbound bot capability is needed.

After this branch passes review, apply migration 009 to the intended candidate database, set `LIVEWIRE_ENABLED=true` in its private runtime configuration and restart that candidate. Do not claim that the current public baseline has this feature enabled.

1. At a ready chapter boundary, the broadcaster opens a clearly described mission before the gaming attempt.
2. As the broadcaster or another genuine participant, send one displayed legal `!stake` command in that exact channel. Observe count/choice in the dashboard and actual OBS source. Do not send as the bot.
3. Lock before playing. Record the locked target/effects, then perform the attempt and attest the actual result once.
4. Compare the saved Ark, physical condition and Archive; reload dashboard/OBS. Check one result event and unchanged state after retry/restart. Keep the result explicitly labeled streamer-attested.
5. Resolve/cancel before any native handoff. The [real raid checklist](controlled-account-live-test.md#4-authentic-raid--only-when-a-second-broadcaster-is-available) is unchanged and needs a second consenting broadcaster.

No repeated bot-status trials are needed. Replies are independently paused on the current preview. Do not weaken bot roles, channel protections, native proof or receiving consent to accelerate acceptance.

## Rollout and rollback

Keep the known-good release/source available. Migration 009 is additive. Test encrypted backup/restore before activation and verify the candidate's public health, authentication denials, assets and SSE through the intended HTTPS proxy. A permanent host/account/region/budget and remote backup destination are still external deployment decisions; no service is purchased automatically.

Set `LIVEWIRE_ENABLED=false` to stop new openings, ballots, locks and resumes. An existing locked mission can still be attested or cancelled; paused/open missions can be cancelled, and expiry continues. Finish that cleanup before normal chapter play. **Keep the extension-capable binary:** a pre-extension binary cannot replay histories that contain LIVEWIRE events. Do not roll back by deleting the ledger, ballots or history.

Automated reproduction:

```powershell
pnpm build
pnpm test
pnpm test:browser
pnpm audit:balance
pnpm design:fixtures
pnpm readme:proof
pnpm check:repo
```

Use the browser installation/path from the development guide. The tests create isolated SQL schemas; provider fixtures, a seeded 10,000-ballot fixture and browser tests are not genuine Twitch delivery or deployed audience-capacity evidence.
