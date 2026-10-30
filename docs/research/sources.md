# Source register

October 30 LIVEWIRE review: rechecked Twitch's [chat-message subscription contract](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage) and [webhook handling](https://dev.twitch.tv/docs/eventsub/handling-webhook-events/). Existing signed ingress/scopes are reused; retries remain at least once. Full provider timestamp precision is retained for mission ballot ordering rather than relying on JavaScript/pg millisecond `Date` decoding. Documentation review, local signed fixtures and actual provider acceptance are separate evidence classes.

October 29 follow-up: rechecked [PostgreSQL 17 client execution defaults](https://www.postgresql.org/docs/17/runtime-config-client.html), [OBS portable mode](https://obsproject.com/kb/portable-mode), [official browser-source diagnostics](https://github.com/obsproject/obs-studio/wiki/Browser-source-development-and-debugging), [authenticated obs-websocket protocol](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md), and [ngrok's documented developer-client identification](https://ngrok.com/docs/pricing-limits/free-plan-limits#removing-the-interstitial-page). Actual installed OBS 32.2.2/CEF127 rendering is separate from Playwright evidence. [Current diagnosis](../reports/2026-10-29-integration-diagnosis.md) separates authorization, channel/account restrictions, accepted sends and observed delivery; no global Twitch restriction is claimed.

## October 29 audit recheck

[The critical audit](../reviews/2026-10-29-comprehensive-audit.md) separates primary-document support from executed provider and isolated-test evidence. Rechecked Twitch [cloud chat authentication](https://dev.twitch.tv/docs/chat/authenticating/), [raw webhook delivery/revocation](https://dev.twitch.tv/docs/eventsub/handling-webhook-events/), [token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/), [raid subscription semantics](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelraid) and [OBS Browser Source](https://obsproject.com/kb/browser-source). These still support the selected integration, not a claim of native acceptance. Devpost [rules](https://twitchcon-codex.devpost.com/rules) and [schedule](https://twitchcon-codex.devpost.com/details/dates) still publish November 2 at 14:00 PST and disagree on judging dates. Resources returned 403, so its earlier FAQ conversion was not freshly confirmed. Retain the conservative internal cutoff in the submission plan. Current real-provider/HTTPS results are dated in the audit; historical “reachable/current grant” paragraphs below do not override them.

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
| E14 | [Three.js cleanup](https://threejs.org/manual/pages/cleanup.html), [resource disposal](https://threejs.org/manual/pages/how-to-dispose-of-objects.html), [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer) | Checked 2026-10-27: explicit geometry/material cleanup, renderer lifecycle and bounded optional cinematic view; not an OBS benchmark |
| E15 | [OBS Browser Source](https://obsproject.com/kb/browser-source) | Checked 2026-10-27: viewport dimensions, custom FPS, scene visibility/refresh properties and CEF basis; actual installation still needs testing |
| E16 | [Render Node version](https://render.com/docs/node-version), [deployment controls](https://render.com/docs/deploys), [health checks](https://render.com/docs/health-checks) | Checked 2026-10-27 for the proposed owner hosting procedure; no deployment executed |
| E17 | [Google Fonts repository](https://github.com/google/fonts), [ngrok Windows installation](https://ngrok.com/download/windows) | Checked 2026-10-27: local OFL font provenance and official signed development tunnel download; credential remains an owner dependency |
| E18 | [ngrok free-plan interstitial](https://ngrok.com/docs/pricing-limits/free-plan-limits) | Checked 2026-10-28: browser warning cookie and documented client request header; real browser-agent API probes reproduced HTML without the header and JSON with it. No pricing/production availability claim |
| E19 | [GitHub non-code viewers](https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files), [pictures](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/quickstart-for-writing-on-github), [collapsed sections](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections), [diagrams](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams), [Markdown API](https://docs.github.com/en/rest/markdown/markdown) | Checked for the October 29 README: SVG animation unsupported, native STL limit 10 MB, searchable CSV and sanitized progressive disclosure. Executed markup/render checks are separate from documented native-viewer support; see the [presentation review](../design/readme-story.md). |

## Competition and adjacent products

Release metadata sources rechecked October 29, 2026: [Semantic Versioning](https://semver.org/), [GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) and [repository topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics). Initial-development/prerelease meaning, tag-based source archives, immutable published versions and topic limits inform [ADR 0026](../decisions/0026-versioned-preview-releases.md). Installed `gh repo edit`/`gh release create` help verifies the exact used flags; source publication is separate from deployment and native Twitch acceptance.

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

October 29 native-delivery troubleshooting: [Why Can't I Chat?](https://help.twitch.tv/s/article/why-cant-i-chat), [email verification location](https://help.twitch.tv/s/article/where-are-my-notifications?language=en_US) and [official support procedure](https://help.twitch.tv/s/article/how-to-contact-support?language=en_US). Twitch lists verification, blocking and possible temporary new-account/automated restrictions; none is established as TORCHLINE's bot-account cause. The owner reports a manually sent Twitch message also missing from the broadcaster's view. Verification prompts/block lists are owner-operated checks; no new scope, role escalation or automatic support contact is authorized by these documents. Exact provider IDs remain in a private unsent diagnostic draft.

October 29 live-test preparation rechecked [Twitch send/receive](https://dev.twitch.tv/docs/chat/send-receive-messages), [Get Chat Settings / Send Chat Message](https://dev.twitch.tv/docs/api/reference/#get-chat-settings), [native raid controls](https://help.twitch.tv/s/article/how-to-use-raids?language=en_US&langue=en_US), [mobile broadcasting](https://help.twitch.tv/s/article/mobile-game-broadcasting) and [OBS launch parameters](https://obsproject.com/kb/launch-parameters). Provider send acceptance and visible output are separate; ordinary chat settings do not expose all account restrictions. Native Twitch mobile broadcasting lacks browser overlays. OBS documents multiple instances and named profiles/collections; that two-instance setup has not been executed here. The [current report](../reports/2026-10-29-recovery-and-live-acceptance.md) records genuine inbound chat and the rejected reply separately from fixtures and planned raid acceptance.

Current October 28 SSH/public HTTPS/Chromium evidence supersedes earlier offline observations: see [release report](../reports/2026-10-28-release-readiness.md). The native agent remains quarantined; no protection bypass or false-positive conclusion is inferred.

During initial research no live calls or event fixtures were exercised. The implementation now has signed-event/provider-contract fixtures, real application/broadcaster/bot authorization checks, three genuine signed callback challenges, enabled current subscriptions and a reachable development HTTPS tunnel; see [current evidence](../planning/implementation-status.md). Genuine chat effects, visible bot output, native raid and actual OBS remain distinct gates. No production deployment is claimed. GitHub was empty at setup and is now confirmed private; visibility has not been changed. The Devpost judging dates and FAQ deadline conversion disagree. No exhaustive prior-art search, trademark clearance, legal interpretation, capacity benchmark or cost quote is claimed.

Implementation tooling references: [GitHub checkout](https://github.com/actions/checkout), [Node setup action](https://github.com/actions/setup-node), and [Node TypeScript support](https://nodejs.org/api/typescript.html). The [initial gameplay workflow](https://github.com/vighriday/TORCHLINE/actions/runs/40319660913) passed remotely; it does not cover subsequent changes.

## 2026-10-27 episode integration recheck

Release verification rechecked [Twitch cloud chatbot authentication](https://dev.twitch.tv/docs/chat/authenticating/), [message send/receive](https://dev.twitch.tv/docs/chat/send-receive-messages/), and webhook handling. At-least-once delivery, raw HMAC and prompt durable acknowledgement remain the contract; an accepted native send is not proof of visible chat or OBS. The [official ngrok agent container](https://github.com/ngrok/docker-ngrok) documents `NGROK_AUTHTOKEN`; installed 3.39.13 CLI help confirms `--url`, `--inspect=false` and local configuration. New real public/provider evidence is recorded in ADR 0016 rather than inferred from fixtures.

T4 stream.offline version 1 and T6 webhook handling were rechecked against their current primary pages. A verified current offline subscription can advise a local pause; it is not native raid proof. HTTPS port 443, raw-body HMAC, durable acknowledgement and duplicate-message handling remain required. TORCHLINE now queues offline handling and retries normalized work independently of webhook acknowledgement. This is a documentation check plus local signed-fixture evidence; no genuine offline callback or new live chat was observed in this step.

## 2026-10-28 operations recheck

- [Official ngrok SSH reverse tunnel](https://ngrok.com/docs/gateway/agent/ssh-reverse-tunnel-agent): public-key dashboard registration, hostname forwarding, published India RSA fingerprint and inspection/reconnect limitations. The helper supplies reconnect; after owner key registration, actual pinned SSH/HTTPS and public Chromium overlay verification pass.
- [Twitch app registration](https://dev.twitch.tv/docs/authentication/register-app/) and [OAuth tokens](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/) rechecked for the observed `redirect_mismatch`. The registered OAuth URL must match the requested callback. Live server's redirect uses the new exact URI; the existing app's console allowlist still needs updating. No state/query/token is reproduced in documentation.
- [PostgreSQL17 pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) and [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html): consistent exported snapshots, custom archives and transactional restoration. Native PG17 fixture plus actual local live scratch restore execute the chosen path.
- [Ubuntu24 runner inventory](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md): runner-native PostgreSQL version must not be assumed to match the service; CI explicitly uses official PG17 container tools for backup tests.
- [Node Docker images](https://github.com/nodejs/docker-node): explicit version/Debian slim runtime, non-root user and multi-stage packaging. Actual Linux CI builds and restricts the application container; provider availability/streaming is still a separate acceptance gate.

## 2026-10-29 recovery and native OBS recheck (UTC)

- [PostgreSQL 17 client defaults](https://www.postgresql.org/docs/17/runtime-config-client.html): statement, lock and idle-transaction timeouts are server-side controls. They do not impose a total multi-statement transaction deadline. Real contention/cancellation/terminated-session and encrypted restore tests execute the chosen settings.
- [OBS portable mode](https://obsproject.com/kb/portable-mode), [launch parameters](https://obsproject.com/kb/launch-parameters), [browser debugging](https://github.com/obsproject/obs-studio/wiki/Browser-source-development-and-debugging) and [obs-websocket protocol](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md): isolated native instance, authenticated inspection, source screenshot and loopback CEF inspection. Current native 3D rendering and controlled app-outage recovery are executed; broadcast, native gameplay updates and native raid are separate gates.
- [ngrok free-plan interstitial](https://ngrok.com/docs/pricing-limits/free-plan-limits#removing-the-interstitial-page): the documented custom client user agent removes the development HTML warning in the isolated OBS instance. This does not alter application authorization or replace permanent production HTTPS.
- [Twitch chat verification settings](https://help.twitch.tv/s/article/chat-verification-settings?language=en_US): current navigation is Creator Dashboard → Moderation → Settings (Moderation). Email/phone requirements are distinct from ordinary chat modes. This owner-only inspection remains unperformed and is not a diagnosed cause of missing bot distribution. Do not disable protections or grant exemptions to test around them.

The [current evidence](../reports/2026-10-29-integration-diagnosis.md) supersedes earlier present-tense OBS/offline/bot-next-action statements above. Native gameplay effects, bot visibility, two-broadcaster raid, remote recovery and production deployment remain unverified.
