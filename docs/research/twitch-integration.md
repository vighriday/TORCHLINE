# Twitch integration research

Checked against official documentation on **2026-10-26**. Documentation feasibility is established; as of that date account authorization, deployed callbacks and real raid delivery had **not** been exercised. Later live evidence (real consent, signed callbacks and genuine viewer chat saved as gameplay; still no native raid or permanent hosting) is in [implementation status](../planning/implementation-status.md). Source links are direct references, with a consolidated [source register](sources.md).

## Recommended integration model

Use a registered confidential server application and a dedicated bot account. Creators connect through server-side authorization code OAuth. The backend receives chat and raid notifications over EventSub HTTPS webhooks, translates them into application commands, and publishes sanitized browser state independently. OBS is a browser source, not a Twitch Extension.

This follows Twitch's hosted/cloud bot model. Webhooks require an app access token to create subscriptions; EventSub WebSocket subscriptions use a user access token. The prior user grants and the token used to create a subscription are different concepts. [Twitch chat authentication](https://dev.twitch.tv/docs/chat/authenticating/)

## Registration, grants and identity

Registration requires a Twitch account with verified email and 2FA, a client ID, redirect URLs, and a safely stored client secret for this server flow. Register exact development and production callbacks; exchange authorization codes on the server, validate one-time state, and verify the resulting token's client ID and user ID before issuing a session. [App registration](https://dev.twitch.tv/docs/authentication/register-app/), [OAuth flows](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/)

| Principal | Required grant | Purpose |
| --- | --- | --- |
| Dedicated bot user | `user:read:chat` | Receive chat as the named bot user |
| Dedicated bot user | `user:bot` | Authorize the cloud application to use this bot identity |
| Dedicated bot user | `user:write:chat` | Send bounded instruction/status/history responses |
| Each participating broadcaster | `channel:bot` | Authorize this client to read/send chat in their channel without requiring moderator status |
| Server application | Client credentials app access token | Create/manage webhook subscriptions and make appropriately authorized Helix calls |

