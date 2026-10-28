# Live acceptance: essential owner steps

Updated 2026-10-28. App/credentials and broadcaster `hriday29` / bot `hriday_29` consent already exist. Keep the existing app and accounts. The candidate is **automated-test verified, live acceptance pending**.

## 1. Restore public HTTPS

**Completed on the current machine:** the owner registered the project public key and Windows OpenSSH restored HTTPS. Public health/readiness, authority denials, ten selected secret-response probes and the read-only Chromium overlay connection pass. No live Ark exists yet. Keep this machine and its processes awake. The native ngrok file quarantined by Windows Defender remains unused. For a later restart or new machine:

1. Open `E:\Projects\TORCHLINE\.local\ngrok-ssh.pub` in a text editor; copy its single public-key line.
2. In the same ngrok account open [SSH Public Keys](https://dashboard.ngrok.com/ssh-keys), Add/New key, label it TORCHLINE and paste that public line. Keep `.local/ngrok-ssh` (without `.pub`) private. The authtoken does not authenticate SSH.
3. Tell the engineering session it is registered, or run `pnpm live:ssh` in the existing Node24 terminal while the live service runs. The helper pins ngrok's published server fingerprint, ignores global SSH config, exposes only live port 3001 and retries network loss. Authorization/host-key failures stop. No request inspection interface runs.
4. Confirm [live health](https://education-slather-reps.ngrok-free.dev/health/live) returns JSON `ok: true, mode: live` and [readiness](https://education-slather-reps.ngrok-free.dev/health/ready) returns `ok: true`. An ngrok error page is a failed test.

Intended origin: `https://education-slather-reps.ngrok-free.dev`. The computer/database/live process/SSH connection must remain running. The existing native `live:tunnel` helper is retained for other trusted installations; do not reinstall/restore the quarantined file for this checklist. This is development ingress, not permanent hosting.

## 2. Confirm OAuth and subscriptions

**Current blocker:** Twitch returned `redirect_mismatch` to the old offline hostname. The running server was independently checked: its sign-in redirect sends the new callback below. Update the existing app's console allowlist, then begin a fresh sign-in from the current home page; do not refresh the old error/callback URL.

In [Twitch developer apps](https://dev.twitch.tv/console/apps), Manage the existing TORCHLINE app. OAuth Redirect URLs must include exactly `https://education-slather-reps.ngrok-free.dev/auth/twitch/callback`. Click Add if shown, then Save; refresh Manage and confirm it remains listed. Keep **Confidential** and the existing client ID/secret; no second app is needed for the bot. [Twitch registration reference](https://dev.twitch.tv/docs/authentication/register-app/).

Connect the broadcaster from TORCHLINE in the ordinary browser; confirm the displayed name is `hriday29`. Use Check / repair Twitch subscriptions if private diagnostics do not show chat/online/offline ready. Incoming raid subscription is added after receiver opt-in.

Engineering runs `pnpm twitch:verify:live`: real grants, all provider subscription pages, exact callback/conditions and anonymous/unsigned denials. Historical signed challenges are labeled historical and do not pass the current reachability gate. The script sends no chat or synthetic proof.

## 3. Prove real viewer play and bot replies

A live baseline is already saved locally. Keep it, or deliberately start a new session with `pnpm live:acceptance begin --replace`.

1. Create/resume a live Ark as the broadcaster. Start chapter 1; finish/close investigation first if enabled. **During the open navigation challenge**, type `!scan A` in the broadcaster's actual Twitch chat. Confirm its clue appears and the private applied-action counter increases. If that phase ended, use the command displayed for the active phase.
2. Type `!status`; confirm a visible reply from `hriday_29` in that same Twitch channel. Queries within ten seconds can intentionally coalesce. Accepted API sends alone do not prove visibility.
3. Run `pnpm live:acceptance check`. New signed chat, persisted engine action and native accepted-reply counters must increase. No raw chat, participant IDs, grants or capability URLs are exported. Observe the actual consequence/reply as well as counters.

## 4. Prove OBS connectivity

`pnpm twitch:verify:overlay` now passes against actual public HTTPS. It makes a separate five-minute read-only capability, privately exchanges it in Chromium, checks actual public SSE/mutation denial, and removes only that grant. It never rotates ordinary links or changes a world; it records no URL, screenshot or trace. This successful connection currently has no live world to render. **This is not actual OBS CEF.**

In Captain tools choose Generate / rotate OBS link. Copy the private URL. In OBS: Sources → + → Browser → TORCHLINE → paste URL; set 1280×720 or 1920×1080. Keep the URL out of chat/screenshots/Git. Confirm the actual Ark/phase/resources/challenge/damage and absence of creator controls. Apply a legal game action and observe it. Hide/show the scene, refresh the source and briefly interrupt/reconnect networking: current state must return without repeating rewards/damage. Rotate the link once, verify the old source loses access, and update OBS with the new URL.

## 5. Prove a native raid handoff

Arrange **two consenting broadcasters**; access remains an external dependency. Receiver connects their account, enables Accept incoming world offers, has no active Ark and verifies its incoming raid subscription. Both must meet real Twitch live/raid requirements; TORCHLINE checks streams before preparation/acceptance.

At a ready chapter boundary, source prepares an offer to receiver. Perform Twitch's native raid. TORCHLINE must observe signed native evidence; receiver inspects and accepts once. Confirm the exact world/resources/physical systems/scars/history moved intact, source lost command authority and its overlay stopped showing that Ark. Duplicate notifications/acceptance must not transfer twice. Continue ordinary chapter play on receiver. Chat, simulator events or screenshots never unlock a live transfer.

Run `pnpm live:acceptance check` and retain its new linked-transfer count plus private session notes. Explicitly record visible bot/OBS/native raid observations. These remain release gates.

## Permanent deployment

Select/approve the hosting account, always-on plan/region, durable PostgreSQL and backup retention, then follow [deployment](deployment.md) and [backup/restore](backup-and-restore.md). No cloud service/purchase exists. Register the permanent exact OAuth origin and repeat steps 2–5 there. Preserve existing token/session/backup keys in an owner-controlled secret store.
