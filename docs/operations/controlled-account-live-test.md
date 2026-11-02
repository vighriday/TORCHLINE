# Live test with the accounts I already have

Updated November 1, 2026. The evidence and phase notes below are dated snapshots, not current status. Use **hriday29** as broadcaster and **hriday_29** as bot. No third account is needed for chat, gameplay, OBS or recovery tests. A second consenting broadcaster is needed only for the authentic raid; arrange that later. Never convert the bot into a broadcaster.

## What has actually happened

| Check | Dated evidence |
| --- | --- |
| Public HTTPS, callback and required subscriptions | As of October 29, real public checks passed through the temporary development tunnel; both saved grants validated and 3/3 exact chat/online/offline subscriptions were enabled. No permanent hosting exists |
| Real chat reaching the application | Four genuine signed query deliveries by 10:10 UTC on October 29; three genuine viewer messages on October 30 |
| Bot reply | First send rejected with `msg_rejected`. Twitch accepted two later bot replies but no independent viewer saw them; the cause is unresolved and replies are disabled in the live configuration (`BOT_REPLIES_ENABLED=false`) |
| Chat changing the Ark | On October 30 three genuine viewer chat messages (from an ordinary viewer account, not the broadcaster or bot) arrived as signed `channel.chat.message` notifications and were saved as `scan` gameplay events on a live Ark. An overlay update caused by live chat has not been recorded on video |
| OBS | As of October 29, actual OBS 32.2.2 rendered the live HTTPS Ark and recovered across a controlled app outage without source reload. Native OBS 32.2.2 rendered the 30 Oct final-design build in isolated saved practice; the current build and live-chat-driven updates are not yet verified in OBS |
| LIVEWIRE | One live mission was opened and expired; no attested live result exists |
| Native raid | No native proof or live custody change; second broadcaster is an external dependency |

The signed query proves inbound delivery, not gameplay. `!status` does not change the Ark. Existing practice worlds and fixture providers do not count as Twitch evidence.

## Engineering preparation — already automated

From the repository root with Node 24 and pnpm 12.4.2 on PATH:

```powershell
pnpm db:up
pnpm build
pnpm live:up
pnpm live:check
```

`live:up` checks the existing live database/migration, reuses a healthy local service and starts missing live/strict-SSH processes. It never stops an unknown process or overwrites `.env.live`. Logs and started PIDs remain under ignored `.local/`. Since October 28, live tests used ngrok's SSH reverse tunnel (`pnpm live:ssh`); no ngrok agent binary is needed. A new machine first registers its project key ([SSH setup](live-release-checklist.md#1-restore-public-https)).

Normal server startup validates/refreshes existing grants and reconciles subscriptions. `live:check` runs real public/provider probes plus read-only acceptance counters, preserves the existing acceptance baseline and shows the current Ark phase. Exit 2 means acceptance remains incomplete, not necessarily that setup failed. These commands never log into Twitch, send chat, choose an ending, start OBS streaming or invent a raid.

Site: `https://YOUR_ORIGIN`. Exact registered callback: `https://YOUR_ORIGIN/auth/twitch/callback`. Keep computer/database/app/SSH awake. No permanent live hosting exists; a disposable practice demo runs at https://torchline-demo.onrender.com ([ADR 0039](../decisions/0039-hosted-practice-demo.md)). Live Twitch tests used a temporary development tunnel on the owner's PC. Judges can run `docker compose up --build` (verified in CI).

## 1. Bot replies — paused, cause unresolved

Twitch accepted two bot replies but no independent viewer saw them; the cause is unresolved and replies are disabled in the live configuration. `BOT_REPLIES_ENABLED=false` pauses outgoing replies while incoming participation continues. **Continue gameplay and OBS first.** No further trial messages or blind reauthorizations are requested. Keep the existing accounts, scopes and protections. [The October 29 diagnosis](../reports/2026-10-29-integration-diagnosis.md) separates application, authorization and provider evidence.

Manual messages appearing in the bot's own window alone do not establish cross-account visibility. The bot deliberately ignores its own queries. A future reply retest should follow an identified account/provider change, set `BOT_REPLIES_ENABLED=true` and use one command with an independent observation window. The code `msg_rejected` alone does not identify a cause. Old failed or uncertain sends will not be replayed automatically. Broadcast exposes the latest outcome privately; an accepted send still needs visual confirmation.

## 2. Prove real gameplay without another account

Engineering runs `pnpm twitch:verify:play` first. It watches genuinely signed gameplay, its canonical event and the visible HTTPS overlay clue after reload. The owner performs only the next phase-valid action; no additional bot query is needed. A timeout is not a pass.

1. Open TORCHLINE as **Captain / hriday29**, using the existing Ark. At the October 29 check it was in chapter 2's **awaiting-commit** phase; use the current displayed state. Do not create a replacement to test an obsolete scan.
2. Review the two consequences and commit your own preferred current choice. At the next **ready** boundary save Manual timing if available, then start that chapter. Manual timing makes the acceptance session easy to coordinate; it does not bypass any puzzle or custody rule. Older manual-rule worlds keep their original timing.
3. While the displayed challenge is open, send the displayed legal command from **hriday29's actual Twitch chat**, for example `!scan A` if A is still unknown. Confirm its clue changes in TORCHLINE and survives reload.
4. Submit the solved route shown by the puzzle's rules. Check the resulting resources/ship condition. In the decision phase send `!vote 1` before advice closes; only the captain can commit.
5. Run `pnpm live:acceptance check`. `signedChat` and `persistedChatActions` should increase for this action. `nativeAcceptedReplies` is a separate outbound counter and need not change for gameplay. Inspect the visible consequence as well.

