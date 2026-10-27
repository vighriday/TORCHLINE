# Validation workspace

Domain, PostgreSQL, HTTP, Twitch contract and browser tests now exist. Run `pnpm test` and `pnpm test:browser` with a development `DATABASE_URL`; tests use disposable schemas and never truncate existing worlds. Future load/live/OBS verification remains in [the validation plan](../docs/planning/validation.md). See [current evidence](../docs/planning/implementation-status.md).

Sanitize event fixtures; never store access tokens, refresh tokens, session cookies, overlay capabilities or raw chat archives. Label simulator evidence clearly. Native Twitch raid validation remains a distinct live test.

The live-onboarding browser journey uses a fixture OAuth provider and checks setup-key denial plus recovery from accidental creator registration; it is not real account authorization evidence. Proof fixtures explicitly follow their recorded preparation timestamp instead of assuming PostgreSQL and Node wall clocks are identical. Runtime proof checks remain strict.

`pnpm twitch:verify:live` uses real services and prints sanitized results; `pnpm check:public-secrets` scans committed/staged content and selected public surfaces using private local fingerprints. Neither command manufactures chat, raids or session evidence. See [the setup runbook](../docs/operations/twitch-setup.md) for actual bot, chat, OBS and raid acceptance.

The episode suite covers concurrent deadline closure, manual timing, pause/park/restart remaining time, accepted-input drain, late-input denial and schema/mode-scoped worker ownership. Signed provider fixtures additionally cover investigation/allocation, offline pause, bounded retry/quarantine and recovery authority. The mobile cooperation browser journey uses canonical state and a read-only overlay; it does not exercise native OBS CEF. The legacy v2 balance report remains version-specific; allocation arithmetic and v3 combined consequences have separate tests.
