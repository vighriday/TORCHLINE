# October 29 — recovery fixes and genuine Twitch acceptance

**Stage: playable, locally hardened development preview; live acceptance and production release remain incomplete.** This follows the [critical audit](../reviews/2026-10-29-comprehensive-audit.md), without rewriting its historical findings. Implementation commits: `61ef4e0` (participation/overlay recovery) and `50dc884` (self-revocation/private bot outcomes), on `feat/gameplay-foundation`. The published preview tag stays unchanged.

## Fixed and verified locally

| Audit | Result | Evidence |
| --- | --- | --- |
| A02 · P1 | Freeze known lost-chat episode time/input, drain accepted work, record one durable pause, require repair and deliberate resume | `tests/chat-interruption.test.ts`: signed provider-fixture revocation, grant/subscription loss, pending-work retry, restart, preserved time and replay |
| A03 · P1 | Temporary overlay failures reconnect; actual access denial terminates and clears state | `tests/browser/overlay-recovery.spec.ts`: initial 503s, mid-feed dependency failure, restored current state, unchanged authority and terminal revocation |
| A05 · P2 | Old creator feed cannot replace successful bot conversion with a false creator error | Guard in `apps/web/src/main.tsx`; complete browser runs pass including bot onboarding. Dedicated rendering tests still exercise WebGL |
| A06 · P2 | Valid local session can revoke its own stale provider grant even if provider revocation fails | `tests/session-revocation.test.ts`: fresh grant still required for game access, anonymous/cross-origin denial, unaffected second creator, preserved Ark, revoked old session |
| A12 · P2 | Corrected active owner instructions, old callback and stale no-Ark statements; added account-specific sequence | [Owner walkthrough](../operations/owner-launch-guide.md), [essential checklist](../operations/live-release-checklist.md), [existing-account test](../operations/controlled-account-live-test.md). Wider documentation drift remains subject to the audit |

No gameplay rules, ship art, bot role or raid proof requirement changed. Existing PostgreSQL inbox/outbox provide the interruption; internal work has a different type and never enters native-delivery evidence. A machine-readable pending interruption controls host capabilities. New overlay GET/state and SSE share the same read-only capability checks. ADRs [0027](../decisions/0027-recover-participation-and-overlay.md) and [0028](../decisions/0028-local-revocation-and-bot-diagnostics.md) review all thirteen components and alternatives.

## Executed checks

- Production build/typecheck and **102 tests across 23 files pass**. The final focused bot/self-revocation rerun also passes after extending grouped failure coverage.
- **12/12 complete Chromium journeys pass**, including five-chapter/saved gameplay, cooperation, physical-condition fixtures at both broadcast sizes, mobile, actual WebGL encounters/startup, overlays and bot onboarding. A preceding complete twelve-journey run also passed. This addresses the reproduced race; it is not a promise that all browser flakiness is eliminated.
- Formatting, repository/version checks and generated balance/design/README proof consistency pass. Generated proof is unchanged; that does not resolve A09's limited cooperation balance coverage.
- Encrypted snapshot and isolated restore of the actual local live database pass: **25 tables, 44 rows, one world replayed, authenticated archive**. Source database and keys preserved. This proves local recovery, not offsite backup or a clean-host disaster drill.
- Selected public exposure scan passes: **15 private fingerprints, ten live responses**, Git objects/index, browser output and bounded local artifacts/logs. This is a bounded scan, not a universal security guarantee.

