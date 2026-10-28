# Encrypted backup and restore

Implemented 2026-10-28; this supplements managed-provider backups. No scheduled off-machine backup or production recovery guarantee exists yet.

## Local live environment

1. Run `pnpm backup:prepare` once. It appends a random independent `BACKUP_ENCRYPTION_KEY` to the ignored `.env.live` without printing it. Preserve that key in your password manager or deployment secret store, separately from archives. Losing it makes these backups unrecoverable. Do not replace the token encryption key or session secret.
2. Run `pnpm backup:create .local/backups/before-release.tlb`. An existing filename is refused. The report prints counts and the archive path, never credentials. Live gameplay need not stop: PostgreSQL exports a consistent snapshot for both the dump and table fingerprints.
3. Run `pnpm backup:drill .local/backups/before-release.tlb`. This requires permission to create a scratch database. It restores into a uniquely named disposable database, compares every table's ordered row hashes and replays each world, then drops only that scratch database. A failed drill is not a usable recovery result.

Matching PostgreSQL 17 tools must be installed (`PG_BIN` overrides their directory). In Linux CI, `PG_TOOL_CONTAINER=postgres:17` uses official matching CLI tools through Docker's host network; it does not put passwords in command arguments. This container mode is for a Linux Docker host, not Windows Docker Desktop networking. The application runtime itself needs no PostgreSQL CLI tools.

## Restore after an incident

Keep the original database intact. Stop application writes before choosing the recovery point. Provision a **different, empty database**, with the same/newer PostgreSQL major and required privileges. In a trusted operator terminal, load `DATABASE_URL` (original source), `RESTORE_DATABASE_URL` (new destination) and the original `BACKUP_ENCRYPTION_KEY`; run `pnpm backup:restore PATH_TO_ARCHIVE`. Never paste connection strings or keys into tickets/chat. In deployment run `node scripts/backup.ts restore PATH_TO_ARCHIVE` with those environment variables; `.env.live` is only this local helper's configuration.

The helper authenticates all ciphertext before sending SQL, refuses the source database and nonempty destinations, then streams the restore in a single transaction without a plaintext dump file. For a public-schema archive it removes only the empty default `public` schema with `RESTRICT` so the dump can recreate it. Use a destination isolated from other writers. If fingerprint/replay verification fails, keep that destination isolated and investigate; do not point the app at it.

Only after successful verification: run the candidate's schema readiness check, configure the app with the new database, start one replica and verify health/current state. Startup recovery pauses interrupted episodes. Revalidate Twitch grants and exact subscriptions, reconnect the overlay, and test ordinary play before reopening a handoff. Rolling back code must remain schema-compatible; do not reverse migrations or replay external sends blindly.

The archive contains sessions, encrypted grants, durable inbox/outbox and custody history. Treat both archive and restored database as sensitive. Restore does not invent raid proof or undo Twitch-side messages. Confirm an interrupted bot send's existing uncertain outcome before retrying. Keys stored only on the lost machine defeat disaster recovery: store encrypted archives and key separately off-machine using an owner-approved provider and retention policy.

## Evidence and limits

- Native PostgreSQL integration test: real public-schema gameplay, persistent navigation sacrifice, encrypted sentinel, all-table fingerprints, deterministic replay, wrong key/corruption rejected before SQL, same-source/nonempty protections and source preservation.
- Actual local live snapshot: 25 tables / 25 rows, authenticated scratch restore succeeded on October 28. **Zero live worlds existed**, so gameplay replay evidence comes from the isolated test, not this archive.
- No remote backup scheduler, managed restore, measured production RPO/RTO, cross-major recovery or large-data throughput claim. A staging restore with deployment secrets is a release gate.

See [ADR 0018](../decisions/0018-encrypted-recovery.md).
