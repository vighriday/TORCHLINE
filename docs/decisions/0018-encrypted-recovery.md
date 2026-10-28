# 0018 — Authenticated snapshots and isolated recovery

Accepted/implemented 2026-10-28. Keep PostgreSQL authoritative and deployment rollback independent from data restoration.

Use native custom-format `pg_dump` with an exported repeatable-read snapshot and ordered per-table fingerprints. Stream to AES-256-GCM using a separate backup key, random nonce and authenticated metadata; never persist plaintext. Serialize with migrations using the existing advisory lock. Matching PG17 CLI tools run natively locally and in an official PG17 container in Linux CI.

Authenticate the entire archive before restoration, refuse the original/nonempty destination, stream a transactional restore, verify every table and replay every immutable-version world. Scratch drills create and drop only their own random database. Empty `public` is removed with RESTRICT before its archived definition is restored. A restore destination must have no concurrent writers and stays isolated until verification passes.

Provider-managed recovery is still required for automated retention and remote durability. Plain SQL exports expose grants/session data; snapshots alone do not prove replay; destructive in-place `--clean` is harder to recover from. The small explicit tool preserves boundaries without introducing another runtime service. Hash verification scans all rows; large archives require measured maintenance resources and retention. Trusted archive handling matters: a valid operator backup can contain SQL and sensitive credentials.

| Component | Recovery contract |
| --- | --- |
| C1 Identity | Restore encrypted grants/sessions; preserve original token key separately; revalidate real Twitch identity |
| C2 Gateway | Retain delivery dedup/proof provenance; no synthetic callback or external subscription rewind |
| C3 Participation | Restore persisted admission/inbox; no raw chat export added |
| C4 Engine | Replay every world using stored immutable rules; mismatch blocks use |
| C5 Episodes | Existing startup recovery pauses interrupted phases; no automatic captain decisions |
| C6 Custody | Restore atomic history/state together; never fabricate a raid or transfer for validation |
| C7 Database/work | Shared consistent snapshot, migration lock, row hashes, separate empty target and transactional restore |
| C8 Projection | Reconnect and load canonical snapshots after operator cutover |
| C9 Dashboard | No restore API, admin page or viewer power; operator CLI only |
| C10 OBS | Existing read-only grants restored; verify rotation and actual OBS separately |
| C11 History | Every application table fingerprinted; world replay adds semantic verification |
| C12 Validation | Real PG17 public-schema fixture, corruption/wrong-key/no-overwrite guards; actual local live scratch drill |
| C13 Operations | Independent backup key, no secret argv/logging/plaintext, documented provider/retention/RPO gates |

Evidence: isolated integration test passes; actual local live archive restores 25 tables/25 rows/zero worlds. No production recovery or off-machine backup is claimed. See [runbook](../operations/backup-and-restore.md). Revisit for measured archive size, deployment provider restore features, multiple schemas/extensions or a major PostgreSQL upgrade.

Primary references: [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).
