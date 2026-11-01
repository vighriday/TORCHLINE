# ADR 0001: Separate game, episodes and custody

Status: proposed, 2026-10-26; approved 2026-10-26 (see [index](README.md)). Coverage: D15; PR-02, PR-05, PR-09–12.

## Context and decision

TORCHLINE's persistent game must be compelling on one channel. Raids provide the signature world transfer, while creator schedules and availability remain external. Separate the deterministic world engine, hosted-episode lifecycle and custody policy. Chapters advance through play, consequences through chapter progression, and hosting through an active channel slot. Parking preserves custody; authentic live transfer requires raid proof and recipient consent.

## Alternatives and consequences

A raid-driven chapter loop would tightly connect the spectacle to progression but make ordinary play and asynchronous continuity hostage to creator availability. A generic collaboration platform first would widen scope without proving the game. The chosen boundary supports a complete Ark season now and future cohosts, spectators and additional seasons without weakening native raid authenticity.

## Validation and revisit

Complete a no-raid solo season, park/resume, and a multi-host continuation using the same engine. Enforce engine imports and live/test evidence isolation. A future non-raid custody policy needs a separate explicitly named mode and ADR. See [system design](../architecture/system-design.md).
