# 0012 — Complete world records and consent-scoped inheritance previews

Accepted 2026-10-27. Extends the existing Fastify/PostgreSQL read model without changing gameplay, custody transitions or the presentation version.

The complete Archive uses bounded cursor pages of immutable gameplay events and custody records. Individual ballots, participant IDs, raw chat, commands, tokens and proof payloads are excluded. Current connected custodians can inspect active, parked and terminal worlds. Previous custodians do not acquire permanent access to future activity. Pagination pins the gameplay sequence and uses the custody record ID to compare the original PostgreSQL timestamp, avoiding millisecond cursor truncation.

A prepared offer explicitly grants its two connected parties a read-only projection of that frozen world. Preview requires current mode, unexpired prepared/verified intent, exact frozen revision, source custody/hosting and receiver opt-in. Cancellation, expiry, disconnect, opt-out and acceptance end preview access. Reading a preview cannot verify a raid or accept custody. All mutation capability flags are false.

Channel locks precede world and intent locks, following the existing custody lock order. Short read transactions protect against permission/custody races. SSE snapshots query only the recent public event tail, keeping full history out of the polling path. History pages are limited to 100 records per list; all records remain reachable by cursor. No new service, browser state store or network dependency is introduced.

The strongest alternative is a public permanent world URL. It would simplify sharing but widen creator-data exposure and require a separate consent policy. The current creator-only Archive and temporary offer preview meet concrete gameplay needs while retaining the existing authority model.

Component review: C1 checks session/current consent under locks; C2 leaves webhook proof unchanged; C3 excludes individual votes/actors; C4 leaves deterministic transitions/replay untouched; C5 permits parked history without starting an episode; C6 revokes previews as intent/custody changes; C7 uses indexed bounded SQL and original timestamp comparisons; C8 keeps projection tails bounded; C9 adds Hangar inspection and pre-accept preview; C10 overlays receive no history grant or creator controls; C11 exposes actual full records/provenance; C12 requires paging/race/revocation/mode tests; C13 keeps one service/database and no secret-bearing cursor. This is design review, not executed acceptance evidence.

Revisit public sharing only with explicit owner consent and scoped public projections. Historical visual snapshots and cryptographic replay attestations remain separate features; this API does not fabricate either.
