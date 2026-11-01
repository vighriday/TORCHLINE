# ADR 0038 — One-step decision alternatives and whole-record replay verification

Date: 2026-11-01. Status: Accepted and implemented 1 November 2026; merged to main through PRs #3–#5.

## Context

Every saved consequence in TORCHLINE comes from a pure, versioned engine applied to an append-only event log. A judge or a viewer could see what happened, but not what the other option would have done. An earlier idea replayed whole alternate futures; it was rejected because later inputs may be illegal on another branch and later communities' choices cannot be guessed. The design review also asked that nothing be labelled verified unless a real recomputation and comparison exists.

## Decision

1. **One step only.** For a captain decision (`commit`) or an attested LIVEWIRE result (`livewire-resolve`), the server rebuilds the world exactly as it was before that event from the event log, under the event's own rules version. It then applies every option of the decision once (or both mission outcomes), with the original actor, command ID and timestamp. Later chapters are never simulated.
2. **A real check, reported, not assumed.** The chosen branch is recomputed the same way and compared with the saved event field by field. The response reports `verified` from that comparison. The interface shows "Recomputed choice matches the saved record" only when it does.
3. **Read only and bounded.** Nothing is written. Results are cached per event, because history is append-only. Each branch reports resources, ending, new debts and destroyed systems; an option that was not legal from the saved state reports the engine's reason.
4. **Same access as the record.** The current custodian reads alternatives with their session (`GET /api/worlds/:id/alternatives?event=`). Anyone holding a public Chronicle link reads them with the link (`POST /api/chronicle/alternatives`), subject to the same mode check.
5. **Presentation.** The Chronicle's event record and the public Chronicle offer "What if they had chosen differently?" on decisions and mission results. The panel is labelled "One-step replay · same rules · later chapters not simulated".
6. **Whole-record verification.** "Verify this record" replays the world's entire saved log from genesis through its pinned rules and compares a SHA-256 digest of the replayed state with one of the saved state (canonical JSON, sorted keys). The result names the event count, rules version and both digests. A refusal by the rules is reported with its reason. The replay is cached per saved version; the saved state is re-hashed on every request, so a changed saved state is caught even at the same version. Same access as the record: `GET /api/worlds/:id/verify` for the custodian, `POST /api/chronicle/verify` with a public link.

## Alternatives considered

- **Full alternate futures.** Rejected: later inputs may be illegal on another branch, and the result would read as fact.
- **Storing alternatives at decision time.** Adds a write path and storage to every commit. Recomputing from the immutable log is exact and cheap.
- **Computing in the browser.** The history API deliberately omits commands and raw actor IDs, so the browser cannot replay without widening what it exposes.

## Consequences

- A viewer can see the road not taken, with numbers, for any decision aboard: for example, sealing the rear habitat would have kept navigation but cost 48 passengers.
- The recomputation is a visible, checkable demonstration that the engine is deterministic. The whole-record check turns "the history reproduces the ship" from a claim into a button anyone with access can press.
- "Verify this record" replays the stored log and compares SHA-256 digests of the replayed and stored state. It is not a signed attestation, would not detect a consistent rewrite of both log and state, and does not prove that inputs were genuine Twitch chat or native raids.
- An uncached request replays the world's log up to the decision. The per-event cache bounds repeated cost.

## Validation

- `tests/alternatives.test.ts`: both options of a chapter-one decision, with the chosen branch equal to the saved resources and `verified`; both outcomes of an attested mission; refusal for non-decisions and unknown events; custodian-only session access and public-link access; reading never writes.
- `tests/chronicle-share.test.ts`: the session and public routes return the same alternatives; the previous custodian is refused; a non-decision returns 409.
- `tests/alternatives.test.ts` (replay verification): a world with a mission and a chapter replays to the saved digest; a saved state altered in the database is reported as differing; a public link verifies; another creator is refused.
- `tests/browser/relay-rehearsal.spec.ts`: the captain and a visitor with no session open the panel and see the verified recomputation and the untaken options, and both verify the whole record.

## Revisit trigger

Revisit if a decision ever depends on input outside its own event log, or if multi-step replay is proposed with a rule for stopping at the first divergence.
