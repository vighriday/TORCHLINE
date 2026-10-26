# Development guide

Status: the initial workspace, native PostgreSQL helper, build/test commands and reference application are implemented. Follow [the README quick start](../../README.md) for tested commands and [current status](../planning/implementation-status.md) for remaining work. The sequence below records the broader setup target; a container option is not implemented yet.

## Workspace structure to establish

```text
apps/server/             Fastify HTTP routes and application services
apps/web/                React dashboard, OBS overlay, history and simulator UI
packages/engine/         pure rules, puzzle evaluator, content and event fold
packages/contracts/      versioned domain commands and presentation schemas
packages/storage/        pg transactions, SQL migrations, jobs and projections
packages/twitch/         OAuth, Helix, raw webhook and subscription adapter
tests/fixtures/          sanitized signed events, seeded worlds and histories
tests/integration/       real PostgreSQL races and recovery tests
tests/e2e/               browser flows and isolated simulation
```

Do not create a package for every service class. Keep the server's application coordination inside its own module tree; extract shared domain rules and contracts where there is a real dependency boundary. The engine and content must build/test without credentials, database or Twitch network access. Server-only packages must not enter the browser bundle.

## Local setup work, in order

1. Verify a supported Node 24 installation, pin the package manager and compatible dependency versions, and commit the lockfile.
2. Add TypeScript strict settings, build/lint/typecheck scripts, formatting and meaningful checks for the first executable modules.
3. Add a local PostgreSQL 17 option, preferably a documented container definition, plus a native-install alternative for Windows users who cannot run containers.
4. Add ordered migrations and a labeled simulation seed. Seeds must never mutate a live database implicitly.
5. Add `.env.example` with names and placeholders only. Keep actual configuration in ignored local files or server secrets.
6. Add the server/browser development commands and verify them from a clean checkout before documenting them as working.
7. Add Twitch CLI fixture instructions and a public HTTPS tunnel only for live callbacks. Register matching OAuth redirects separately; a tunnel URL change requires callback/subscription reconciliation.
8. Add CI with actual lint/type/build/domain/storage checks. It should use isolated fixtures and temporary DB credentials, never production Twitch tokens.

## Planned configuration contract

| Variable | Purpose | Secret? |
| --- | --- | --- |
| `APP_ENV` | Development/staging/production behavior | No |
| `WORLD_MODE` | Live or simulation; enforced, not a cosmetic label | No |
| `PUBLIC_BASE_URL` | Exact externally reachable origin | No |
| `PORT` | Hosting-provided listener port | No |
| `DATABASE_URL` | PostgreSQL connection | Yes |
| `TWITCH_CLIENT_ID` | Registered application ID | Public identifier |
| `TWITCH_CLIENT_SECRET` | Server OAuth credential | Yes |
| `TWITCH_REDIRECT_URI` | Exact configured callback | No |
| `TWITCH_BOT_USER_ID` | Authorized bot identity | Public identifier |
| `EVENTSUB_SECRET` | Callback signature verification secret | Yes |
| `SESSION_SECRET` | Session signing/authentication key | Yes |
| `TOKEN_ENCRYPTION_KEY` | Encryption key for stored OAuth credentials | Yes |
| `PARTICIPANT_HASH_KEY` | Per-world participant pseudonym derivation | Yes |
| `LOG_LEVEL` | Structured log verbosity | No |

Acquire bot/broadcaster tokens through the protected setup flows and store them encrypted; do not normalize copy/pasting long-lived token values into shell commands or example files. Keys require documented generation/rotation when implemented. Do not put secrets in browser-exposed Vite variables.

## Repository verification

From the repository root, these read-only checks are available now:

```powershell
git status --short --branch
git remote -v
git check-ignore -v docs/internal/IDEA.txt idea.txt IDEA.TXT
git ls-files
git diff --check
```

When this managed Windows environment runs Git under a different account from the directory owner, use `git -c safe.directory=E:/Projects/TORCHLINE ...` for this exact path. Do not change global Git safety settings. This is a local execution-environment workaround, not an application requirement.

Before any commit, inspect explicitly staged files and the staged diff. The original private input and `docs/internal/` must be ignored and absent from the index and history. No force-add. Private source notes are not required for a judge's future clean install.

## Evidence and change management

Keep sanitized fixture payloads and reproducible failure cases in Git; keep raw recordings/exports local unless deliberately prepared for publication. Record actual command results and limits with the corresponding commit. Update the affected requirement, component decision review, ADR and changelog when behavior or architecture changes. Publishing, deployment and GitHub access changes happen as separate authorized actions after concrete artifacts are ready.
