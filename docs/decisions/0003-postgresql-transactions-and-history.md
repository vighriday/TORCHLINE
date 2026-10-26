# ADR 0003: Explicit PostgreSQL consistency and durable history

Status: proposed, 2026-10-26. Coverage: D7, D8, D10, D16.

## Context and decision

Custody transfer touches two channels, one world, proof, intent and history. Use PostgreSQL 17 with `pg`, parameterized SQL and ordered migrations. Commit snapshots, canonical events and publish intents atomically. Use relational constraints and fixed-order row locks, plus database-backed inbox, outbox, deadlines and worker leases. Keep normalized participation evidence for replay without retaining raw chat.

## Alternatives and consequences

SQLite is simpler but mismatches the intended hosted multi-world workload. A document store requires more application coordination for unique custody. Drizzle/Prisma do not remove custom lock/constraint work; explicit SQL is easier to inspect here, at the cost of manual row mapping and migration discipline. Redis queues provide useful tooling but add a second persistence boundary. A full event-sourcing framework adds abstraction; snapshots alone cannot prove lineage/replay.

## Validation and revisit

Run real PostgreSQL races, close-watermark, crash and replay tests. One checked-out connection is mandatory per transaction. Add a queue service or query layer only after measured bottlenecks or maintenance evidence. Scale-out also requires cross-instance feed fan-out. See [data design](../architecture/data-and-contracts.md).
