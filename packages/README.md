# Shared packages

Planned boundaries are `engine`, `contracts`, `storage` and `twitch`. The engine/content package must be deterministic and independent of Twitch, database and browser frameworks. Contracts may be shared with the browser; credentials and server-only adapters must never enter a browser bundle.

These are architectural boundaries to create during implementation, not installed packages. See [data and contracts](../docs/architecture/data-and-contracts.md).
