# Contributing

TORCHLINE is currently in product and architecture review. Begin with the [documentation index](docs/README.md) and [backlog](docs/planning/backlog.md).

## Development workflow

1. Agree on the next dependency gate and its acceptance evidence.
2. Use a short-lived branch from `main`, such as `feat/twitch-event-gateway` or `docs/handoff-contract`.
3. Keep changes scoped to a feature or reliability concern. Commit source, relevant documentation, meaningful tests, and a changelog entry together.
4. Record architectural changes in [an ADR](docs/decisions/README.md). Update requirements when behavior changes.
5. Explain the resulting behavior, validation performed, and remaining limitations in the pull request.

Suggested commit prefixes: `docs:`, `feat:`, `fix:`, `test:`, `refactor:`, and `chore:`. No particular branch protection or GitHub automation is configured yet.

## Before committing

- Inspect `git diff --cached` and the staged file list.
- Confirm private concept notes and `.env` files are absent. Never use `git add -f` to bypass exclusions.
- Check asset provenance, API permissions, and generated files.
- Run checks appropriate to the change. Planned application checks are documented in the validation plan; they do not exist yet.
- Do not call a mock delivery a live Twitch test or a target a benchmark.

## Licensing

No project license has been chosen. Do not add third-party code, art, music, fonts, or dependencies without recording their license and intended use. Do not reuse artwork linked in private concept notes without permission. The [asset register](assets/README.md) will track shipped assets.
