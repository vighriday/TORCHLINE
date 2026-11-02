# Development guide

Everything below runs locally in **saved simulation**: real engine, real PostgreSQL, real authority and custody rules, practice identities, and no Twitch traffic. Live Twitch setup is separate: follow the [owner launch guide](owner-launch-guide.md) and [Twitch setup](twitch-setup.md).

## Requirements

- Node.js 24 (see `.node-version`) and pnpm 12.4.2 (pinned in `package.json`).
- PostgreSQL 17. `pnpm db:up` creates a private cluster under `.local/` on `127.0.0.1:54329`. It expects the PostgreSQL binaries at `C:/Program Files/PostgreSQL/17/bin` on Windows or on `PATH` elsewhere; set `PG_BIN` to point somewhere else. Any isolated PostgreSQL database works if you set `DATABASE_URL` yourself.

## One command with Docker

```powershell
docker compose up --build    # http://localhost:3000
```

[`compose.yaml`](../../compose.yaml) builds the release image and starts it beside PostgreSQL 17. You get saved practice with LIVEWIRE on.

- **Fresh on every start.** The database lives in memory and is gone when the stack stops. The app generates new random secrets each time it starts.
- **Local only.** The port is bound to `127.0.0.1` and the app uses loopback HTTP, so this is not a hosted or live configuration.
- **Stop it** with `docker compose down`.
- **Checked in CI** on every push by `scripts/smoke-compose.mjs`: readiness, web bundle, practice sign-in, a new Ark and LIVEWIRE-enabled dashboard state.

## Run saved practice

```powershell
pnpm install --frozen-lockfile
pnpm db:up        # private cluster + ignored .env with generated secrets
pnpm db:migrate
pnpm build
pnpm start        # http://localhost:3000
```

`pnpm db:up` writes only missing keys to the ignored `.env`: a simulation `WORLD_MODE`, `DATABASE_URL`, three independent 64-hex secrets and `LIVEWIRE_ENABLED=true`. It never prints credentials.

Open the app and choose **Command OS → Judge Arena**. The **Relay Rehearsal** walks two practice communities, each streaming a different game, through one Ark in eleven steps: (1) alpha takes command of a fresh Ark; (2) alpha streams a voxel game and a LIVEWIRE stake on the hull fails; (3) alpha's crew solves the shield relay; (4) the captain sacrifices navigation; (5) a receiving captain opts in; (6) alpha prepares the relay; (7) a labeled practice raid proof arrives; (8) the receiver accepts the Ark; (9) the receiver reads the inheritance dossier, then streams car soccer and a stake on the same hull scores; (10) chapter two applies alpha's debt; (11) the Chronicle traces the lineage across both communities. Each step calls the same endpoints the dashboard uses. **Autoplay to the handoff** runs steps 1–8 and stops on the dossier at step 9. Practice identities, crew chat lines, the scripted mission results and the raid proof are simulated and labeled; mission results are never read from a game.

TORCHLINE's practice scenes are original illustrations and never read game data.

For free play, use **Launch the Ark** and Mission Control. Practice chat (in Mission Control and the Judge Arena) sends commands through the same parser as Twitch chat.

## Configuration read by the server

| Variable | Purpose | Secret |
| --- | --- | --- |
| `WORLD_MODE` | `simulation` or `live`; enforced, never cosmetic | No |
| `DATABASE_URL` | PostgreSQL URL; remote production requires `sslmode=verify-full` | Yes |
| `PUBLIC_BASE_URL` | Exact external origin used for cookies, OAuth and overlay links | No |
| `PORT`, `HOST` | Listener (defaults 3000 simulation / 3001 live, loopback) | No |
| `TRUST_PROXY_HOPS` | Reverse proxies in front of the process (0–5, default 0) so per-client request budgets see real client addresses | No |
| `SESSION_SECRET` | 64 hex characters; keys session and participant hashing | Yes |
| `TOKEN_ENCRYPTION_KEY` | 64 hex characters; encrypts stored OAuth grants | Yes |
| `BOT_SETUP_SECRET` | Operator-only bot authorization secret (required in production) | Yes |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Twitch application (live mode) | Secret is |
| `TWITCH_REDIRECT_URI` | Must equal `PUBLIC_BASE_URL` + `/auth/twitch/callback` | No |
| `TWITCH_BOT_USER_ID` | Dedicated bot account | No |
| `EVENTSUB_SECRET` | 10–100 alphanumeric characters; verifies webhook signatures | Yes |
| `LIVEWIRE_ENABLED` | `true`/`false`; default off | No |
| `BOT_REPLIES_ENABLED` | `true`/`false`; pauses optional chat replies only | No |
| `INPUT_*`, `FEED_MAX_*` | Admission and feed bounds; see `.env.example` | No |
| `DB_STATEMENT_TIMEOUT_MS`, `DB_LOCK_TIMEOUT_MS`, `DB_IDLE_TRANSACTION_TIMEOUT_MS` | Database budgets | No |
| `BACKUP_ENCRYPTION_KEY` | Encrypted backups; created by `pnpm backup:prepare` | Yes |

Keep real values in ignored `.env` / `.env.live` files or host secrets. Never put secrets in browser-exposed Vite variables.

## Checks

```powershell
pnpm typecheck
pnpm test                 # Vitest: engine, storage (real PostgreSQL schemas), server, Twitch fixtures
pnpm format:check
pnpm check:repo
pnpm audit:balance        # historical ark-v2 enumeration
```

Browser journeys use Playwright's Chromium in `.local/browsers`:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD/.local/browsers"
pnpm exec playwright install chromium
pnpm build
pnpm test:browser
```

Integration and browser tests create and drop their own PostgreSQL schemas inside the `DATABASE_URL` database. Point it at a disposable development database, never at a live one.

## Repository discipline

Before each commit, inspect the staged file list. Private source notes, `.env*` files (except `.env.example`), session exports and overlay access URLs must never be staged. When this Windows environment runs Git under a different account from the directory owner, use a command-scoped `git -c safe.directory=<this path> ...` rather than changing global configuration.

Update the affected requirement, ADR and changelog when behavior or architecture changes, and record executed evidence separately from plans.
