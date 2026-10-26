# Twitch account setup and verification

Updated 2026-10-26. Real application credentials, public HTTPS reachability and broadcaster OAuth are verified. Dedicated bot consent, genuine signed callback/chat delivery, OBS and native raid acceptance remain separate milestones. Never paste secrets, passwords or tokens into chat or Git.

1. Sign in at the [developer console](https://dev.twitch.tv/console/apps) using the app owner's account. Verify email and enable 2FA. Register TORCHLINE as a confidential application in the appropriate game/application integration category.
2. Choose name **TORCHLINE**, category **Game Integration**, client type **Confidential**. Register exactly `https://your-assigned-domain/auth/twitch/callback` using the actual HTTPS origin. Use one developer application for both bot and broadcaster grants. Keep the generated client secret private; the Client ID is a public OAuth identifier. [Official registration requirements](https://dev.twitch.tv/docs/authentication/register-app/)
3. Run the local setup in the README. `pnpm db:up` creates an ignored `.env` with generated local database/session/encryption secrets. Edit this existing file; do not replace it with placeholder values from `.env.example`.
4. Run `pnpm live:prepare` to create a separate local `torchline_live` database and ignored `.env.live` with independent keys. Add `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` to **`.env.live`**. Live defaults to port 3001; simulation can remain on 3000. Run `pnpm db:migrate:live`, `pnpm build` and `pnpm start:live`. Preparation refuses to overwrite an existing live environment file. Keep generated keys rather than replacing them with placeholders.
5. In the broadcaster's normal browser choose **Connect creator with Twitch**, approving `channel:bot`. For the bot, follow the separate steps below. Creator sign-in does not ask for the bot setup key or grant bot authority.
6. The workstation now has a development ngrok tunnel forwarding only to `http://127.0.0.1:3001`, with request inspection disabled (`--inspect=false`) to avoid capturing OAuth callbacks. Set `.env.live` `PUBLIC_BASE_URL` and `TWITCH_REDIRECT_URI` to that HTTPS origin and exact callback path, register the same redirect in Twitch, then restart the live process. Keep loopback binding for a tunnel running on the same machine. No production hosting is provisioned. [ngrok agent configuration](https://ngrok.com/docs/agent/config/)
7. Connect the creator, authorize the bot, verify token identities/scopes, opt into incoming worlds and reconcile subscriptions. Confirm the public callback challenge and receive a genuine chat command before calling chat integration verified.
8. Arrange two consenting live broadcasters, check target raid settings, prepare a handoff, perform the native Twitch raid, and accept on the target. Preserve authentic proof metadata and state continuity without secrets. Simulation is never evidence of this milestone.

Implementation status and actual verification results are maintained in [implementation status](../planning/implementation-status.md). Do not assume every setup step is implemented merely because it is listed here. Bot/creator scopes and token types follow [Twitch's cloud-bot documentation](https://dev.twitch.tv/docs/chat/authenticating/).

## Dedicated bot consent and recovery

1. Create or use a separate ordinary Twitch account; no second developer app is required. Sign into it in a private browser window and visit TORCHLINE's public origin.
2. Expand **Dedicated bot setup · operator access**, available before and after creator sign-in. Enter **`BOT_SETUP_SECRET` from the local `.env.live`** in **Bot setup secret**. This generated key is different from `TWITCH_CLIENT_SECRET` and is not a Twitch password; the website never supplies it.
3. Choose **Authorize the dedicated bot** and approve `user:read:chat user:write:chat user:bot`. The server checks the actual client, identity and scopes. A creator cookie alone cannot initiate this flow.
4. If the intended bot appears as a **Twitch creator session**, it used the creator link. Under that account choose **Disconnect Twitch authorization**, then repeat the bot form. **Sign out only ends the browser session; it does not disconnect the creator grant.** The callback recovery page names the account Twitch actually returned; check it matches the intended bot. Recovery is allowed only after explicit disconnection and with no world/handoff/custody history. No world or history is deleted; existing broadcasters with history must use a different bot account.
5. Return to the original broadcaster window, refresh, and choose **Check / repair Twitch subscriptions**. Reconciliation also starts automatically after authorization. Chat/online/offline subscriptions must be provider-confirmed; incoming raids additionally require **Accept incoming world offers** and reconciliation.

Bot setup selects the dedicated bot only; it grants no creator controls, world custody or private creator diagnostics. Keep the operator key out of URLs, chat and Git.

## Real-service acceptance

Create an Ark and start chapter 1. In the broadcaster's actual Twitch chat send `!scan A`; confirm the discovered clue, canonical state change and **chat actions applied** counter. In a decision, `!vote 1` must change its advisory tally. Send `!status` or `!history` and confirm the dedicated bot replies in the source channel. Queries are coalesced for ten seconds per channel and globally paced, so repeated requests may intentionally receive no extra response. An HTTP success alone does not prove visible delivery; inspect the reply outcome and actual Twitch chat.

```powershell
pnpm twitch:doctor:live
pnpm twitch:verify:live
pnpm check:public-secrets
```

`doctor` checks configuration presence only. `verify` makes real HTTPS/Twitch calls, privately validates stored grants and writes sanitized `.local/live-verification.json`; it sends no chat, synthetic proof or subscription changes. Exit codes: 0 all checks verified, 2 prerequisites remain, 1 failure (the package runner may report its own nonzero wrapper status). Counts alone do not prove an entire native session. The secret scan covers committed/staged Git objects, tracked working files, browser assets, local logs and selected public responses; it is a bounded exposure check.

For the native raid, arrange two consenting live creators. The receiver opts in and has no active Ark. Verify current grants/subscriptions and actual Twitch raid settings, prepare the source handoff, perform the native raid and accept on the receiver. Compare revision, resources, physical condition and causal history; duplicates must not transfer twice. The source may go offline after the raid; the receiver must remain live for acceptance. Preserve sanitized proof metadata and recording. Simulation cannot authorize a live transfer.

Test the scoped overlay in actual OBS, including rotation, reconnect and legibility. Chromium tests do not establish OBS compatibility. Raids remain optional for completing a solo season.
