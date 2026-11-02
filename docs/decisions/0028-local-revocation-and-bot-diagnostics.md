# 0028 — Local self-revocation and honest bot diagnostics

Amended 2026-11-02 by [ADR 0040](0040-bot-moderator-role.md): after the failure was isolated to Twitch filtering the new bot account, the owner made it a channel moderator. TORCHLINE's bot scopes are unchanged.

Accepted/implemented 2026-10-29 after audit A06 and the owner's first genuine chat attempt. That signed command arrived; Twitch rejected its reply with `msg_rejected`. A healthy subscription is not proof of a delivered reply.

## Decision and alternatives

Split valid local creator-session resolution from fresh Twitch-grant validation. Only the self-disconnect route uses the local session alone. It still requires the unexpired hashed session, matching mode, connected creator and normal same-origin mutation checks. Every gameplay/custody/diagnostics route retains fresh validation. Local revocation deletes access before attempting provider revocation, which can fail without preventing local cleanup. Requiring fresh provider validation for revocation traps users during provider trouble; bypassing session validation would let strangers disconnect creators. Neither is acceptable.

Expose the latest bot reply's status, bounded provider outcome code and creation time only in that creator's existing private integration diagnostics. Group outcomes while summing all statuses correctly. Never export reply bodies, provider message IDs, raw chat or grants. Display `msg_rejected` as a provider rejection requiring account/channel inspection, not a diagnosed cause or a success. Failed/uncertain replies are never automatically resent. Do not grant moderator rights, change the bot's role or request wider scopes to hide an unexplained rejection.

No new service, migration or runtime dependency. This improves recovery/observability; it does not resolve Twitch account restrictions or prove visible bot output. The original rejection was recorded without Twitch's human-readable drop message, so its precise cause cannot be reconstructed from that code.

## C1–C13 stress review

| Component | Boundary |
| --- | --- |
| C1 Identity | Session can remove only its own consent; fresh grant remains required for other authority |
| C2 Gateway | Existing scopes, signatures and provider-result parsing; no fabricated reply acceptance |
| C3 Participation | No changes to eligibility, input weight or bot self-message exclusion |
| C4 Engine | No changes to rules or consequences |
| C5 Episodes | Existing disconnect behavior and recovery supervision retained |
| C6 Custody | Disconnect cancels pending offers; custody/history cannot be reassigned by the diagnostics |
| C7 Database | Existing atomic local revocation; grouped reply counts include different failure codes |
| C8 Projection | Outcome metadata appears only in authenticated creator diagnostics, absent from overlays |
| C9 Dashboard | Explains observed failure without claiming an account restriction was identified |
| C10 OBS | No change to read-only authority or visual state |
| C11 History | Self-revocation preserves the Ark and its canonical history |
| C12 Validation | Real PostgreSQL/session tests with a failing provider fixture; real rejection recorded separately |
| C13 Operations | Provider outage cannot block local removal; no automatic resend of stale/uncertain sends |

Executed: `tests/session-revocation.test.ts` proves stale grants deny game access but permit self-removal even with provider 503; anonymous/cross-origin requests fail, another creator remains connected, the Ark survives and the old session is revoked. Existing bot tests additionally verify private failure metadata and aggregated counts. Genuine visible bot output remains pending. Revisit with measured retention/query cost or a richer, safely bounded provider diagnostic contract.