These grants must use the same registered client. Viewers do not OAuth into TORCHLINE to type commands. Do not request email, subscription, Bits, channel-points, general moderation, or raid-management privileges for the current feature set. Receive-world opt-in is an application preference in addition to OAuth consent. The bot can be authorized by its owner through a separate protected setup flow. [Cloud bot scope requirements](https://dev.twitch.tv/docs/chat/authenticating/)

Use `user:write:chat` and `user:bot` from the bot plus `channel:bot` from the broadcaster for app-token message sending. Set `for_source_only: true` to keep bot output in the intended channel during Shared Chat. Inspect `is_sent` and `drop_reason`; an HTTP success alone is not proof a message appeared. [Send Chat Message reference](https://dev.twitch.tv/docs/api/reference/#send-chat-message), [send/receive guide](https://dev.twitch.tv/docs/chat/send-receive-messages/)

## EventSub subscription plan

| Type/version | Condition | Application use |
| --- | --- | --- |
| `channel.chat.message` / `1` | `broadcaster_user_id = host`, `user_id = bot` | Parse bounded commands using `chatter_user_id` and message ID |
| `channel.raid` / `1` | `to_broadcaster_user_id = opted-in destination` | Canonical incoming raid proof; compare event source/destination to prepared intent |
| `stream.online` / `1` | `broadcaster_user_id = creator` | Advisory recipient readiness |
| `stream.offline` / `1` | `broadcaster_user_id = creator` | Pause an active hosted episode and show offline status |

Raid subscriptions need no event-specific user scope. A raid condition specifies **either** source or destination, never both; verify the other identity from the payload. Chat authorization follows the bot grants above. Online/offline events do not grant custody. Subscription type/version and authorization definitions are in [Twitch's subscription catalog](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/).

The raid payload supplies source and destination IDs/names and a viewer count. It does not supply an application handoff nonce, individual raider IDs, or a dedicated occurrence timestamp/raid ID. Therefore we can validate a matching signed notification in a prepared interval, but cannot prove per-viewer origin or an exact application-intent correlation from the payload alone. [EventSub field reference](https://dev.twitch.tv/docs/eventsub/eventsub-reference/#channel-raid-event)

**Important limitation:** Twitch documents raid notifications only for raids that appear in chat. Test the actual broadcaster configuration and small raid behavior; do not assume every attempted raid produces an event. Never transfer on a missing event, a chat string saying a raid occurred, or a simulator notification. [Raid notification semantics](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelraid)

## Webhook verification and delivery contract

The callback must be public HTTPS on port 443. Preserve the raw body and verify HMAC-SHA256 over `message-id + message-timestamp + raw-body`, using the subscription secret and constant-time comparison after checking signature format/length. Authenticated verification challenges return the challenge as plain text; notifications and revocations follow their own handling paths. Keep a random 64-character hex secret in server configuration. [Webhook handler specification](https://dev.twitch.tv/docs/eventsub/handling-webhook-events/)

Twitch delivery is at least once, with retry deliveries retaining their message ID. Use unique ingress records and state/intent idempotency. Twitch recommends rejecting timestamps older than ten minutes to resist replay. Our proposed future-clock allowance is 30 seconds and requires clock monitoring; this is an application policy. [EventSub duplicates and replay guidance](https://dev.twitch.tv/docs/eventsub/)

Authenticate and validate the envelope, persist a minimal normalized inbox item, then acknowledge promptly; internal target is under two seconds. Do not wait for gameplay, Helix calls or animation. Database failure should return a retryable failure, not falsely acknowledge durable acceptance. Reject malformed/forged messages. Durable deduplication markers can return success for previously accepted messages without reapplying them. Unknown additive Twitch fields should be tolerated while required identity and version fields remain validated.

Track desired versus actual subscriptions, enabled/pending/revoked states and callback configuration. Reconcile on startup, authorization changes and periodic health checks. Subscription creation is not complete until callback verification succeeds. Inspect returned cost and quota fields rather than assuming unlimited zero-cost subscriptions. Remove unused subscriptions on disconnect/opt-out. [Subscription management](https://dev.twitch.tv/docs/eventsub/manage-subscriptions/)

## API endpoints needed

| Endpoint | Use and handling |
| --- | --- |
| `GET https://id.twitch.tv/oauth2/authorize` | User consent for broadcaster/bot grants |
| `POST https://id.twitch.tv/oauth2/token` | Code exchange, user refresh, or new client-credentials app token |
| `GET https://id.twitch.tv/oauth2/validate` | Validate identity, scopes and continued authorization |
| `GET https://api.twitch.tv/helix/users` | Resolve and refresh public channel identity |
| `GET https://api.twitch.tv/helix/streams` | Advisory live-status check when preparing/accepting a handoff |
| `POST/GET/DELETE https://api.twitch.tv/helix/eventsub/subscriptions` | Subscribe, reconcile and remove subscriptions |
| `POST https://api.twitch.tv/helix/chat/messages` | Coalesced bot output; read actual send result |

Use `Client-Id` and the appropriate bearer token for Helix. Batch/cache identity and live-status lookups. Respect rate-limit headers and `429` reset timing; retry with bounded backoff/jitter. Do not call Helix per vote. Endpoint-specific authorization is in the [Helix reference](https://dev.twitch.tv/docs/api/reference/); rate behavior is described in [API concepts](https://dev.twitch.tv/docs/api/guide/).

## Token lifecycle and disconnection

Validate OAuth tokens at startup and at least hourly. A revoked/invalid authorization must end the associated sessions and stop its interactions; handle missing scopes explicitly. [Required token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/)

User tokens acquired through authorization code flow can be refreshed. Persist the returned token pair atomically and serialize refresh for each grant. App access tokens cannot be refreshed: obtain a new one with client credentials. An unsuccessful user refresh requires renewed consent, not an infinite retry loop. [Token refresh rules](https://dev.twitch.tv/docs/authentication/refresh-tokens/)

## Chat scale, fairness and Shared Chat

Twitch distinguishes Helix, chat sending, join and concurrent-channel limits. A regular bot's documented sending limits include 20 messages per 30 seconds and one per second per channel in the ordinary case; verification reviews are currently paused. Do not depend on bot verification. Use a conservative shared bot output queue, no per-vote replies, channel cooldowns and response coalescing. These figures are externally changeable limits, not our capacity target. [Chat rate limits](https://dev.twitch.tv/docs/chat/#rate-limits)

Input is separate: one account has one active contribution per decision. Do not infer human identity, membership in a raid, private cohort privileges, or actual watching from a chat ID. Shared Chat can mirror messages from another source channel: accept only commands originating in the active host's own channel, using source fields when present and message IDs for deduplication. This policy deliberately prevents a remote shared-chat channel from controlling a world unexpectedly. [Chat event fields](https://dev.twitch.tv/docs/eventsub/eventsub-reference/#channel-chat-message-event)

## Alternatives and integration boundaries

EventSub WebSocket remains useful for a local proof where public ingress is unavailable. Twitch documents no replay for events lost during a disconnection; reconnects and resubscription need explicit handling. It is not a way to recover missing raid proof after the fact. [WebSocket behavior](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/)

Twitch recommends EventSub and Helix for chat rather than starting a new implementation around IRC. Avoid supporting two production ingress transports during the first build. [Chat overview](https://dev.twitch.tv/docs/chat/)

An OBS browser source can load the overlay URL; no video embed or Extension is required. Check the actual OBS embedded browser, reconnect, background transparency, source shutdown/refresh options and reduced motion. [OBS browser source](https://obsproject.com/kb/browser-source)

The bounded API adapter can use native server fetch/crypto; [Twurple](https://twurple.js.org/) is an evaluated alternative for API/auth/EventSub handling. Whichever implementation is selected, persisted refresh locking, minimal durable ingress, live/test separation and custody proof remain TORCHLINE responsibilities. Avoid simultaneous independent subscription managers.

The raid-start API exists, but TORCHLINE will let creators execute the native raid themselves. A successful raid-start request would not itself be transfer evidence. [Twitch raids API guide](https://dev.twitch.tv/docs/api/raids/)

## First live feasibility gate

Before claiming live transfer support, register the app, authorize the bot and two creators, verify a public callback, receive genuine chat in each channel, arm a world intent, perform a native raid, capture its authentic notification and accept the world once. Record actual scope responses, subscription conditions, timing, IDs, target settings and state continuity without recording credentials. Test cancellation and an absent notification too.

Until two broadcasters are available, use in-repo HMAC-signed EventSub fixtures ([tests/twitch-provider.ts](../../tests/twitch-provider.ts)) and the isolated domain simulator to test parsing, proof policy, races and state transfer. Neither substitutes for the live gate.
