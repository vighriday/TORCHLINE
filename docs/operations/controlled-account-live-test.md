# Live test with the accounts we already have

Updated October 29, 2026. Use **hriday29** as broadcaster and **hriday_29** as bot. No third account is needed for chat, gameplay, OBS or recovery tests. A second consenting broadcaster is needed only for the authentic raid; arrange that later. Never convert the bot into a broadcaster.

## What has actually happened

| Check | Current evidence |
| --- | --- |
| Public HTTPS, callback and required subscriptions | Real public checks pass; both saved grants validate and 3/3 exact chat/online/offline subscriptions are enabled |
| Real chat reaching the application | Four genuine signed chat deliveries by 10:10 UTC on October 29 |
| Bot reply | First send rejected with `msg_rejected`; two fresh sends accepted with `is_sent=true` and message IDs. Independent viewer sees the broadcaster query but no bot reply; visible acceptance is still failing |
| Chat changing the Ark | Not yet observed against Twitch. SQL/provider-fixture tests pass separately |
| OBS | Public Chromium overlay connection tested previously; actual OBS browser rendering/updates/reconnect still unproven |
| Native raid | No native proof or live custody change; second broadcaster is an external dependency |

The signed query proves inbound delivery, not gameplay. `!status` does not change the Ark. Existing practice worlds and fixture providers do not count as Twitch evidence.

## Engineering preparation — already automated

From the project terminal using Node 24:

```powershell
$env:PATH = "$PWD\.tools\node24;$env:PATH"
pnpm db:up
pnpm build
pnpm live:up
pnpm live:check
```

`live:up` checks the existing live database/migration, reuses a healthy local service and starts missing live/strict-SSH processes. It never stops an unknown process or overwrites `.env.live`. Logs and started PIDs remain under ignored `.local/`. The registered SSH key already exists on this machine; no additional account action is needed. Do not restore the quarantined ngrok executable.

Normal server startup validates/refreshes existing grants and reconciles subscriptions. `live:check` runs real public/provider probes plus read-only acceptance counters, preserves the existing acceptance baseline and shows the current Ark phase. Exit 2 means acceptance remains incomplete, not necessarily that setup failed. These commands never log into Twitch, send chat, choose an ending, start OBS streaming or invent a raid.

