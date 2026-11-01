# ADR 0006: Authored deterministic gameplay with meaningful viewer challenges

Status: proposed, 2026-10-26; approved 2026-10-26 (see [index](README.md)). Coverage: D9, D11, D14; PR-04, PR-09–11.

## Context and decision

Votes and meters alone risk a shallow experience. Build a five-chapter authored branching season with shared clue discovery, constraint-solving repair routes, bounded allocation and creator commitments. Validate versioned commands/content at boundaries. Keep transitions and puzzle evaluation pure, integer-based and replayable; record time/seed/order explicitly. Codex helps develop and validate the system; a runtime model is not a dependency.

## Alternatives and consequences

Model-generated crises or solution judging offer variation but make fairness, solvability, latency and replay harder to establish. Authored content needs balancing and has finite variety; seeded validated configurations can expand it. Browser-only tests miss database races; mocked Twitch events cannot establish genuine raid behavior. Use domain tests, real PostgreSQL, browser automation, CLI fixtures and distinct live evidence.

## Validation and revisit

Enumerate route solutions and choice branches; test solo/zero-participant paths, reward bounds, causes and replay. Playtest whether viewers contribute reasoning beyond voting. Add optional event-grounded narration later only with template fallback and no authority over rules/resources. See [game design](../product/game-design.md) and [validation](../planning/validation.md).
