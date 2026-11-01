# ADR 0035 — Relay rehearsal, attributed inheritance and lineage

Date: 2026-11-01. Status: accepted and implemented on the platform-completion branch.

## Context

The defining TORCHLINE moment is one community receiving another community's unfinished Ark and its consequences. Before this change:

- A judge or new creator could only reach that moment by switching practice identities by hand roughly eight times across three screens, inside a three-minute offer window.
- The receiver's arrival briefing said only "Received from X · N passengers". It did not say which decision caused which debt.
- Public summaries embedded the immutable community ID, so a live overlay would read "committed by 123456789".
- The Chronicle listed events and causes as text. It did not show how a consequence crossed from one community to the next.
- A finished voyage kept its channel slot forever, so a captain could never launch a second Ark or accept an incoming one.

## Decision

1. **Guided practice relay.** The Judge Arena runs nine explicit steps. Each step calls the same public endpoints as the dashboard, signed in as the named practice identity: login, create, start, simulated chat, commit, opt-in, prepare, simulated raid proof, accept, start. Only the raid proof is simulated, and the existing server rule still refuses that proof outside simulation mode. Step progress is a per-browser convenience; the saved world remains the record. Autoplay stops before the receiver's first command so a person reads the dossier before the debt applies. Practice relays get a 15-minute offer window; live offers keep the existing window.
2. **Attributed inheritance dossier.** The arrival projection adds every captain commitment (chapter, authored choice, deciding community), each pending obligation linked to the decision that created it, and the number of deciding communities. It still clears on the receiver's first command. The dashboard shows it in the Mission Control rail. The read-only OBS view shows a broadcast-sized version over the ship.
3. **Presentation names, storage keeps IDs.** Saved events keep the community ID that replay depends on. The world projection, history API and `!history` reply substitute the community's current display name.
4. **Lineage and season record.** The Chronicle draws communities as rows, chapters as columns, saved cause links as arrows and custody changes as markers. It reads only the paginated history API, pinned to one sequence. A season record lists each community's commitments and the voyage outcome.
5. **Finished voyages release their channel.** Creating a world, or accepting a handoff, moves an ended world out of the channel slot atomically. The world keeps its exact final state in the library. Preparing a handoff treats a finished receiver as available but never edits that receiver's channel.

## Alternatives considered

- **Server-side rehearsal endpoint.** One call that performs the whole relay would be shorter, but it would bypass the public authority checks it is meant to demonstrate. It would also add a second custody path.
- **Rewriting stored summaries.** Changing engine summaries would break deterministic replay of existing worlds. Substituting names at presentation keeps history immutable.
- **Auto-parking finished worlds at commit time.** This would change custody state inside a gameplay transaction and alter what overlays show immediately after an ending. Releasing on the next create or accept keeps the memorial visible until the captain acts.

## Consequences

- A judge can experience a native-shaped two-community handoff in under two minutes with no Twitch accounts. The labels and the server's mode checks keep it from being mistaken for raid evidence.
- Receivers and their audiences can attribute every inherited debt to the community and decision that caused it.
- The rehearsal parks, never deletes, any practice Ark already occupying a dock it needs.

## Validation

- Storage tests cover finished-voyage release on create and on accept, and that preparation never touches the receiver.
- The custody-arrival server test checks the dossier's decisions, debts, community count and name substitution against the stored IDs.
- A browser journey runs the full rehearsal. It checks the saved custody event, the inherited scars and debt, the debt's application in chapter two, and the lineage and season record.
- Genuine native raids still require separate live acceptance.

## Revisit trigger

Revisit when live custody adds a second evidence type, or when communities can be renamed in ways that would make current-label substitution misleading for old events.