Current site: [TORCHLINE](https://education-slather-reps.ngrok-free.dev). Exact registered callback: `https://education-slather-reps.ngrok-free.dev/auth/twitch/callback`. Keep computer/database/app/SSH awake. This temporary preview is not permanent production hosting.

## 1. Resolve the bot account's rejection

**Current result:** two broadcaster queries produced provider-accepted replies with the correct account IDs, but an independent listener received the fresh broadcaster query and no bot output. The owner also manually sent as **hriday_29** entirely in Twitch and confirmed that message is missing from the broadcaster's browser. The problem therefore also occurs without TORCHLINE's send code. Mod View was empty; the exact cause remains unknown. No additional chat queries are needed now.

**Current owner checks:** in the private bot window open [Security and Privacy](https://www.twitch.tv/settings/security). Verify the profile menu says **hriday_29**, inspect email verification/account prompts, then under **Privacy → Show Blocked Users** check only whether **hriday29** is listed. The standalone **Add a number** option is not itself a phone-verification error. In the broadcaster's settings, similarly inspect whether **hriday_29** is blocked. Report the relevant result without sharing the rest of the list. Inspect first; do not disable protections or change roles as a guess.

If verification requests and account blocks do not explain it, use [Twitch Support](https://help.twitch.tv/s/contactsupport) for this reproducible native/manual delivery failure. A private draft with exact provider timestamps/message IDs is prepared at ignored `.local/twitch-chat-support.md` on the owner's machine. No request has been submitted automatically. [Twitch's troubleshooting](https://help.twitch.tv/s/article/why-cant-i-chat) lists the relevant account checks and possible temporary limitations; none is established as the cause here. Keep the existing app, accounts and validated grants.

The steps below remain the initial diagnostic/retest procedure if setting up a different session. Manual messages appearing in the bot's own window alone do not establish cross-account visibility. The bot deliberately ignores its own queries.

1. Keep the ordinary Twitch window signed in as **hriday29**.
2. Open a private/incognito window and sign into Twitch as **hriday_29**. Check the underscore in the actual account menu.
3. In that private window open [hriday29's chat](https://www.twitch.tv/popout/hriday29/chat). Try `TORCHLINE bot check`. Complete any Twitch rules or account verification prompt yourself. A message labeled **hriday29** tests the broadcaster, not the bot.
4. Report whether the bot message appears, or the exact non-secret rejection. Do not change channel protections, grant moderator permissions or repeat bot authorization as a blind fix.
5. Once the bot can speak, return to the ordinary **hriday29** chat and send `!status`. Wait at least ten seconds between query attempts. Confirm a visible reply from **hriday_29**.

We checked the read-only Twitch chat settings: emote/follower/subscriber/slow/unique modes are off. That endpoint does not establish email/phone verification or account restrictions. The code `msg_rejected` alone does not identify the cause. Old failed or uncertain sends will not be replayed automatically. Broadcast now exposes the latest outcome privately; a native accepted send still needs visual confirmation.

## 2. Prove real gameplay without another account

1. Open TORCHLINE as **Captain / hriday29**, using the existing Ark. At preparation time it is in chapter 1's **awaiting-commit** phase. Do not create a replacement to test an obsolete scan.
2. Review the two consequences and commit your own preferred chapter 1 choice. At the next **ready** boundary choose Manual timing if available, then start chapter 2. Manual timing makes the acceptance session easy to coordinate; it does not bypass any puzzle or custody rule. Older manual-rule worlds keep their original timing.
3. While the displayed challenge is open, send the displayed legal command from **hriday29's actual Twitch chat**, for example `!scan A` if A is still unknown. Confirm its clue changes in TORCHLINE and survives reload.
4. Submit the solved route shown by the puzzle's rules. Check the resulting resources/ship condition. In the decision phase send `!vote 1` before advice closes; only the captain can commit.
5. Run `pnpm live:acceptance check`. `signedChat`, `persistedChatActions` and `nativeAcceptedReplies` should increase for their respective actions. Inspect the visible consequence and reply as well.

The broadcaster is an eligible ordinary participant; using it exercises real Twitch transport without fabricating another viewer. This does not replace multi-person audience usability/cooperation testing. Bot-authored commands remain ignored.

## 3. Prove actual OBS

1. In TORCHLINE's Captain tools generate/copy the private OBS link. Do not share the full URL; its fragment grants read access.
2. In OBS choose **Sources → + → Browser**, name it TORCHLINE and paste the complete URL. Use **1920 × 1080** or **1280 × 720**, with **30 FPS**. Start with source shutdown/refresh-on-activation disabled. [OBS properties](https://obsproject.com/kb/browser-source).
3. Confirm the real Ark, phase, resources and damaged/repaired systems match the dashboard; no captain/operator controls appear. Trigger the legal chat action from step 2 and observe OBS update without a refresh.
4. Hide/show and refresh the source. Briefly interrupt and restore its connection. The current saved state should return without repeating consequences. New recovery tests cover this in Chromium; only this step proves OBS's actual browser engine.
5. Record a short local sample and inspect it on a phone for legibility. Streaming publicly is not required for this local OBS test. Rotate the link, check the old source loses access, then update OBS with the newly generated link.

Engineering can run `pnpm twitch:verify:overlay` against real HTTPS with an independent five-minute read-only grant and no world mutation. It revokes only its own temporary grant. That is a useful connection/permission check, not OBS acceptance.

## 4. Authentic raid — only when a second broadcaster is available

Use a friend's existing consenting broadcaster or a separate controlled account later. They authorize as a creator, enable incoming offers in Relay, have no active Ark and repair subscriptions so incoming `channel.raid` is current and provider-confirmed. Keep **hriday_29** exclusively as the bot.

Simplest complete recording: each broadcaster uses their usual OBS/computer. A computer plus phone can establish two real live channels: the receiver uses Twitch's camera/IRL broadcast and accepts in a separate browser. However, the native Twitch mobile broadcaster does **not** support browser overlays, so this verifies receiver presence/custody only, not the inherited Ark in their outgoing video. [Twitch mobile limitations](https://help.twitch.tv/s/article/mobile-game-broadcasting).

One computer can alternatively run two OBS instances with different profiles and scene collections; OBS documents `--multi`, `--profile` and `--collection`. Configure each account/source separately, check both outgoing channels and available upload/encoding capacity first. This is a documented option, not a setup validated on this machine. [OBS launch parameters](https://obsproject.com/kb/launch-parameters).

1. Both creators go live. On the receiving account review Twitch's incoming raid settings so the source is allowed. Twitch exposes viewer-range, account-age and optional group restrictions; TORCHLINE cannot override them. [Twitch raid controls](https://help.twitch.tv/s/article/how-to-use-raids?language=en_US&langue=en_US).
2. At a **ready chapter boundary**, hriday29 prepares an offer to that exact receiver. Save a private before-state comparison of chapter/resources/condition/history. This freezes changes until completion/cancellation/expiry.
3. As hriday29 use Twitch's native **Raid Channel** control or `/raid RECEIVER_LOGIN`, then complete Twitch's countdown/confirmation. No TORCHLINE chat command initiates a raid.
4. Relay must become verified only after signed native evidence matches source, target and the persisted time window. A small raid is not guaranteed to produce a qualifying provider event; do not fabricate viewers or substitute a screenshot if it does not.
5. Receiver stays live, inspects and explicitly accepts before expiry. Check the same Ark and all consequences moved; hriday29 loses controls and its overlay no longer shows that Ark. Start the next chapter at the receiver.
6. Run `pnpm live:acceptance check`; require a linked native live transfer, plus observation of inherited state and source authority removal. Do not conduct another real raid merely to test duplicate delivery; automated replay/race tests cover duplicates separately.

If it expires, cancel/reprepare and perform a fresh qualifying raid; never reuse old proof. Source may go offline after the raid; receiver must remain live at acceptance. Solo play continues regardless of when this external test is arranged.

## Keep the evidence honest

Record UTC time, source revision, displayed phases, observed result and sanitized counter deltas. Keep raw chat, keys, browser sessions and overlay URLs private. Preserve the existing baseline; replace it only deliberately. A live query, an applied action, a provider-accepted send, a visible reply, an OBS render and a native transfer are six separate assertions.

For permanent hosting, see [deployment](deployment.md) and [backup/restore](backup-and-restore.md). Hosting/secret-store/remote backup choices remain owner decisions; no cloud service or purchase has been provisioned.
