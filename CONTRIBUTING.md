# Contributing

TORCHLINE has an approved architecture and a working functional slice. Begin with the [implementation status](docs/planning/implementation-status.md), [documentation index](docs/README.md) and [backlog](docs/planning/backlog.md).

## Development workflow

1. Agree on the next dependency gate and its acceptance evidence.
2. Use a short-lived branch from `main`, such as `feat/twitch-event-gateway` or `docs/handoff-contract`.
3. Keep changes scoped to a feature or reliability concern. Commit source, relevant documentation, meaningful tests, and a changelog entry together.
4. Record architectural changes in [an ADR](docs/decisions/README.md). Update requirements when behavior changes.
5. Explain the resulting behavior, validation performed, and remaining limitations in the pull request.

Suggested commit prefixes: `docs:`, `feat:`, `fix:`, `test:`, `refactor:`, and `chore:`. Every push, and pull requests from forks, runs `.github/workflows/verify.yml`: format and version checks, build, unit and PostgreSQL tests, browser journeys, fixture drift, repository checks, the container smoke test and the docker compose smoke test. No branch protection is configured.

## Before committing

- Inspect `git diff --cached` and the staged file list.
- Confirm private concept notes and `.env` files are absent. Never use `git add -f` to bypass exclusions.
- Check asset provenance, API permissions, and generated files.
- Run checks appropriate to the change: `pnpm build`, `pnpm test`, affected browser scenarios and `pnpm check:repo`. Use an isolated development database; tests create disposable schemas.
- Do not call a mock delivery a live Twitch test or a target a benchmark.

## Licensing

No license has been chosen; all rights are reserved and the source is shared for evaluation. Do not add third-party code, art, music, fonts, or dependencies without recording their license and intended use. Do not reuse artwork linked in private concept notes without permission. The asset register in [assets/design-provenance.md](assets/design-provenance.md) tracks shipped assets.
