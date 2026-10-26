# Shared packages

Implemented boundaries are `engine`, `contracts`, `storage` and `twitch`. The engine/content package is deterministic and independent of Twitch, database and browser frameworks. Contracts may be shared with the browser; credentials and server-only adapters must never enter a browser bundle.

These are linked pnpm workspace packages. See [data and contracts](../docs/architecture/data-and-contracts.md) and [current evidence/limits](../docs/planning/implementation-status.md).
