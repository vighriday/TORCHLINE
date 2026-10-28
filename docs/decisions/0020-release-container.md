# 0020 — One reproducible application image

Accepted 2026-10-28. Packaging retains the modular monolith and single-replica PostgreSQL-backed runtime. Cloud deployment is still an owner-controlled operation.

Use a multi-stage Node 24.22.1 Debian slim image with pnpm 12.4.2 and frozen workspace lockfile. Build/typecheck the React assets separately; copy only production dependencies, typed server/package sources, SQL migrations, the migration CLI and built browser assets into the final image. Run as `node`, with no compiler/test runner/browser tooling. Allowlist build context; never include environment, private concept/design workspace, Git, machine tools or recordings. Record source revision as OCI metadata. The image requires environment secrets at runtime, not build arguments.

The strongest alternative is a provider-native Node build. It remains viable, but an explicit image lets CI check the exact runtime filesystem, dependency links, UID and shutdown rather than assuming the host's build defaults. No orchestration cluster, Redis or provider-specific SDK is introduced. Pinned version tags are reproducible application inputs, not immutable image digests; record the built image digest and scan/refresh base images for an actual release.

| Component | Packaging boundary |
| --- | --- |
| C1 Identity | No credentials baked in; runtime validates independent secrets and HTTPS |
| C2 Gateway | Existing webhook process, public provider edge still requires verified callback/reachability |
| C3 Participation | Same admission/parse path; no advertised capacity from container smoke |
| C4 Engine | Existing immutable TS content packaged; no compiled replacement rules |
| C5 Episodes | One worker, persisted deadlines/recovery; no automatic gameplay on deployment |
| C6 Custody | Existing database transaction/proof/consent checks; no deployment-created transfer |
| C7 Storage | Run migration as a separate release command once; PostgreSQL stays external/durable |
| C8 Projection | Same-origin static assets and SSE; provider buffering/idle policies remain staging gates |
| C9 Dashboard | Build once from reviewed code; no frontend environment secrets or prototype runtime |
| C10 OBS | Same read-only broadcast build; native OBS remains separate from Linux HTTP smoke |
| C11 History | No local-volume state; database/history survive replacement |
| C12 Validation | CI builds image and tests private-path/dev-tool exclusion, non-root/read-only run, readiness/assets/denials and SIGTERM |
| C13 Operations | Explicit host/port, healthcheck, restricted capabilities, source metadata, schema-compatible rollback |

Local Docker is unavailable. Linux CI results, rather than an unexecuted local command, establish image validation; see the release report. No registry publish, cloud hosting or spending is performed. Revisit for measured native dependencies, replicas, Node/PostgreSQL upgrades or provider constraints.
