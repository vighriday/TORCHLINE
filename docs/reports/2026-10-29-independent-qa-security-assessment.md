# Independent QA and security assessment — October 29, 2026

## Scope and independence

This assessment was run from the isolated `qa/audit-2026-10-29` worktree at
commit `c757fb9` (`feat/gameplay-foundation`). The active development checkout
was not modified. The audit used only disposable local PostgreSQL data and
synthetic Twitch fixtures; it did not access Twitch credentials, subscriptions,
broadcaster accounts, production databases or live worlds.

The assessment read the architecture, requirements, decision stress review,
ADRs, diagnostic harness, October 29 comprehensive audit and current tests,
then exercised the implementation directly.

## Executive verdict

The core local custody and gameplay transaction controls withstand the new
concurrency probes. No confirmed exploitable authorization, SQL-injection,
credential, replay or custody-duplication vulnerability was found in this
commit. The required security-focused review independently returned no
confirmed vulnerabilities.

The release is not independently accepted as a live Twitch product. Native
chat gameplay, visible native bot output, installed OBS behavior and a
two-broadcaster native raid remain external acceptance gates. They cannot be
proved by the local provider fixture and were intentionally not attempted.

## Confirmed findings

### QA-01 — Passenger meter uses the wrong capacity

- **Severity:** P2, product correctness/UX
- **Location:** `apps/web/src/DeckViews.tsx:54`
- **Evidence:** `ResourceMeters` defines `passengers: 180`, while the engine,
  title screen and 3D model use 216 passengers.
- **Reproduction:** Render the initial 216-passenger world in the Bridge,
  Archive or handoff presentation. The meter computes `216 / 180 * 100` and
  clamps the bar to 100%; the displayed number is 216, but the visual scale
  communicates a capacity of 180. The same incorrect scale is used for later
  passenger values.
- **Impact:** A primary persistent-state indicator is misleading at the
  initial state and after handoff. This can make loss/recovery comparisons and
  inherited-world condition harder to interpret.
- **Recommended correction:** Use the canonical passenger capacity (216) from
  a shared contract or resource metadata rather than a duplicated UI literal.
  Add a presentation regression that verifies the initial passenger meter
  reaches exactly 100% at 216.

### QA-02 — Projection fan-out repeats database work per feed

- **Severity:** P2, performance/reliability risk
- **Locations:** `apps/server/src/app.ts:236`, `apps/server/src/app.ts:849`,
  `apps/server/src/app.ts:1066`
- **Evidence:** Every subscribed feed owns a separate `send` closure. Each
  tick invokes every closure, and each closure independently loads a snapshot.
  A dashboard snapshot also loads world state, library, handoffs, recipients
  and live integration status rather than sharing a per-channel snapshot for
  that tick.
- **Reproduction:** Open four authenticated creator feeds, leave the worlds
  idle, and run eight worker ticks. Count PostgreSQL pool queries while no
  state changes occur. The October 29 diagnostic recorded 321 queries for
  this case; the implementation still has the same per-subscriber load shape
  at this commit.
- **Impact:** Quiet overlays consume a disproportionate connection/query
  budget. Under multiple channels, a burst of gameplay or reconnects can
  compete with custody and inbox transactions, increasing latency and making
  the initial load envelope unverified.
- **Recommended correction:** Build one immutable snapshot per channel per
  worker tick/revision, then fan out the serialized payload to all feeds.
  Keep authorization checks per feed, but avoid repeating identical
  projection queries. Add a measured query-count and p95 budget test.

### QA-03 — Recovery process test cannot execute in the supplied runtime

- **Severity:** P2, validation gap (not classified as an application defect)
- **Locations:** `package.json:8`, `tests/process-recovery.test.ts:23-26`
- **Evidence:** The repository requires Node `>=24 <25`. The audit host has
  Node `v22.16.0`. The test launches `apps/server/src/main.ts` directly in a
  child process; Node 22 does not execute this TypeScript entrypoint. The full
  suite therefore ran 101/102 tests, with only process recovery failing
  because the replacement server never reached `/health/ready`.
- **Reproduction:** With Node 22 and the disposable database configured, run
  `pnpm test`. The process-recovery test times out at its 12-second readiness
  poll. Running the browser recovery tests also fails during startup in
  `@fastify/static` before any browser assertion.
- **Impact:** This environment cannot independently verify process replacement,
  graceful shutdown, or browser recovery. Treating the local result as a
  product failure would be incorrect, but treating it as validated would also
  be incorrect.
- **Recommended correction:** Re-run the process and browser suites under the
  declared Node 24 runtime. Make CI and the audit harness print and assert the
  runtime version before reporting recovery evidence.

## External acceptance gates (not local defects)

These are confirmed gaps in acceptance evidence, not claims that the code path
is broken:

1. The local Twitch provider is a fixture. It supplies OAuth identities,
   signed notifications, stream responses and successful bot sends; it cannot
   establish Twitch delivery, visible chat output, OBS behavior or native raid
   correlation.
2. No live credentials, subscriptions, broadcaster accounts or production
   worlds were accessed by this audit, as required. Consequently, the
   following remain unverified: real viewer command to canonical state,
   visible native bot reply, installed OBS refresh/recovery, genuine signed
   raid, receiver acceptance and former-host denial.
3. Public availability, current grant refresh state, deployed load/soak,
   remote backup restore and permanent judge access were not tested. They
   require an authorized live acceptance session and must not be inferred from
   local fixtures or enabled-provider metadata.

## Tests added in this branch

`tests/adversarial-qa.test.ts` adds two disposable PostgreSQL stress tests:

- 64 simultaneous mutations against one world revision: exactly one succeeds,
  all 63 losers receive `STALE_VERSION`, and only one event is persisted.
- 64 simultaneous receiver accepts for one verified intent: all duplicate
  idempotent accepts return the committed world, while exactly one custody
  event and one committed handoff row exist.

Both pass.

## Executed evidence

- Focused recovery/custody/stress suite: **16/16 passed**.
- New adversarial suite: **2/2 passed**.
- TypeScript typecheck: **passed**.
- Prettier check: **passed**.
- Production build: **passed**, with a Vite warning for a 567.95 kB
  minified `ark-scene` chunk.
- Full Vitest suite: **101/102 passed**; the sole failure is QA-03.
- Browser recovery suite: **not executable under Node 22**; no live integration
  was attempted.

No production code was changed in this branch.
