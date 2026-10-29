# Integration diagnosis and recovery follow-up — October 29

Times and evidence dates below are UTC; work continued into October 30 locally.

TORCHLINE is a functioning preview with genuine Twitch ingress, working persistent gameplay and a newly verified native OBS render. It is not yet a fully accepted live Twitch release. Bot visibility, a genuine command changing the Ark, native raid transfer and permanent hosting remain distinct gates.

## Bot delivery: findings by boundary

| Boundary | Evidence already collected | Conclusion and remaining uncertainty |
| --- | --- | --- |
| Application behavior | Correct broadcaster/sender IDs, source-only request, short plain-text reply; channel/global pacing; self-message exclusion; queued work independent of gameplay. Fixture tests cover denied, slow and ambiguous sends. | No evidence the missing native reply is caused by malformed bodies, wrong recipient, recursive bot commands or a locally flooded send queue. This does not certify every application behavior. |
| Authorization | Registered app and both independent grants validate with required scopes; exact signed chat subscription is enabled. Two native API responses returned `is_sent=true` with message IDs. | Authentication and request acceptance work. Reauthorization or wider scopes are not justified by the current symptom. An accepted send does not prove distribution to viewers. |
| Channel restrictions | Public chat settings show emote/follower/subscriber/slow/unique modes off. Owner inspected Mod View: no relevant AutoMod hold or removal. Both directions of blocking checked and absent. | Those specific explanations have been checked. Get Chat Settings does not expose all email/phone/account enforcement rules, and an empty queue cannot establish that no provider filtering exists. Do not disable protections or promote the bot to test around them. |
| Account/provider distribution | Owner confirmed correct bot identity and verified email. A manually typed bot message, sent entirely within Twitch, appeared in its own window but was absent in the broadcaster's window. A separate read-only listener received a broadcaster query but not its API-generated bot reply. | Failure also reproduces outside TORCHLINE's sending path. Account-specific restrictions, channel verification rules not exposed by our current API scopes, or a Twitch distribution fault remain plausible. There is no proof of a global suspension, “shadowban,” exact restriction or account-wide rate limit. |

The first native send returned `msg_rejected`; its human-readable explanation was not retained, so it cannot be reconstructed. Two subsequent sends were accepted but remained unobserved by the other account. The manual control's listener had already stopped: only the owner's cross-account confirmation supports that particular control. These observations must not be merged into stronger evidence than was collected.

Completed checks will not be repeated as busywork. Do not request more `!status`/manual trial messages without a specific hypothesis, observation window and expected distinguishing result. There is no existing granted API that reveals every private account-enforcement decision. Do not request additional moderation scopes merely to investigate this failure. The ignored support draft preserves exact provider identifiers for a later owner-initiated inquiry; no message has been sent to Twitch or anyone else.

