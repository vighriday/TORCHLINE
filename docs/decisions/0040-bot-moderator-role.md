# ADR 0040 — The bot account is a moderator of the owner's channel

Date: 2026-11-02. Status: Accepted and applied 2 November 2026. Amends [ADR 0028](0028-local-revocation-and-bot-diagnostics.md) and [ADR 0029](0029-independent-replies-and-database-budgets.md).

## Context

Twitch accepted the dedicated bot's chat replies but viewers never saw them, so replies were paused ([ADR 0029](0029-independent-replies-and-database-budgets.md)). ADR 0028 ruled out granting moderator rights "to hide an unexplained rejection". On 2 November the symptom was isolated: two test sends through the production path returned `is_sent: true` with no drop reason, and an anonymous read-only viewer connection to the channel never received either one. The October 29 diagnosis had already shown a message typed by hand in the bot's own Twitch window failing the same way. Delivery therefore failed inside Twitch for this new account, before any viewer, independent of TORCHLINE.

## Decision

1. **The owner made `hriday_29` a moderator of the `hriday29` channel** (`/mod hriday_29`). Moderated and verified chat bots are the norm on Twitch, and the role exempts the account from channel-level filtering of new accounts.
2. **No new authority.** TORCHLINE's bot grant keeps exactly `user:read:chat`, `user:write:chat` and `user:bot`. It has no moderation scopes, so the application cannot time out, ban or delete anything, whatever role the account holds in the channel.
3. **Replies re-enabled** in the live configuration (`BOT_REPLIES_ENABLED=true`). The switch, pacing, coalescing and freshness rules from ADR 0029 are unchanged.
4. **Verified, not assumed.** After the change the same anonymous connection received the bot's message with moderator and bot badges. During the 2 November broadcast, `!status` produced exactly one reply, sent and visible in the live chat.

## Alternatives considered

- **Keep replies paused.** Safe, but it left a working feature dark for a reason outside the product.
- **Send replies from the broadcaster account.** Rejected: it breaks the separation between the creator and bot identities that the authorization model relies on.
- **VIP instead of moderator.** Fewer channel powers, but not established as sufficient for the filter; the bot's token cannot use moderator powers anyway.

## Consequences

- Viewers see `!status` and `!history` answers again. Gameplay still never depends on a reply.
- Another channel that runs its own bot account should make that account a moderator, or expect the same filtering on a new account. The owner launch guide says so.
- If Twitch changes its filtering, the switch in ADR 0029 still pauses replies without affecting chat ingestion or gameplay.
