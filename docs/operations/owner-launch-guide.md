# Get TORCHLINE operational with Twitch

Updated 2026-10-29. For the configured accounts start with the [existing-account live test](controlled-account-live-test.md) and shorter [live release checklist](live-release-checklist.md). OAuth means Twitch's consent screen; a callback is the HTTPS address Twitch returns to afterward. EventSub delivers signed events to the server. You do not need manual tokens or a Twitch Extension.

## Your current starting point

| Stage | Evidence and next action |
| --- | --- |
| Developer application and credentials | Already configured locally. Keep the existing app and secret; do not create another app just for the bot. |
| October 29 provider/public recheck | Public HTTPS restored through existing strict SSH; both grants refreshed by normal startup and all three exact chat/online/offline subscriptions validate. |
| Broadcaster | `hriday29` previously completed real creator consent. Recheck the displayed account after sign-in. |
| Dedicated bot | `hriday_29` completed real bot consent and the named conversion. It is a separate account with no creator custody authority. |
| HTTPS callbacks | Three genuine signed challenges and three enabled chat/stream subscriptions were verified on October 26. This is historical evidence, not proof the endpoint is currently reachable. |
| Current public preview | Reachable through Windows OpenSSH at `https://education-slather-reps.ngrok-free.dev`. Callback mismatch is corrected; fresh real creator sign-in and first live Ark are observed. Native ngrok remains unused. Simulation stays on 3000. |
| Real chat | Four signed deliveries; first bot send rejected, two fresh sends accepted by Twitch with the correct accounts. Independent viewer receives the query but no bot reply; delivery and applied gameplay remain pending. |
| Actual OBS / native raid | Not passed. Use existing two accounts for chat/OBS; a separate consenting broadcaster is needed only for raid acceptance later. |
| Production hosting | Not provisioned. Hosting below is a proposed procedure, not a deployed service. |

## 1. Keep the two Twitch accounts separate

Use your ordinary browser for **hriday29**, the broadcaster who owns the Ark. Use a private browser window for **hriday_29**, the dedicated bot. Verify the account shown on each Twitch consent screen. A Twitch creator sign-in never turns an account into the bot. The bot setup key is an operator credential for TORCHLINE, not a Twitch password or client secret.

For another creator to inherit the Ark, they need their own broadcaster account and TORCHLINE consent. The bot cannot be the receiving creator.

## 2. Choose and bring up the HTTPS origin

