# 0021 — Resolve current public assets at request time

Accepted/implemented 2026-10-28 during the encounter presentation review. Keep the existing Fastify/static monolith and public build root.

The prior `wildcard:false` registration enumerated files at startup. Rebuilding Vite replaced hashed JS/CSS names while the running server retained old routes; a new document could request a new asset and receive SPA HTML instead. This made the current game appear missing or fail to load. Use the installed plugin's default wildcard file lookup within `apps/web/dist`, and return JSON404 for missing `/assets/*` rather than the SPA document.

Alternative: restart the application for every local build or add a custom asset handler. Restarts interrupt episodes and add needless worker recovery during presentation iteration; a custom handler duplicates the plugin's root/traversal/type handling. The existing plugin supports request-time lookup. Production still uses a built immutable image, not runtime asset mutation. This does not make deployments atomic or retain old chunks indefinitely.

| Component | Boundary |
| --- | --- |
| C1 Identity | Existing cookie/session/OAuth endpoints retain more-specific routes and authority |
| C2 Gateway | POST/raw webhook route unchanged; static wildcard is GET/HEAD only |
| C3 Participation | No commands or inputs synthesized |
| C4 Engine | No rules/version/event change |
| C5 Episodes | Avoid unnecessary restarts for frontend-only builds; authoritative timing unchanged |
| C6 Custody | No public asset grants mutation or native proof |
| C7 Database | No migration/storage/dependency change |
| C8 Projection | Existing SSE route remains specific; JSON/assets use correct response types |
| C9 Dashboard | Current document can load current hashed build without a process restart |
| C10 OBS | Same shared build; no capability in asset URLs or source |
| C11 History | No state/history changes |
| C12 Validation | Regression writes an owned new asset after app.ready, checks JS bytes/type, missing-asset/API404 and unauthenticated mutation denial |
| C13 Operations | Root remains public dist only; production build/smoke and real secret probes remain release checks |

Executed: focused regression passes locally. Broader server/browser/public verification is recorded with the encounter rollout. Reference: installed `@fastify/static` README, wildcard option and exact-case root handling. No new framework or dependency.