Both implementation commits also pass their exact-source remote workflows: [61ef4e0 / run 40850365998](https://github.com/vighriday/TORCHLINE/actions/runs/40850365998) and [50dc884 / run 40851752591](https://github.com/vighriday/TORCHLINE/actions/runs/40851752591). Those workflows include Linux build/tests, browser journeys, generated-proof drift checks and restricted release-container smoke. The later operations/documentation commit receives its own CI result; no later source inherits a green check automatically.

Full suite logs and token-bearing/raw diagnostics remain under ignored `.local/`; no local environment, grant, capability URL, raw chat, concept input or screenshot is published.

## Genuine provider/public evidence

Fresh provider/public check at **09:41 UTC, October 29**; acceptance counters reread at **09:43 UTC**. The original acceptance baseline from October 28 remains intact.

| Assertion | Actual result |
| --- | --- |
| Current public ingress | Windows OpenSSH serves `https://education-slather-reps.ngrok-free.dev`; HTTPS health and database readiness return 200 |
| Existing OAuth | Normal lifecycle refreshed both saved grants; real creator and bot identity/client/scopes validate. No new consent or bot role change |
| Provider subscriptions | Exact **3/3** required chat/online/offline subscriptions enabled for current callback/conditions. Incoming raid subscription waits for a real receiver's opt-in |
| Actual chat delivery | **2 signed chat deliveries** since the preserved baseline. First query received at 09:21 UTC and durably acknowledged 204 in approximately 130 ms; subsequent ordinary chat also reached ingress |
| Bot result | **1 failed send, `msg_rejected`**. Twitch received the request and explicitly rejected it; owner saw no reply. **0 accepted native replies** |
| Actual gameplay participation | **0 applied chat actions**. Query/ordinary chat does not exercise a puzzle transition. Existing Ark remains chapter 1, awaiting-commit |
| Public overlay | Separate temporary read grant exchanged through actual HTTPS; Chromium receives the live Ark, no creator/operator controls/private diagnostics, anonymous writes denied. Only that temporary grant removed |
| Installed OBS | **Unverified**. Windows automation helper crashed/reset twice before reaching OBS; no native render, recording or broadcast was performed |
| Native raid | **0 signed raids / 0 linked live transfers**. Second consenting broadcaster is still an external dependency |

The owner screenshot showed the manual bot-account check sent as the broadcaster. It therefore does not establish whether the bot can speak manually. Read-only Twitch settings show ordinary emote/follower/subscriber/slow/unique modes off. Those settings do not establish email/phone verification, account status or AutoMod decisions. `msg_rejected` alone cannot identify the cause; no permission escalation, automatic resend or simulated native event was used to conceal it.

## Later live follow-up — 10:01 UTC / 15:31 IST

The owner sent a fresh `!status` as the correct broadcaster. Its signed callback arrived at 09:57:10 UTC, the bot worker began the send at 09:57:11 UTC, and Twitch returned `is_sent=true` with a nonempty message ID. Read-only Twitch Get Users resolves the actual destination ID to **hriday29** and sender ID to **hriday_29**. Fresh counters are **3 signed chats, 1 provider-accepted reply, 0 applied actions, 0 raids and 0 linked live transfers**, alongside the earlier single `msg_rejected` failure. The reply body/message identifier remain private.

The owner still reports no visible automatic reply. Their bot-window screenshot shows manual bot messages locally, which alone does not prove another account receives them. **Provider acceptance is now genuinely verified; visible output remains unresolved.** Browser automation crashed during initialization twice, preventing independent inspection. No repeat message, permission escalation, role change or simulated evidence was sent. The owner inspected [Mod View](https://www.twitch.tv/moderator/hriday29) and reports nothing listed; their screenshot shows an empty AutoMod Queue and no bot removal in Mod Actions. This does not establish an alternative cause. [Twitch's primary guide](https://help.twitch.tv/s/article/mod-view?language=en_US) describes these panels.

At 10:07 UTC an isolated, temporary anonymous read-only TLS chat observer successfully joined the actual channel. It received the owner's fresh `!history` at **10:09:43 UTC**; EventSub queued the reply at 10:09:44 UTC and Twitch again accepted it with a message ID. **No bot reply reached that independent connection during the observation window.** Counters are now **4 signed chats and 2 accepted sends**, with applied gameplay/raid/transfer still zero. This reproduces the delivery gap outside the owner's browser; it does not identify whether an account/channel restriction or provider defect caused it.

The observer sends protocol handshake/keepalive only, stores no chat bodies and is not application ingress or native raid proof. The anonymous mechanism is historical developer-forum guidance, verified here only for joining and receiving the broadcaster's query; it is not a recommended product transport. [Current TLS/IRC reference](https://dev.twitch.tv/docs/chat/irc/) and [historical anonymous-read discussion](https://discuss.dev.twitch.com/t/twitch-tv-web-browser-chat/6186). Twitch's [status page](https://status.twitch.com/) reports Chat operational, which does not rule out this account-specific observation.

**Subsequent manual control:** the owner manually sent a message as **hriday_29** in Twitch, supplied its sender-window screenshot, and explicitly confirmed it is missing from the **hriday29** browser. This reproduces cross-account failure without TORCHLINE sending the message. It does not identify the underlying account/channel/provider cause, and it does not prove the application has no other defects. The temporary observer had ended before the screenshot was checked; no independent observer receipt/nonreceipt is claimed for this manual control. The live database still has four signed chats and two accepted API sends. Fresh 10:29 UTC checks validate public HTTPS/readiness, both grants and exact 3/3 subscriptions.

**Owner checks completed:** bot account identity confirmed, email verified, broadcaster absent from the bot's block list, and bot absent from the broadcaster's block list. No verification request or moderation hold explains the observations so far. The exact account/channel/provider cause remains unproven; do not label it a confirmed suspension or claim that the application has passed visible delivery.

Next: owner submits the private, ignored `.local/twitch-chat-support.md` draft containing provider message IDs/timestamps, with no tokens. No request has been submitted automatically. Preserve accounts/grants, protection and bot role; stop repeated trial messages pending a new diagnostic reason. [Twitch's chat troubleshooting](https://help.twitch.tv/s/article/why-cant-i-chat) describes verification, blocking and possible temporary account limitations and recommends support after the usual checks. [Official contact procedure](https://help.twitch.tv/s/article/how-to-contact-support?language=en_US). This is an external live-delivery gate; it does not replace the remaining gameplay/OBS/raid acceptance work.

The operations source `48dcece` also passes [its exact-source CI](https://github.com/vighriday/TORCHLINE/actions/runs/40852356379).

## Automation and public authority

`pnpm live:up` checks the existing build/live database/migration and brings up missing app/strict-SSH processes; a healthy existing service is reused. It never kills an unknown listener or overwrites credentials/baselines. Started process IDs and append-only logs are local. A controlled restart of the identified live app loaded these fixes and preserved the Ark. The quarantined native ngrok executable remains unused.

`pnpm live:check` combines real provider/public probes with read-only native counters, exposes the current phase and prints the small owner action list. Exit 2 honestly preserves incomplete acceptance. `live:acceptance check` also shows grouped native bot outcomes without message bodies or identifiers. Neither helper sends messages, starts streaming, commits a choice, creates native proof or changes custody. Normal app startup retains its existing grant refresh/reconciliation behavior.

Public changes: one read-only cookie-scoped overlay state endpoint; existing creator-only diagnostics gain outcome metadata; self-disconnect accepts only its valid local session with normal origin/header checks. Engine controls, custody, retry tools and private diagnostics retain their fresh authorization. Operator bot setup is unchanged. Simulator authority remains unavailable in live mode.

## Essential owner actions

1. In a private Twitch window signed in as **hriday_29**, check it can send in hriday29's chat; complete any rules/verification prompt. Then request `!status` as **hriday29** and observe the bot. No new developer app, bot conversion or blanket moderator grant.
2. Choose the existing Ark's chapter 1 consequence, open the next challenge, and send its legal chat input. Observe saved gameplay and counter change; use Manual timing if available to make the test easy to coordinate.
3. Add the private overlay to actual OBS and check update, scene switch, refresh, reconnect and old-link revocation. A local recording is sufficient for OBS acceptance; inspect it on a phone.
4. Later arrange a second consenting broadcaster for the authentic live raid/receiver continuation. The existing bot cannot act as receiver. Phone IRL can establish receiver presence but does not support the native app's browser overlay. No third account is needed for steps 1–3.

Exact beginner instructions, account names and recovery checks: [existing-account live test](../operations/controlled-account-live-test.md).

## Next phase and remaining release gates

Prioritize genuine bot rejection resolution and first applied chat action, then actual OBS. In parallel, prepare approved permanent hosting/secret storage and an offsite backup/clean-host restore drill. Hosting has not been purchased or deployed. Repeat authority, ingress/load and recovery tests on the actual deployment before claiming production readiness.

Keep raid preparation operational and schedule the receiver only when available; do not weaken native proof or postpone single-channel reliability. Then address audit **A07/A08** measured fan-out/participant-map cost, edge limits, retention, database timeouts and actionable telemetry; **A11** stale snapshot/assignment protection; **A09** current cooperation balance coverage; **A10/A13** audience understanding and remaining presentation settings. These are not silently marked complete by the recovery fixes.

Before the November 3 submission, reserve the final validation window for the real chain, reproducible deployment, honest demo/evidence and judge instructions. Do not expand features while native acceptance and operating gaps remain. The hackathon deadline/time-zone discrepancy remains documented in the [hackathon plan](../planning/hackathon.md); verify the organizer's actual submission cutoff rather than encoding a guessed deadline.