One owner-only inspection remains unperformed if bot diagnosis is resumed: broadcaster Creator Dashboard → Moderation → Settings (Moderation) → Chat Verification, to record the current email/phone requirements. The read-only API checked here does not expose those thresholds. Inspect only; do not disable protections, grant a privileged role or send another trial message just to repeat the existing failure. If that does not explain it, the remaining account-enforcement/distribution information must come from Twitch; the product can continue without outbound replies. [Twitch verification settings](https://help.twitch.tv/s/article/chat-verification-settings?language=en_US).

Official references rechecked: [Send/receive messages](https://dev.twitch.tv/docs/chat/send-receive-messages/), [API request/response](https://dev.twitch.tv/docs/api/reference#send-chat-message), [chat troubleshooting](https://help.twitch.tv/s/article/why-cant-i-chat). The documented leading-dot/slash issue does not match TORCHLINE's ordinary reply bodies. Possible restrictions in troubleshooting documentation are hypotheses, not a diagnosis of this account.

## Independently resolved

- Outgoing replies have an operator switch, `BOT_REPLIES_ENABLED=false`. Incoming chat, puzzles, votes, allocations, persistence and overlays retain their normal authority. No bot-role change, transport workaround or synthetic success. Signed provider-fixture/real-PostgreSQL tests prove a persisted scan and read-only overlay projection while both newly requested and previously queued outbound replies are paused.
- Audit A08's SQL execution gap: runtime server-side statement/lock/idle-transaction limits, complete rollback, dead-client disposal and a separate bounded maintenance allowance. Tests actually cancel PostgreSQL statements, contend over a locked row, terminate an idle transaction and exercise encrypted restore. Other A08 edge/retention/telemetry work remains open.
- Audit A13: timing policy now comes from the saved clock; Manual survives reload and custom policies survive a save without being replaced by defaults. Timing drafts are independent of unrelated crew-setting acknowledgements. Passenger capacity is 216 consistently; low-integrity repaired systems retain warning colors. This does not replace audience usability testing.

## Native OBS evidence

Installed **OBS 32.2.2**, obs-browser **2.26.9 / CEF 127**, authenticated obs-websocket **5.7.4**, Windows. An isolated portable copy used its own configuration, one TORCHLINE browser source and no active stream or recording. Default audio inputs were removed. The owner's original OBS profile was not modified. A real 1280×720 native-source screenshot shows the current live chapter, resources and rendered 3D Ark. Native DOM inspection confirms no buttons, inputs, selects or textareas. `twitch:verify:obs` reproduces the read-only native probe while that isolated instance and temporary access are active.

This revealed a real preview problem: ngrok's free HTML warning occupies a fresh default OBS source. The isolated developer instance uses ngrok's documented custom nonstandard user agent to load its own development site; TORCHLINE authentication, TLS checks and capability scope remain intact. This is a preview-client configuration, not a fix shipped to viewers or a permanent deployment. Use a stable production HTTPS origin for the actual release. [ngrok guidance](https://ngrok.com/docs/pricing-limits/free-plan-limits#removing-the-interstitial-page), [OBS portable mode](https://obsproject.com/kb/portable-mode), [OBS browser debugging](https://github.com/obsproject/obs-studio/wiki/Browser-source-development-and-debugging).

The layout build was checked at 18:26 UTC and the Archive cleanup build rechecked at 18:55 UTC: native source permissions are zero, the 3D first frame is ready and both the rendered script and stylesheet match the built application. Both screenshots were visually inspected. The probe rejects ambiguous same-channel CEF targets and checks the source's exact temporary URL; the application correctly removes the fragment after capability exchange. Waiting for the OBS compositor avoids recording the preceding connection screen as the result.

A controlled twelve-second local app outage then produced a visible reconnecting state in the actual native source. It recovered without a source reload, with no controls and an unchanged canonical Ark fingerprint. No stream or recording was started. Native gameplay-driven updates, deliberate source refresh, rotated-link rejection, broadcast output and phone legibility remain separate assertions. Chromium and fault-injected browser tests retain their existing labels.

## Genuine gameplay acceptance

At the 18:16 UTC real-service check, four signed native chat deliveries and two provider-accepted bot sends were recorded; zero applied native gameplay actions and zero native raids/transfers since the preserved baseline. The Ark is now in chapter 2 `awaiting-commit`; scans/votes are closed. Both grants and exact 3/3 subscriptions validate. More queries cannot prove gameplay.

`pnpm twitch:verify:play` observes the actual public HTTPS overlay and joins signed chat delivery → processed inbox → canonical viewer event in PostgreSQL. It then checks the visible clue, absence of controls and persistence after page reload. It never sends chat, commits a choice, creates a simulation or resets the acceptance baseline. Its temporary read-only capability and screenshots stay ignored locally; cleanup removes only its own grant. An observation timeout is explicitly not a pass. The first observation timed out without a new valid command.

The owner's attempted test instead exposed serious layout problems. Those are corrected before asking for another command. For the next coordinated acceptance window, commit the current preferred consequence, save Manual timing at the next ready boundary, start that chapter, and send a displayed legal scan as hriday29 while its challenge is open. This uses a real eligible account through Twitch without pretending it is a second person. A later solve/consequence and multi-person cooperation still need their own evidence. Bot visibility does not gate this test.

## Verification and remaining release work

The production build/typecheck, **107 automated tests across 26 files** and **all 14 browser journeys** pass locally, including real PostgreSQL cancellation/rollback, encrypted SQL backup/restore, saved Manual/custom timing, graphics loss/retry, cold loading, read-only overlays and simulated custody. Current-rule colony/partial/wreck witnesses replay exactly; these are not exhaustive cooperation-balance coverage. Exact-source CI is recorded separately from local execution.

The UI review captured 29 actual application/engine-derived states at five sizes (1920×1080, 1440×900, 1280×720, 820×1180, 390×844): 145 captures, with no detected horizontal overflow or controls outside the horizontal viewport. Eight additional anonymous actual-public title/setup captures also pass those checks. Representative screens, all ending types and native OBS were visually inspected; meaningful region collisions and the commit hit target have automated guards. This is scoped visual verification, not universal accessibility or audience acceptance. See the [layout findings](../reviews/2026-10-29-ui-layout-review.md).

A fresh encrypted actual-live backup at 18:36 UTC contains 25 tables/70 rows. Its authenticated scratch restore succeeds and replays one saved world; the source is preserved. This is local recovery evidence, not remote disaster recovery. Private capabilities, credentials, raw chat and provider IDs are not published. Outgoing replies are paused in the local live environment while genuine ingress and gameplay remain enabled. Startup and the controlled recovery preserved the existing Ark and acceptance baseline.

| Priority | Next acceptance/work | Dependency |
| --- | --- | --- |
| P1 | Genuine scan → saved clue → public overlay; then solve/resource consequence | One valid command during the correct phase; observer ready independently |
| P1 | Native OBS link rotation, deliberate refresh and actual gameplay update | First render and controlled reconnect now proven; no second creator needed |
| P1 | Stable hosted release, remote backup/clean-host restore and deployed ingress/feed tests | Approved hosting account/region/budget; do not purchase or provision speculatively |
| P1 | A07 projection/participant-map cost; A11 ordered snapshots across channel assignments | Independent engineering work; neither is fixed by a bot reply switch |
| P1 | Authentic native raid and receiver continuation with preserved scars/history and revoked former authority | Second consenting live broadcaster later; hriday_29 remains the bot |
| P2 | A09 complete current-version cooperation balance coverage; audience/mobile clarity and remaining operations telemetry/retention | Independent work plus appropriate measured acceptance |
| External | Explain/clear provider-side bot distribution failure if it persists | Twitch/account-owner information unavailable to the present API grants; prepared private evidence supports a focused inquiry |

The controlled raid procedure and signed concurrent/rollback fixtures remain intact. There is no native proof, and no claim of production readiness. Preserve the preview release tag and distinguish source verification from live provider acceptance throughout the November 3 submission preparation.
