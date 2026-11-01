# ADR 0038 — One-step decision alternatives

Date: 2026-11-01. Status: accepted and implemented on the platform-completion branch.

## Context

Every saved consequence in TORCHLINE comes from a pure, versioned engine applied to an append-only event log. A judge or a viewer could see what happened, but not what the other option would have done. The private planning notes proposed a "counterfactual time machine" that replays a whole alternate future. The red-team review rejected that form: later saved inputs might be illegal on a different branch, so a full alternate future would be invented, not replayed. It also asked that nothing be labelled verified unless a real recomputation and comparison exists.

## Decision

1. **One step only.** For a captain decision (`commit`) or an attested LIVEWIRE result (`livewire-resolve`), the server rebuilds the world exactly as it was before that event from the event log, under the event's own rules version. It then applies every option of the decision once (or both mission outcomes), with the original actor, command ID and timestamp. Later chapters are never simulated.
2. **A real check, reported, not assumed.** The chosen branch is recomputed the same way and compared with the saved event field by field. The response reports `verified` from that comparison. The interface shows "Recomputed choice matches the saved record" only when it does.
3. **Read only and bounded.** Nothing is written. Results are cached per event, because history is append-only. Each branch reports resources, ending, new debts and destroyed systems; an option that was not legal from the saved state reports the engine's reason.
4. **Same access as the record.** The current custodian reads alternatives with their session (`GET /api/worlds/:id/alternatives?event=`). Anyone holding a public Chronicle link reads them with the link (`POST /api/chronicle/alternatives`), subject to the same mode check.
5. **Presentation.** The Chronicle's event record and the public Chronicle offer "What if they had chosen differently?" on decisions and mission results. The panel is labelled "One-step replay · same rules · later chapters not simulated".

## Alternatives considered

- **Full alternate futures.** Rejected: later inputs may be illegal on another branch, and the result would read as fact.
- **Storing alternatives at decision time.** Adds a write path and storage to every commit. Recomputing from the immutable log is exact and cheap.
- **Computing in the browser.** The history API deliberately omits commands and raw actor IDs, so the browser cannot replay without widening what it exposes.

## Consequences

- A viewer can see the road not taken, with numbers, for any decision aboard: for example, sealing the rear habitat would have kept navigation but cost 48 passengers.
- The recomputation is a visible, checkable demonstration that the engine is deterministic.
- An uncached request replays the world's log up to the decision. The per-event cache bounds repeated cost.

## Validation

- `tests/alternatives.test.ts`: both options of a chapter-one decision, with the chosen branch equal to the saved resources and `verified`; both outcomes of an attested mission; refusal for non-decisions and unknown events; custodian-only session access and public-link access; reading never writes.
- `tests/chronicle-share.test.ts`: the session and public routes return the same alternatives; the previous custodian is refused; a non-decision returns 409.
- `tests/browser/relay-rehearsal.spec.ts`: the captain and a visitor with no session open the panel and see the verified recomputation and the untaken options.

## Revisit trigger

Revisit if a decision ever depends on input outside its own event log, or if multi-step replay is proposed with a rule for stopping at the first divergence.
