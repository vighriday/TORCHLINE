# 0029 — Independent replies and bounded database work

Accepted and implemented October 29, 2026. Follow-up to audit A08 and the unresolved native bot-delivery failure. No new service, scope, role or engine rule.

## Decision

`BOT_REPLIES_ENABLED=false` stops enqueueing and sending automatic replies. It preserves the dedicated bot grant, EventSub subscriptions and viewer gameplay. Existing pending replies remain pending; on re-enable, the existing 30-second freshness rule discards stale work rather than replaying a backlog. In-progress network sends cannot be recalled. This is an explicit operator control requiring a normal restart, not a public mutation or an automatic diagnosis of Twitch restrictions. Default is true. Creator diagnostics explain a pause; overlays retain normal game feedback.

Keep the current official Send Chat Message transport. Do not substitute IRC sending, impersonate the broadcaster, create replacement accounts, grant moderator/VIP rights or broaden scopes to evade an unexplained provider/account restriction. Failed or ambiguous replies are not automatically retried. Provider acceptance and viewer visibility remain different acceptance gates.

Use PostgreSQL's server-side statement, lock and idle-in-transaction limits through `pg` startup parameters on every Store pool. Runtime defaults: 10 seconds per statement, 2 seconds waiting for a lock, 15 seconds idle in a transaction; connection acquisition remains 5 seconds and the pool remains ten connections. Environment overrides are bounded. Lock timeout must be shorter than statement timeout. Cancellation rolls back the whole transaction; a broken socket is discarded and rollback errors cannot mask the original application error. Unexpected idle-socket losses log a sanitized code.

Migration statements get a transaction-local 60-second statement / 10-second lock allowance. Operator backup/restore pools use 60-second statement/idle and 10-second lock limits, including scratch database DDL. This preserves maintenance without leaving interactive work unbounded. The initial short-budget restore experiment failed during scratch database cleanup; its bounded maintenance allowance now passes the encrypted restore drill. Native utility total-duration limits and remote large-dataset restore performance remain separate work.

An HTTP timeout alone would not cancel PostgreSQL execution. Client query timeouts alone may abandon work still running on the server. Raising every runtime budget for maintenance would let locked requests consume the pool. Silently dropping all bot grants would break incoming participation. These alternatives are rejected.

## Component stress review

| Component | Decision and limit |
| --- | --- |
| C1 Identity | Existing independent creator/bot grants retained; no authorization bypass |
| C2 Gateway | Signed ingress and official outbound transport unchanged; replies can pause independently |
| C3 Participation | Queries can become silent; valid scan/route/vote/allocation actions continue |
| C4 Engine | No clock/network calls or balance changes in transitions |
| C5 Episodes | Persisted deadlines and interrupted-input recovery retained; SQL cancellation is not an automatic phase advance |
| C6 Custody | Same transactional/native-proof invariants; aborted locks cannot partially transfer a world |
| C7 Storage/work | Server cancellation, full rollback and discarded dead connections; accepted inbox work retains existing retry policy |
| C8 Projection | Existing saved-state feed continues; no reply or SQL success fabricated |
| C9 Dashboard | Private status explicitly separates outbound pause from usable gameplay |
| C10 OBS | Read-only overlay remains independent of bot sends |
| C11 History | No event deletion or automatic repeated commands; history queries share runtime limits |
| C12 Validation | Real PostgreSQL lock/statement/idle termination tests, encrypted restore drill, signed provider-fixture gameplay/overlay denial tests |
| C13 Operations | Bounded configuration, separate maintenance budget and controlled restart; hosting/edge/load gates remain open |

Executed tests establish database/application behavior, not native message visibility or a real raid. See the [deployment configuration](../operations/deployment.md) for the independent operator controls.

Primary reference rechecked October 29: [PostgreSQL 17 client defaults](https://www.postgresql.org/docs/17/runtime-config-client.html). The limits are application guardrails, not measured production capacity or an overall transaction-duration guarantee.
