# Source register

Research date: **2026-10-26** (Asia/Calcutta). These are primary sources consulted for the plan. Documentation support is not proof that TORCHLINE has exercised an API. Recheck changing scopes, limits, schedules and hosting behavior during implementation.

## Twitch and OBS

| ID | Source | Supports |
| --- | --- | --- |
| T1 | [Register an application](https://dev.twitch.tv/docs/authentication/register-app/) | Account prerequisites, client credentials and redirects |
| T2 | [OAuth flows](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/) | Server authorization code and client credentials distinction |
| T3 | [Cloud chat authentication](https://dev.twitch.tv/docs/chat/authenticating/) | Bot/broadcaster grants and transport token types |
| T4 | [EventSub subscription types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/) | Raid/chat event versions, conditions, scopes, chat-visible raid limitation |
| T5 | [EventSub reference](https://dev.twitch.tv/docs/eventsub/eventsub-reference/) | Raid and chat payload field boundaries |
| T6 | [Webhook handling](https://dev.twitch.tv/docs/eventsub/handling-webhook-events/) | Public TLS callback, raw-body HMAC and response lifecycle |
| T7 | [EventSub overview](https://dev.twitch.tv/docs/eventsub/) | Duplicate message IDs and replay protection |
| T8 | [Subscription management](https://dev.twitch.tv/docs/eventsub/manage-subscriptions/) | Create/list/delete and transport setup |
| T9 | [Token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/) | Startup and hourly validation requirement |
| T10 | [Refreshing tokens](https://dev.twitch.tv/docs/authentication/refresh-tokens/) | User refresh versus new app tokens, serialized refresh |
| T11 | [Chat send/receive](https://dev.twitch.tv/docs/chat/send-receive-messages/) | Bot delivery results and incoming chat identity |
| T12 | [Chat overview and limits](https://dev.twitch.tv/docs/chat/) | EventSub preference, bot verification status, output/join limits |
| T13 | [Helix API reference](https://dev.twitch.tv/docs/api/reference/) | Users, streams, subscriptions, message sending and source-only output |
| T14 | [API concepts](https://dev.twitch.tv/docs/api/guide/) | Rate limits and compatible additive changes |
| T15 | [EventSub WebSockets](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/) | Reconnect/resubscribe behavior and lost-event limitation |
| T16 | [Twitch raids guide](https://dev.twitch.tv/docs/api/raids/) | Native raid lifecycle and optional API initiation |
| T17 | [Twitch CLI](https://dev.twitch.tv/docs/cli/) | Signed event/mocked API development tools |
| T18 | [OBS browser source](https://obsproject.com/kb/browser-source) | URL overlay, embedded browser, refresh/source lifecycle |
| T19 | [Developer agreement landing page](https://legal.twitch.com/en/legal/developer-agreement/) | Located official terms; body was not retrievable in this research tool. Terms/privacy review remains open before public launch; no compliance determination is claimed. |

## Engineering

| ID | Source | Supports |
| --- | --- | --- |
| E1 | [Node release policy](https://nodejs.org/en/about/previous-releases) | Supported LTS runtime selection |
| E2 | [Fastify](https://fastify.dev/docs/latest/) and [content parser](https://fastify.dev/docs/latest/Reference/ContentTypeParser/) | HTTP module and raw-body parser capabilities |
| E3 | [React versions](https://react.dev/versions) and [Vite guide](https://vite.dev/guide/) | Browser stack and stable-line selection |
| E4 | [PostgreSQL version policy](https://www.postgresql.org/support/versioning/) and [locking](https://www.postgresql.org/docs/17/explicit-locking.html) | Supported database and transactional lock mechanisms |
| E5 | [node-postgres transactions](https://node-postgres.com/features/transactions) | Single-client SQL transaction boundary |
| E6 | [Drizzle transactions](https://orm.drizzle.team/docs/transactions) | Evaluated data-access alternative |
| E7 | [HTML SSE standard](https://html.spec.whatwg.org/multipage/server-sent-events.html) | EventSource, reconnect and event-stream contract |
| E8 | [Zod](https://zod.dev/) | Runtime schema validation and inferred types |
| E9 | [pnpm workspaces](https://pnpm.io/workspaces) | Shared package graph |
| E10 | [Vitest](https://vitest.dev/guide/) and [Playwright](https://playwright.dev/docs/intro) | Engine and browser test capabilities |
| E11 | [Render web services](https://render.com/docs/web-services), [free limitations](https://render.com/docs/free), [WebSocket alternative](https://render.com/docs/websocket) | Hosting shape, sleep risk and fallback transport support. Deployed SSE behavior is still to be tested. |
| E12 | [Twurple](https://twurple.js.org/) | Evaluated Twitch API/auth/EventSub SDK alternative |
| E13 | [ngrok agent configuration](https://ngrok.com/docs/agent/config/) and [TLS](https://ngrok.com/docs/gateway/domains/tls-certificates/) | Development tunnel, disabled request inspector and automatic public TLS; production hosting remains separate |

## Competition and adjacent products

| ID | Source | Supports |
| --- | --- | --- |
| H1 | [Official rules](https://twitchcon-codex.devpost.com/rules) | Entry/build/submission/testing requirements and formal timing |
| H2 | [Organizer resources](https://twitchcon-codex.devpost.com/resources) | FAQ and deadline conversion discrepancy |
| H3 | [Schedule page](https://twitchcon-codex.devpost.com/details/dates) | Different published judging window; PST deadline label |
| H4 | [Hackathon overview](https://twitchcon-codex.devpost.com/) | Required artifacts and Codex build evidence |
| P1 | [Crowd Control features](https://crowdcontrol.live/features) | Audience-triggered game effects as adjacent work |
| P2 | [Ravenfall how to play](https://www.ravenfall.stream/how-to-play) | Persistent chat-driven gameplay as adjacent work |
| P3 | [Twitch developer showcase](https://dev.twitch.tv/showcase/) | Broader interactive-extension examples; not an exhaustive competitor catalog |

## Research limits

During initial research no live calls or event fixtures were exercised. The implementation now has signed-event/provider-contract fixtures, real application/broadcaster authorization checks and a reachable development HTTPS tunnel; see [current evidence](../planning/implementation-status.md). Genuine chat, signed callback delivery, native raid and actual OBS remain distinct gates. No production deployment is claimed. GitHub was empty at setup and is now confirmed private; visibility has not been changed. The Devpost judging dates and FAQ deadline conversion disagree. No exhaustive prior-art search, trademark clearance, legal interpretation, capacity benchmark or cost quote is claimed.

Implementation tooling references: [GitHub checkout](https://github.com/actions/checkout), [Node setup action](https://github.com/actions/setup-node), and [Node TypeScript support](https://nodejs.org/api/typescript.html). The [initial gameplay workflow](https://github.com/vighriday/TORCHLINE/actions/runs/40319660913) passed remotely; it does not cover subsequent changes.
