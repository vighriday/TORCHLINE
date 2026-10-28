# 0024 — JSON transport and read-only connection recovery

Accepted/implemented 2026-10-28 after an actual browser screenshot showed raw JSON-parser text. Read-only public probes reproduced the cause: a normal browser user agent received ngrok's HTML warning page for both state and bot-preview API routes; the documented preview header returned JSON instead.

Use the existing request client with JSON Accept, the official warning header only on ngrok-free app/dev hosts, a bounded request timeout and rejected unexpected redirects. Validate content type and parsing before showing data. Unexpected HTML/malformed/scalar responses become a short connection message; never expose upstream HTML/parser text. Preserve genuine JSON authorization/domain errors. Never retry a mutation automatically: it might have committed before the response was lost.

Initial connection has a small branded loading view until both dashboard and required bot-preview reads succeed. It does not show an invented simulation mode, a launch action or a 3D scene that will immediately be replaced by an existing Ark. Separate transport status from action errors so a successful live snapshot cannot erase a rejected action. Retry reloads current state and reopens the authenticated feed; it does not create a world, reauthorize Twitch or replay a command. The passive overlay distinguishes connection establishment from a confirmed empty channel and gains no retry controls.

Alternatives: hide the parser message without fixing the request, force every visitor to change browser settings, or silently retry writes. These would leave the demonstrated transport failure, add owner work or risk repeated actions. This is a development-preview compatibility change; permanent hosting remains the production plan and receives no ngrok-specific header.

| Component | Review |
| --- | --- |
| C1 Identity | Existing session cookies/operator bearer requirements retained; preview header grants no authority |
| C2 Twitch | OAuth/native API/HMAC unchanged; no chat/raid/subscription action from retry |
| C3 Participation | No replayed votes/scans or synthetic viewer identity |
| C4 Engine | Canonical transitions/rules/content unchanged |
| C5 Episodes | Request/UI timeouts do not close/advance/pause phases |
| C6 Custody | No repeated prepare/accept; reconnect reads current custody |
| C7 Database | No schema/write changes; response-loss test verifies one committed version |
| C8 Projection | Fresh snapshot/feed after manual reconnect; transient status separate from action errors; malformed event parsing is contained |
| C9 Dashboard | Honest initial connection, actionable sanitized errors and stable existing-world recovery |
| C10 OBS | Passive waiting state, no buttons or creator capabilities; native CEF remains unverified |
| C11 History | No destructive reset/history rewrite; current state survives uncertain response |
| C12 Validation | Client response/header/authorization fixtures, upstream HTML and committed-response-loss browser tests |
| C13 Operations | Host-scoped documented header, no dependency/service change, live browser-agent probes and secret scans |

Source: [ngrok free-plan interstitial documentation](https://ngrok.com/docs/pricing-limits/free-plan-limits), checked 2026-10-28; E18 in the [source register](../research/sources.md). Full suite, public-preview browser verification and CI evidence are recorded after execution. Synthetic response loss is a fault test, not genuine Twitch participation. Revisit if permanent hosting or a changing proxy contract requires different transport handling.

Executed locally: production build/typecheck, 97 automated tests and 11 browser journeys pass. A fresh anonymous Chromium profile with a normal browser user agent completed the actual ngrok visit screen; the application's own API header produced two JSON200 responses, no page errors/alerts and a ready 3D scene. No Twitch consent or gameplay action was sent. The three-page state/custody journey uses reduced motion after an earlier CI timing failure; dedicated renderer tests still verify real moving frames. Source CI is recorded separately.
