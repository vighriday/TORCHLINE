# ADR 0036 — Public, revocable Chronicle links

Date: 2026-11-01. Status: Accepted and implemented 1 November 2026; merged to main through PRs #3–#5.

## Context

A world's history was readable only by its current custodian. After a relay, the community that handed the Ark on lost every view of what became of its decisions. Viewers never had a view at all, apart from an optional two-decision `!history` bot reply. That reply is currently paused because of an unresolved bot-reply visibility issue. The product promise is that decisions outlive the stream and that returning viewers can trace them. That promise needs a record people can open.

## Decision

- The current custodian can publish a read-only public link, `/chronicle/#<token>`, for a world they command. Each creator holds at most one link per world. Rotating replaces only that creator's link, so the receiving captain cannot break the link the sending community shared.
- Only a SHA-256 hash of the 32-byte token is stored (`world_shares`, migration 014). The token travels in the URL fragment and a POST body (`POST /api/chronicle`), never in a path or query string. It therefore never appears in request logs or Referer headers.
- The public view is the season record, the lineage graph, the latest record and the custody chain. It has no session and no controls. Its projection is the same read-only presentation the OBS overlay receives, and every capability is false.
- Unknown, rotated or withdrawn links return 404. Disconnecting a creator withdraws their links. A link never crosses simulation and live modes.

## Alternatives considered

- **Reuse the OBS overlay capability.** That link is a private broadcast source tied to a channel's current world, and sharing it would expose the stream's source. A world-scoped capability keeps following the Ark after custody changes.
- **Public history for every world.** This is simpler, but it would publish every practice and live world without the creator choosing to. An explicit, revocable link keeps the decision with the creator.
- **Token in the path.** Shorter URLs, but the server's request log records paths.

## Consequences

- Communities can follow an Ark across channels, and judges or viewers can inspect a real world's lineage without an account on any reachable deployment (none is permanently hosted as of 1 November 2026).
- A published link lets any holder, including a former custodian, read the world's later activity until it is withdrawn.
- The public record shows community display names and event summaries. Pseudonymous participant identities and individual ballots stay private.

## Validation

`tests/chronicle-share.test.ts` covers custodian-only publishing, hash-only storage, anonymous reads, rotation, unknown and malformed tokens, and withdrawal on disconnect. The relay browser journey opens a published link in a separate browser context with no session.

## Revisit trigger

Revisit if communities need per-link expiry or audience-specific redaction, or if a creator's display-name change should be frozen into historical public records.
