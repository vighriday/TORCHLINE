# Live acceptance: essential owner steps

Updated 2026-10-29 UTC. App/credentials and broadcaster `hriday29` / bot `hriday_29` consent already exist. Keep the existing app and accounts. Start with the [existing-account walkthrough](controlled-account-live-test.md). Four genuine chats reached the app; two accepted bot sends remain invisible to other viewers, so replies are independently paused. Native OBS renders the current 3D Ark and recovers after a controlled app outage. Genuine gameplay effects, visible replies, further OBS checks and native raid remain distinct gates. [Current evidence](../reports/2026-10-29-integration-diagnosis.md).

## 1. Restore public HTTPS

**Completed on the current machine:** registered project SSH key restored HTTPS on October 29. Public health/readiness and authority denials pass; one existing live Ark is preserved. Run `pnpm live:up` to reuse/start the existing app/SSH setup and `pnpm live:check` for real provider checks and preserved acceptance counters. Keep this machine and its processes awake. The quarantined native ngrok file remains unused. For a new machine/key:

1. Open `E:\Projects\TORCHLINE\.local\ngrok-ssh.pub` in a text editor; copy its single public-key line.
2. In the same ngrok account open [SSH Public Keys](https://dashboard.ngrok.com/ssh-keys), Add/New key, label it TORCHLINE and paste that public line. Keep `.local/ngrok-ssh` (without `.pub`) private. The authtoken does not authenticate SSH.
3. Tell the engineering session it is registered, or run `pnpm live:ssh` in the existing Node24 terminal while the live service runs. The helper pins ngrok's published server fingerprint, ignores global SSH config, exposes only live port 3001 and retries network loss. Authorization/host-key failures stop. No request inspection interface runs.
4. Confirm [live health](https://education-slather-reps.ngrok-free.dev/health/live) returns JSON `ok: true, mode: live` and [readiness](https://education-slather-reps.ngrok-free.dev/health/ready) returns `ok: true`. An ngrok error page is a failed test.

Intended origin: `https://education-slather-reps.ngrok-free.dev`. The computer/database/live process/SSH connection must remain running. The existing native `live:tunnel` helper is retained for other trusted installations; do not reinstall/restore the quarantined file for this checklist. This is development ingress, not permanent hosting.

## 2. Confirm OAuth and subscriptions

The preview checks its connection before launch and shows a deliberate graphics-loading state. **Retry connection** only reloads saved state and the feed; it never repeats a gameplay action. Reduced motion uses a static ship. Graphics failure leaves functional text and controls available.

**Completed on the current machine:** the owner corrected the console callback; a fresh real creator session and the first live Ark were observed afterward. The earlier `redirect_mismatch` is resolved. Keep the exact callback below if registering/recovering the app later; begin sign-in from the current home page rather than an old callback URL.

In [Twitch developer apps](https://dev.twitch.tv/console/apps), Manage the existing TORCHLINE app. OAuth Redirect URLs must include exactly `https://education-slather-reps.ngrok-free.dev/auth/twitch/callback`. Click Add if shown, then Save; refresh Manage and confirm it remains listed. Keep **Confidential** and the existing client ID/secret; no second app is needed for the bot. [Twitch registration reference](https://dev.twitch.tv/docs/authentication/register-app/).

Connect the broadcaster from TORCHLINE in the ordinary browser; confirm the displayed name is `hriday29`. Use Check / repair Twitch subscriptions if private diagnostics do not show chat/online/offline ready. Incoming raid subscription is added after receiver opt-in.

Engineering runs `pnpm twitch:verify:live`: real grants, all provider subscription pages, exact callback/conditions and anonymous/unsigned denials. Historical signed challenges are labeled historical and do not pass the current reachability gate. The script sends no chat or synthetic proof.

## 3. Prove real viewer play and bot replies

A live baseline is already saved locally. Keep it, or deliberately start a new session with `pnpm live:acceptance begin --replace`.

1. Resume the existing live Ark. The new flight deck's **Open Twitch chat** action opens the broadcaster's actual chat directly; the adjacent command updates with the legal phase. During an open challenge, scan a still-unknown relay. During a decision, vote before advice freezes. If chapter 1 has ended, do not create another Ark just to test an obsolete scan. Confirm the actual clue/advice and private applied-action counter change. Copying a command alone does not send it.
2. No additional bot query is requested now. Completed identity/email/block/moderation checks and the manual cross-account failure are recorded in the current evidence. Retest a reply only after an identified provider/account change, with outbound replies deliberately enabled and one observed command. Accepted API sends alone do not prove visibility.
3. Run `pnpm live:acceptance check`. New signed chat and persisted engine-action counters should increase for a valid action. Bot sends are a separate counter and need not change while replies are paused. No raw chat, participant IDs, grants or capability URLs are exported. Observe the actual game consequence as well as counters.

## 4. Prove OBS connectivity

`pnpm twitch:verify:overlay` checks actual public HTTPS. It makes a separate five-minute read-only capability, privately exchanges it in Chromium, checks actual public SSE/mutation denial, and removes only that grant. It never rotates ordinary links or changes a world; it records no URL, screenshot or trace. The existing live Ark is available to render. **This is not actual OBS CEF.**

In **Command OS → Creator Studio**, choose an overlay preset, then **Generate / rotate private OBS source**. Copy the private URL. In OBS: Sources → + → Browser → TORCHLINE → paste URL; set 1280×720 or 1920×1080. Keep the URL out of chat/screenshots/Git. Confirm the actual Ark/phase/resources/challenge/damage and absence of creator controls. Apply a legal game action and observe it. Hide/show the scene, refresh the source and briefly interrupt/reconnect networking: current state must return without repeating rewards/damage. Rotate the link once, verify the old source loses access, and update OBS with the new URL.

## 5. Prove a native raid handoff

Arrange **two consenting broadcasters** later; this remains an external dependency and does not block existing-account tests. Keep `hriday_29` as the bot. Receiver connects their creator account, enables Accept incoming world offers, has no active Ark and verifies its incoming raid subscription. Both must meet real Twitch live/raid requirements; TORCHLINE checks streams before preparation/acceptance. See [computer/phone and OBS options](controlled-account-live-test.md#4-authentic-raid--only-when-a-second-broadcaster-is-available).

At a ready chapter boundary, source prepares an offer to receiver. Perform Twitch's native raid. TORCHLINE must observe signed native evidence; receiver inspects and accepts once. Confirm the exact world/resources/physical systems/scars/history moved intact, source lost command authority and its overlay stopped showing that Ark. Duplicate notifications/acceptance must not transfer twice. Continue ordinary chapter play on receiver. Chat, simulator events or screenshots never unlock a live transfer.

Run `pnpm live:acceptance check` and retain its new linked-transfer count plus private session notes. Explicitly record visible bot/OBS/native raid observations. These remain release gates.

## Permanent deployment

Select/approve the hosting account, always-on plan/region, durable PostgreSQL and backup retention, then follow [deployment](deployment.md) and [backup/restore](backup-and-restore.md). No cloud service/purchase exists. Register the permanent exact OAuth origin and repeat steps 2–5 there. Preserve existing token/session/backup keys in an owner-controlled secret store.