**Current machine:** follow [SSH recovery](live-release-checklist.md#1-restore-public-https). Do not restore the quarantined file or disable protection. Native-agent instructions below are retained for other trusted installations; they are not the active procedure here.

The current development origin is `https://education-slather-reps.ngrok-free.dev`. Your computer must remain awake with PostgreSQL, the live server and ngrok running. A localhost URL is not reachable by Twitch.

In a terminal opened at `E:\Projects\TORCHLINE`, select the local runtime and start/check the existing database:

```powershell
$env:PATH = "$PWD\.tools\node24;$env:PATH"
pnpm db:up
pnpm db:migrate:live
pnpm build
```

Bring up or reuse the existing local live process and pinned SSH tunnel, then check them:

```powershell
pnpm live:up
pnpm live:check
```

The project's SSH public key is already registered. `live:up` checks the build/database/migration, starts missing local live and SSH processes and reuses healthy services. It never kills an unknown process, replaces credentials or changes the acceptance baseline. Private logs/PIDs stay under `.local/`. It uses the already installed Windows SSH client, not the quarantined ngrok executable. For a new machine, follow [SSH key setup](live-release-checklist.md#1-restore-public-https). Exit 2 from `live:check` means some live acceptance evidence is still pending; inspect the individual results.

**Confirm:** open `https://YOUR_ORIGIN/health/ready`. It must return JSON with `ok: true`, and the home page must show TORCHLINE with **TWITCH MODE · LIVE VERIFICATION PENDING**. An ngrok error/interstitial or an HTML 404 is not a successful callback test. The simulation at `http://localhost:3000` is independent and cannot verify Twitch.

For permanent hosting, use the cloud instructions below instead of running a tunnel. Choose the final HTTPS origin before editing Twitch's redirect address.

## 3. Check the existing Twitch developer application

Open the [Twitch developer console](https://dev.twitch.tv/console/apps), select TORCHLINE and choose **Manage**. If registering from scratch, verify email and enable Twitch two-factor authentication first, then use:

| Field | Value |
| --- | --- |
| Name | TORCHLINE, or an available unique variation |
| Category | Game Integration |
| Client type | Confidential; credentials stay on our server |
| OAuth Redirect URL | `https://YOUR_ORIGIN/auth/twitch/callback` |

For the current development domain the exact redirect is `https://education-slather-reps.ngrok-free.dev/auth/twitch/callback`. This was corrected previously; do not reopen an old callback/error tab. Scheme, domain, path and trailing slash must match our configuration exactly. You can keep an existing development redirect while adding an approved production redirect. The EventSub webhook path is **not** the OAuth redirect. [Twitch registration documentation](https://dev.twitch.tv/docs/authentication/register-app/)

Keep your existing Client ID and Client Secret unless there is a reason to rotate them. The Client ID identifies the app publicly in OAuth; the Client Secret is private. A second developer application is unnecessary for the bot.

## 4. Verify server configuration

Local credentials belong in ignored **`.env.live`**. This file already exists; do not overwrite it with `.env.example` or rerun preparation to replace it. On a new machine only, `pnpm live:prepare` creates an independent live database/configuration. On hosting, enter values in the provider's private environment settings.

| Variable | Set it to |
| --- | --- |
| `WORLD_MODE` | `live` |
| `PUBLIC_BASE_URL` | The HTTPS origin, without an extra path or trailing slash |
| `TWITCH_REDIRECT_URI` | Exactly the console redirect in stage 3 |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Values from this developer app |
| `DATABASE_URL` | Live PostgreSQL connection; never the simulator's database |
| `SESSION_SECRET` | Existing generated 64-character hexadecimal secret |
| `TOKEN_ENCRYPTION_KEY` | Existing generated 64-character hexadecimal key; keep it with any migrated encrypted grants |
| `BOT_SETUP_SECRET` | Existing generated operator setup key |
| `EVENTSUB_SECRET` | Existing generated webhook signing secret |
| `HOST` | Loopback for a same-machine tunnel; `0.0.0.0` on hosting |
| `PORT` | 3001 locally; provider-assigned port on hosting |
| `TWITCH_BOT_USER_ID` | Optional identity pin; if supplied it must be the dedicated bot's numeric Twitch ID, not its username |

Restart the live service after configuration changes. Run `pnpm twitch:doctor:live` to check presence without printing credentials. Presence does not verify consent or network access. Keep the same encryption key when moving an existing live database; a fresh database needs new creator/bot authorizations. Never copy a simulator database into live mode.

## 5. Connect the broadcaster

At the public origin, in the broadcaster browser choose **Connect creator with Twitch** on the cinematic title. Check the Twitch account name and approve the requested `channel:bot` access. After the callback, open **Captain / hriday29** and confirm **Twitch creator session**. If you have no active Ark, the title offers **Create an Ark**.

Before creating an Ark, open the **Captain** menu and choose **Broadcast setup** for integration checks, **Open Hangar** for saved worlds or **Open Relay** for incoming offers. Once an Ark is active, the left navigation provides those workspaces and **Captain tools** contains session and OBS-link controls. The cinematic presentation does not replace account setup or grant any viewer authority.

If already signed in with the correct account, keep that session. Do not disconnect a working account as a routine setup step. A redirect mismatch means stage 3 and `TWITCH_REDIRECT_URI` disagree. “Invalid state” usually means the one-use flow expired or was reused; start fresh from the site in the same browser.

**Confirm:** creating or resuming your Ark opens Bridge with creator controls. Signing out removes the browser session; **Disconnect Twitch authorization** in Broadcast removes that account's TORCHLINE authorization and subscriptions while preserving its worlds. They are different operations.

## 6. Confirm or authorize the dedicated bot

The current bot **hriday_29** has already completed this stage. Broadcast should report its grant as stored/current. Reauthorize only if validation says it is missing or revoked, or you deliberately replace the bot.

For a fresh bot authorization:

1. In the private window, sign into the separate bot account on Twitch and open TORCHLINE's public origin.
2. Open **Dedicated bot setup · operator access**. If signed into TORCHLINE as a creator, this section is under **Broadcast**.
3. Enter `BOT_SETUP_SECRET` from your local configuration in **Bot setup secret** and choose **Authorize the dedicated bot**.
4. Check the actual account name on Twitch. Approve `user:read:chat`, `user:write:chat`, and `user:bot`. This matches [Twitch's cloud chatbot grant requirements](https://dev.twitch.tv/docs/chat/authenticating/).
5. If that empty account was accidentally connected as a creator, TORCHLINE shows **Use ACCOUNT as the dedicated bot?** Choose **Convert ACCOUNT to the dedicated bot** only when the name is correct. The confirmation expires in five minutes. An account with Ark or handoff history cannot be converted; use a separate bot account instead.

**Confirm:** the site reports the dedicated bot authorization is current. This gives the bot chat access, not world custody or creator controls. Do not grant moderator status as a blanket troubleshooting step; the implemented cloud-bot grants are the intended authorization path.

## 7. Check EventSub subscriptions and permissions

Return to the broadcaster's **Broadcast** workspace. Choose **Check / repair Twitch subscriptions**. The server creates/reconciles subscriptions using the proper tokens and answers Twitch's signed challenge automatically. There is no webhook to create manually in the Twitch console.

For a playing broadcaster, expect current, provider-confirmed enabled subscriptions for `channel.chat.message`, `stream.online`, and `stream.offline`. For incoming raids, open **Relay**, enable **Accept incoming world offers**, then reconcile again. Expect `channel.raid` for that receiver. A provider-confirmed chat subscription alone does not prove a viewer action was applied.

Webhook URL: `https://YOUR_ORIGIN/integrations/twitch/eventsub`. It accepts authenticated signed Twitch POSTs; opening it in a browser is not a meaningful success check. Anonymous users cannot obtain creator diagnostics or mutate worlds.

**Confirm:** run `pnpm twitch:verify:live`. It checks the real endpoint, app/grant identity and subscription metadata and writes sanitized `.local/live-verification.json`. It sends no chat or simulated proof. Outstanding chat/raid prerequisites produce a nonzero result; read the stage results rather than treating them all as a code defect.

## 8. Verify real cooperative play and bot output

1. In **Bridge**, use the existing live Ark. At chapter 1 **awaiting-commit**, choose your preferred consequence, then start the next chapter at the ready boundary. Create/start chapter 1 only on a fresh account with no Ark. Follow the [phase-specific live steps](controlled-account-live-test.md#2-prove-real-gameplay-without-another-account).
2. Open that broadcaster's **actual Twitch chat**, using the ordinary Twitch site or mobile app. Send `!scan A` from a participant account. Look for the discovered clue in TORCHLINE and an increase in **chat actions applied** under Broadcast.
3. Share scans, discover the constraints, and submit a route using `!route` followed by space-separated nodes, such as the path the crew has solved. A successful solution must change canonical resources and repair shields; reloading must preserve it.
4. Choose **Open final decision**, then send `!vote 1`. Its advisory tally should change. The captain reviews the forecast and commits; chat votes cannot directly commit a sacrifice.
5. Send `!status` or `!history`. Confirm the dedicated bot visibly replies in Twitch chat and that Broadcast records a sent outcome. Repeated requests are coalesced for ten seconds; wait before retrying.
6. In chapter 3, use `!scan A`, then `!patch A`, and cooperate on the remaining prerequisites. Repairs should change life support, oxygen and future consequences. The interface explains the current reward.

Check the public exposure scan with `pnpm check:public-secrets`. It checks configured credentials and saved tokens in Git, browser output, local logs and selected public responses. It first identifies the live application; an offline/tunnel error returns **partial** with exit 2. `pnpm check:public-secrets --artifacts-only` explicitly checks local artifacts while HTTPS is unavailable and does not verify public routes. These are bounded checks, not claims of universal security.

**Confirm:** record an actual chat message → accepted action → visible canonical change, plus a visible bot reply. Fixture tests and synthetic messages do not satisfy this acceptance stage. Bot sending may be recorded as failed, dropped or uncertain; HTTP success alone is insufficient. Keep tokens and private overlay links out of recordings.

## 9. Add the read-only game view to OBS

1. In the creator dashboard choose **Generate / rotate OBS link**, then **Copy OBS link**. Keep that complete link private. Opening the overlay exchanges its capability for a read-only session and removes the fragment from that tab's address bar; the post-exchange address alone does not grant a fresh OBS browser access.
2. In OBS, under **Sources**, select **+ → Browser**, name it **TORCHLINE**, leave **Local file** off and paste the complete generated link in **URL**.
3. Set **Width 1920, Height 1080**, or **1280 × 720** for a 720p scene. Enable custom frame rate and set **30 FPS**. Match the source dimensions to your intended scene rather than stretching a default 800 × 600 viewport. [OBS Browser Source properties](https://obsproject.com/kb/browser-source)
4. Keep browser page permissions at their minimum; TORCHLINE does not need permission to modify OBS. Start with **Shutdown source when not visible** and **Refresh browser when scene becomes active** off, then explicitly test scene switching/reloading with the generated link on your OBS version.
5. Check crisis title, resource values, system conditions, puzzle constraints and chat command guidance in the OBS preview and in a short recording viewed on a phone. The source must contain no captain, operator or simulator buttons.
6. Solve or commit something from the dashboard/chat. Confirm OBS updates without refresh. Hide/show the source, refresh once, and test reconnection. Compare ship damage after a new chapter or handoff.

The cinematic ship is optional; unavailable graphics fall back to the schematic. Browser tests cover both canvas sizes and fallback behavior. Actual OBS frame rate, CEF compatibility, scene switching and phone broadcast legibility remain owner acceptance tests. The current composition is a full game scene with a dark background, suitable for a dedicated game segment; a transparent gameplay-over-video preset is separate future work.

Rotating the OBS link revokes prior overlay access. Update the OBS URL after rotation and do not share it publicly. The overlay can read its channel's current Ark, not change it. Use creator sign-in in a normal browser for controls.

## 10. Verify the defining native raid transfer

Arrange **two consenting live broadcasters**. This external dependency is not yet confirmed. Run a simulator rehearsal separately first if needed; its evidence cannot authorize a live transfer.

1. Receiver: connect their creator account, opt into offers under Relay, have **no active Ark**, reconcile current subscriptions, go live and permit the source's raid in Twitch settings. Park an existing active Ark from Bridge; it remains in the Hangar for later.
2. Source: play through a chapter and commit a decision. At the ready chapter boundary, choose the receiving creator in Relay and **Prepare handoff**. Readiness checks must pass. Mutations freeze while the prepared intent is pending.
3. Source: perform Twitch's genuine native raid using Twitch's normal broadcaster controls. TORCHLINE does not currently request permission to initiate raids on your behalf.
4. Watch Relay change from prepared to verified only after a signed native `channel.raid` event matches the persisted source/target/time window. Do not replace this evidence with a screenshot, chat command or simulator.
5. Receiver: remain live and choose **Accept inherited Ark** before the intent expires. Acceptance is an explicit second consent step. If the intent expires, cancel/reprepare and perform a fresh qualifying raid; do not reuse old evidence.
6. Compare world ID, resources, chapter, physical damage/repairs, obligations and event causes. The receiver now controls that same Ark; the source and its overlay no longer show it as active. Start the next chapter under the new host.

**Confirm:** record sanitized signed proof metadata, receiver acceptance and persistent state continuity. Duplicate delivery/acceptance must not transfer twice. The source may go offline after the raid; the receiver must still be live at acceptance. Decline/cancel leaves custody with the source. Raids are never required to finish the solo season.

## Permanent hosting: proposed Render setup

No hosting has been purchased or deployed. Review the provider plan, region and backup policy before creating billable resources. The approved topology is **one always-on Node web service and one managed PostgreSQL 17 database** in the same region. A sleeping web service is unsuitable for timely callbacks and live play.

1. In Render, connect the private GitHub repository with the account that has access. Select the reviewed commit/branch; current implementation is on `feat/gameplay-foundation`, not the older planning-only `main`. Set auto-deploy **Off** during initial setup so incremental pushes do not publish unreviewed changes. Later use **After CI Checks Pass** when approved. [Render deployment controls](https://render.com/docs/deploys)
2. Create managed PostgreSQL 17, note its private connection URL, and configure backups/retention. Start a fresh live database or arrange a controlled backup/restore of the existing live database; do not casually copy data or replace the encryption key.
3. Create a **Node web service** at the repository root, one replica, no persistent local filesystem dependency. Obtain its assigned HTTPS origin. Keep the repository private; a public Git URL is unnecessary. [Render Node service setup](https://render.com/docs/deploy-node-express-app)
4. Pin Node to `.node-version` (24.22.1) and pnpm to packageManager (12.4.2). Proposed build command: `npx --yes pnpm@12.4.2 install --frozen-lockfile && npx --yes pnpm@12.4.2 build`. Proposed pre-deploy command: `npx --yes pnpm@12.4.2 db:migrate`. Start command: `node apps/server/src/main.ts`. These cloud commands require a first deployment test; local build/migrations are already exercised. [Node version selection](https://render.com/docs/node-version)
5. Add the private environment values from stage 4, `HOST=0.0.0.0`, live `DATABASE_URL`, the final HTTPS origin and its exact redirect. Let Render supply `PORT`. A fresh environment needs independent random secrets; for example `node -p "require('node:crypto').randomBytes(32).toString('hex')"` generates one locally. Use a different value for each secret. Do not replace existing keys for a restored database.
6. Add the final OAuth redirect in Twitch's console before consenting on the new origin. Configure `/health/ready` as the HTTP health check. Run migrations successfully before starting the app. [Render health checks](https://render.com/docs/health-checks)
7. Perform the reviewed deployment, then repeat stages 5–10 on that origin. Verify SSE updates/reconnect through the real hosting edge; a successful health check does not establish streaming behavior. Reconcile subscriptions to the new callback, verify exact current metadata, and replace every OBS link with one generated on the new origin.
8. Test a restart, token refresh/revocation, backup restore and rollback before treating hosting as ready for judging. Keep one replica: multi-instance fan-out and worker ownership are a separate scale-out gate. Preserve the tested commit and sanitized acceptance evidence.

## If something fails

### New episode controls (ark-v3)

Existing Arks keep their original ark-v2 rules. Create a new Ark to use investigation, allocation and timers. At a ready chapter boundary, set a repair reserve (0–10 power), optionally enable investigation, then save crew settings. Timing defaults to 30/90/45/60 seconds for investigation/challenge/allocation/voting; select and save Manual to close every phase yourself. The authenticated timing API also supports custom 15–1800-second durations. No timer makes the final story choice.

During investigation viewers use `!inspect engine`, `!inspect cargo` or `!inspect life`. Close it to reveal the chosen real clue. During allocation use `!allocate 3 2` for three hull and two oxygen preference points (1–5 total). The shared plan divides the declared reserve, not an audience-sized reward. Lock repairs, collect `!vote 1`/`!vote 2`, then commit. Power and useful repairs apply together with the choice; the preview includes the result. Oxygen recovery does not repair a leaking machine. Reserve settings reset each chapter.

Pause, park, authorization disconnect and verified offline delivery stop the current episode; returning online never resumes automatically. After a server restart, check the recovery explanation and click Resume. Pre-cutoff accepted chat drains before closure. Messages first received after the deadline are rejected. Broadcast diagnostics show pending/retrying/quarantined input; retry is available only for quarantined chat still in your current window. It never resends uncertain bot replies or reuses raid evidence.

Actual installed OBS verification was attempted on October 27, but computer-use initialization failed before any app action. Chromium overlay coverage does not replace your OBS browser-source, cookie refresh and frame-time check in stage 9. Restoring the ngrok credential and a real two-broadcaster raid remain external dependencies; no new account registration is needed for the already validated grants.

| Symptom | Check next |
| --- | --- |
| ngrok offline / `ERR_NGROK_4018` | Saved ngrok account credential and `--config .local/ngrok.yml`; local port 3001 must also be running |
| OAuth redirect mismatch | Exact redirect in Twitch console and `.env.live`; restart after editing |
| Wrong Twitch account shown | Stop that consent flow; use the intended browser account. Do not convert your main creator into the bot. |
| Bot grant missing | Separate operator-protected bot consent; creator login alone does not authorize it |
| Chat subscription not ready | Bot/current broadcaster grants, public callback reachability, then Broadcast reconciliation |
| Delivered chat but no effect | Active live Ark, correct broadcaster channel, open phase, valid grammar, and applied-action diagnostics; old windows/deduplicated input intentionally do not apply |
| No bot message | `!status`/`!history`, pacing/coalescing, provider outcome, real channel; do not spam requests |
| Overlay blank or access ended | Original complete capability link, current grant after rotation, active Ark and source dimensions; graphics should fall back automatically |
| Handoff cannot prepare/accept | Correct mode, current custody, chapter boundary, opted-in idle receiver, current subscriptions/grants, stream readiness and unexpired intent |
| Raid still only prepared | Genuine raid settings/event delivery, source/target/time match, incoming subscription; simulated proof cannot repair a live verification gap |

Keep [implementation status](../planning/implementation-status.md) as the evidence record. Mark a milestone verified only after its specific real-service confirmation succeeds.
