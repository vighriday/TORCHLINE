# Working in TORCHLINE

## Current stage

Implementation authorized on 2026-10-26 after architecture review. Retain the approved stack and separation of game, hosted episodes and custody. Prioritize the working gameplay slice and early Twitch verification; preserve genuine raid handoff as a separate live acceptance milestone. Mark implemented versus simulated versus unverified behavior explicitly.

## Source of truth

- Start with `README.md` and `docs/README.md`.
- Requirements: `docs/product/requirements.md`.
- Rules and balance: `docs/product/game-design.md`.
- Runtime and invariants: `docs/architecture/`.
- Sequencing and acceptance: `docs/planning/`.
- Record material changes in an ADR and `CHANGELOG.md`.
- The user requested an ambitious full-product plan with progressive delivery. Do not impose a team size, hourly budget, or proof-of-concept-only ceiling.
- Check each architectural decision against every component in `docs/architecture/decision-stress-review.md`; distinguish design review from executed tests.
- The persistent game must remain engaging on one channel. Raids authorize signature custody transfers; they do not gate chapters or consequences. Viewer gameplay must include cooperative problem solving beyond aggregate votes and resource changes.
- Claude Design owns the final UI/UX, art direction and animations. Build a functional reference frontend with versioned presentation contracts, persistent system condition and semantic visual events; keep final visual treatment replaceable.
- Exhaustively audit authored decisions and challenge outcomes when balancing content. Viewer challenge success must alter canonical state, future choices and persistent ship condition, not just presentation.

## Privacy

The original idea file, regardless of filename case, and everything in `docs/internal/` are private local inputs. Never stage them, force-add them, duplicate them into tracked files, or publish raw excerpts. Do not commit secrets, tokens, local `.env` files, personal session exports, or overlay access URLs. Public specifications may summarize the intended product without reproducing the private source document.

Before each commit, inspect the staged file list and confirm the private inputs are ignored and absent from the index. Never alter Git's global configuration to work around this environment; a command-scoped `safe.directory` for this exact workspace is sufficient when necessary.

## Implementation principles for the next stage

- Pure deterministic engine; explicit versioned content and events; no network, clock, or random calls inside transitions.
- PostgreSQL is authoritative. Custody, state, domain events, and publish intents commit atomically.
- Twitch delivery is at least once; use idempotency and transactions, not claims of exactly-once delivery.
- Never treat a chat message, browser notification, simulator event, or screenshot as verified native raid proof.
- Authorize each mutation using the server session and current custody. Overlays are read only.
- Keep simulation and live Twitch worlds visibly and technically separated.
- No fixed deadlines or capacity guesses in code; use persisted timestamps and explicit product rules.
- Test invariants, replay, failures, and the live handoff. Label targets and planned tests honestly.
- Verify changing API behavior against current primary documentation and update the source register.

## Repository discipline

Use small, reviewable commits and explicit file staging. Keep engine, Twitch adapter, storage, and browser dependencies separated. Do not add placeholder CI badges, fake tests, unverified run commands, or speculative dependencies. Do not change remote visibility, push, deploy, purchase services, or contact other people as part of planning.