The broadcaster is an eligible ordinary participant; using it exercises real Twitch transport without fabricating another viewer. This does not replace multi-person audience usability/cooperation testing. Bot-authored commands remain ignored.

## 3. Prove actual OBS

1. In TORCHLINE's Captain tools generate/copy the private OBS link. Do not share the full URL; its fragment grants read access.
2. In OBS choose **Sources → + → Browser**, name it TORCHLINE and paste the complete URL. Use **1920 × 1080** or **1280 × 720**, with **30 FPS**. Start with source shutdown/refresh-on-activation disabled. [OBS properties](https://obsproject.com/kb/browser-source).
3. Confirm the real Ark, phase, resources and damaged/repaired systems match the dashboard; no captain/operator controls appear. Trigger the legal chat action from step 2 and observe OBS update without a refresh.
4. Hide/show and refresh the source. Briefly interrupt and restore its connection. The current saved state should return without repeating consequences. As of October 29 a controlled local app outage passed in native OBS; deliberate refresh, hide/show and the owner's actual source still need confirmation.
5. Record a short local sample and inspect it on a phone for legibility. Streaming publicly is not required for this local OBS test. Rotate the link, check the old source loses access, then update OBS with the newly generated link.

Engineering can run `pnpm twitch:verify:obs` against the prepared isolated OBS profile while its temporary source is current. It checks native CEF, the current built asset, first-frame readiness, no host controls, zero OBS page-control permission and inactive outputs, then saves a private native-source screenshot. It does not launch OBS or alter its sources. A fresh free-ngrok source can show the provider's HTML warning: the isolated development instance uses ngrok's documented custom client user agent; permanent HTTPS hosting is the release solution. [October 29 native evidence and limitations](../reports/2026-10-29-integration-diagnosis.md).

Engineering can run `pnpm twitch:verify:overlay` against real HTTPS with an independent five-minute read-only grant and no world mutation. It revokes only its own temporary grant. That is a useful connection/permission check, not OBS acceptance.

## 4. Authentic raid — only when a second broadcaster is available

Use a friend's existing consenting broadcaster or a separate controlled account later. They authorize as a creator, enable incoming offers in Inheritance, have no active Ark and repair subscriptions so incoming `channel.raid` is current and provider-confirmed. Keep **hriday_29** exclusively as the bot.

Simplest complete recording: each broadcaster uses their usual OBS/computer. A computer plus phone can establish two real live channels: the receiver uses Twitch's camera/IRL broadcast and accepts in a separate browser. However, the native Twitch mobile broadcaster does **not** support browser overlays, so this verifies receiver presence/custody only, not the inherited Ark in their outgoing video. [Twitch mobile limitations](https://help.twitch.tv/s/article/mobile-game-broadcasting).

One computer can alternatively run two OBS instances with different profiles and scene collections; OBS documents `--multi`, `--profile` and `--collection`. Configure each account/source separately, check both outgoing channels and available upload/encoding capacity first. This is a documented option, not a setup the project has validated. [OBS launch parameters](https://obsproject.com/kb/launch-parameters).

1. Both creators go live. On the receiving account review Twitch's incoming raid settings so the source is allowed. Twitch exposes viewer-range, account-age and optional group restrictions; TORCHLINE cannot override them. [Twitch raid controls](https://help.twitch.tv/s/article/how-to-use-raids?language=en_US&langue=en_US).
2. At a **ready chapter boundary**, hriday29 prepares an offer to that exact receiver. Save a private before-state comparison of chapter/resources/condition/history. This freezes changes until completion/cancellation/expiry.
3. As hriday29 use Twitch's native **Raid Channel** control or `/raid RECEIVER_LOGIN`, then complete Twitch's countdown/confirmation. No TORCHLINE chat command initiates a raid.
4. Inheritance must become verified only after signed native evidence matches source, target and the persisted time window. A small raid is not guaranteed to produce a qualifying provider event; do not fabricate viewers or substitute a screenshot if it does not.
5. Receiver stays live, inspects and explicitly accepts before expiry. Check the same Ark and all consequences moved; hriday29 loses controls and its overlay no longer shows that Ark. Start the next chapter at the receiver.
6. Run `pnpm live:acceptance check`; require a linked native live transfer, plus observation of inherited state and source authority removal. Do not conduct another real raid merely to test duplicate delivery; automated replay/race tests cover duplicates separately.

If it expires, cancel/reprepare and perform a fresh qualifying raid; never reuse old proof. Source may go offline after the raid; receiver must remain live at acceptance. Solo play continues regardless of when this external test is arranged.

## Keep the evidence honest

Record UTC time, source revision, displayed phases, observed result and sanitized counter deltas. Keep raw chat, keys, browser sessions and overlay URLs private. Preserve the existing baseline; replace it only deliberately. A live query, an applied action, a provider-accepted send, a visible reply, an OBS render and a native transfer are six separate assertions.

For permanent hosting, see [deployment](deployment.md) and [backup/restore](backup-and-restore.md). Hosting/secret-store/remote backup choices remain owner decisions; no cloud service or purchase has been provisioned.
