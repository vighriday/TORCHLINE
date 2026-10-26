# Validation workspace

Domain, PostgreSQL, HTTP, Twitch contract and browser tests now exist. Run `pnpm test` and `pnpm test:browser` with a development `DATABASE_URL`; tests use disposable schemas and never truncate existing worlds. Future load/live/OBS verification remains in [the validation plan](../docs/planning/validation.md). See [current evidence](../docs/planning/implementation-status.md).

Sanitize event fixtures; never store access tokens, refresh tokens, session cookies, overlay capabilities or raw chat archives. Label simulator evidence clearly. Native Twitch raid validation remains a distinct live test.
