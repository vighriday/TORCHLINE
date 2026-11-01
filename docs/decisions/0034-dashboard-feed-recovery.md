# ADR 0034 — Recover authenticated dashboard feeds

Status: Accepted and implemented 30 October 2026.

## Context

The authenticated dashboard uses a read-only SSE feed. A transient projection or
database failure can terminate that stream even though the creator session and
world remain valid. Requiring a manual reconnect leaves the captain without live
state during an otherwise recoverable outage and can race with a session change.

## Decision

Treat dashboard feed failures as recoverable by default. Close the failed
`EventSource`, refresh the authoritative snapshot, and reopen the feed with
bounded exponential backoff. Preserve terminal behavior for an expired or
revoked session, and reject snapshots belonging to a different creator.

## Consequences

- Temporary feed failures recover without replaying gameplay mutations.
- A session change cannot be overwritten by a stale feed or refresh response.
- Reconnect attempts are bounded and stop when the component unmounts.
- Provider, native OBS, and genuine Twitch acceptance remain separate validation
  gates; this decision only covers the browser read path.

## Validation

TypeScript validation and the focused browser journeys must pass. A future
provider/OBS acceptance run must still verify recovery on the deployed origin.

## Revisit trigger

Revisit if measured reconnect volume, feed limits, or deployed proxy behavior
shows that browser-side backoff is insufficient; move coordination to an
explicit server lease or gateway only with new evidence.
