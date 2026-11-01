# LIVEWIRE v0

Status: shipped in v0.1.0-preview.2 behind the default-off `LIVEWIRE_ENABLED` flag. Real Twitch mission acceptance remains a release gate. TORCHLINE is still the persistent survival world; LIVEWIRE makes a creator's usual game consequential to that world.

## One complete mission

1. Between Ark chapters, the captain chooses Boss attempt, Match or Personal challenge and enters a short game/attempt label.
2. Opening spends **one supply** and this boundary's only mission allowance. Chat has 45 seconds to choose navigation (`!stake 1` / `!stake nav`), hull (`!stake 2` / `!stake hull`) or life support (`!stake 3` / `!stake oxy`). `!vote 1/2/3` also works here; it retains normal chapter meaning during Ark decisions.
3. Each viewer has one effective ballot. The latest valid provider timestamp wins; equal timestamps use delivery-ID order. Ties between systems use navigation → hull → life support. Unavailable lost/sealed systems cannot receive votes.
4. Before attempting the mission, the captain locks the choice. Exact effects and aggregate ballots are saved. With no votes, the captain must explicitly choose a **solo** system; no crew vote is invented.
5. The captain plays their normal game, then confirms success or failure within two hours. The result is visibly **streamer-attested**. There is no automatic game detection.
6. Success restores up to three points; failure removes up to six, stopping at one. The same Ark resources, physical marks, history and OBS view change after the database commits. The next chapter uses those actual resources.

Missions do not create new supplies, passengers, obligations or chapter content. They cannot revive destroyed or sealed systems. The maximum gross repair across a five-chapter season is 15 points, with up to five supplies spent. Cancellation/expiry spends the allowance without an outcome. Transferring or rehosting never replenishes it. Both an advantageous survival witness and remaining catastrophic endings are tested.

## Interruptions

An open selection pauses on server restart, chat loss, creator disconnect or an applicable offline event. Its remaining time is saved; the captain explicitly resumes after restoring chat. Messages older than the resumed window are rejected. A locked attempt survives restart unchanged and has an absolute two-hour expiry. Neither a timeout nor a disconnect invents a result. Expired/locked windows reject later ballots and attestations.

Resolve or cancel before starting another chapter, parking or preparing a handoff. Genuine native raid evidence and receiving consent are still required for live custody. Bot replies are never required for selection or feedback.

## Requirement assessment

| Requirement | Implementation and evidence boundary |
| --- | --- |
| L01 Current custodian controls missions | Session API, mode/connected/custody/slot rechecks under SQL locks; negative authority tests |
| L02 Real chat can choose a system | Existing exact HMAC/subscription ingress; normalized SQL ballots; signed local fixtures pass, genuine service command pending |
| L03 Pre-attempt immutable commitment | Explicit transactional lock; finite authored options and tally snapshot; solo/tie/race tests |
| L04 One attested consequence | Engine extension and atomic state/event/status/outbox; duplicate/concurrent result and injected-failure tests |
| L05 Finite economy | One allowance per boundary, one supply on open, repair caps, no revival; lifecycle and full-season witnesses |
| L06 Historical replay | Historical reducers unchanged; explicit extension events and mixed replay; backup/restore coverage |
| L07 Recovery and deadlines | Saved pause/remainder, explicit resume, receipt/provider cutoffs, one expiry and no offline reward |
| L08 Core game remains playable | Only between chapters; existing phases retained; regression/browser suite and mission → chapter journey |
| L09 Physical persistence | Canonical system integrity/condition/marks, resource effects, cause-linked ship log; not a separate decorative score |
| L10 Read-only compact OBS | Existing capability/cookie/SSE with compact/auto query layout; browser/native evidence tracked in report |
| L11 Safe release boundary | Default-off flag and additive migrations 009–010; merged into main in preview.2 without enabling it by default |
| L12 Authenticity and scope | Streamer-attested result, signed-versus-simulation input classes; no automatic game detection or simulated native-raid claim |

The preset describes the attempted activity; all three presets intentionally use the same bounded economic policy. It is context, not a claimed game integration or a difficulty-dependent reward.

See [ADR 0031](../decisions/0031-livewire-v0.md) for the C1–C13 review and [operations](../operations/livewire-v0.md) for setup and acceptance. Other proposed expansion arms are not part of v0.
