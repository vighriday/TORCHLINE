# Security and privacy

The functional application runs locally and is not production-certified or deployed. Implemented security boundaries and remaining hardening are recorded in [implementation status](docs/planning/implementation-status.md). The following requirements govern development and release.

- Twitch credentials and refresh tokens stay on the server. Encrypt persisted credentials with a separately managed key and redact them from logs.
- Use authorization code OAuth, one-time state validation, secure HTTP-only sessions, CSRF protection, and server-side custody checks.
- Verify EventSub signatures over raw request bytes before trusting notifications, challenges, or revocations.
- Overlay URLs carry revocable read-only access. They must never confer dashboard privileges or expose Twitch tokens.
- Public Chronicle links are revocable read-only capabilities for one world's saved record. Only a hash is stored; the token stays in the URL fragment and request bodies. Rotating replaces the creator's link and disconnecting withdraws it.
- Unsigned entry routes have per-client request budgets (429 with `Retry-After`); signed webhooks keep their own admission policy.
- Accept only bounded commands; render user-provided names as text. Chat must never become executable code, HTML, or model instructions.
- Store minimal viewer information. Raw chat is transient operational input, not a permanent product archive. Bounded retention of operational rows is implemented (`012_retention.sql`, `packages/storage/src/retention.ts`): terminal inbox and dedup rows after 14 days, delivered outbox rows after 7, expired sessions after 24 hours. World and custody history is never pruned. The stricter target windows remain in [the data design](docs/architecture/data-and-contracts.md).
- Keep `docs/internal/`, every case variant of the original idea filename, `.env` files, local credentials, recordings, and personal Codex session exports out of Git.

Report suspected vulnerabilities privately through the repository owner's available GitHub contact channel. No dedicated security inbox or private reporting feature has been configured. Do not post credentials or exploit details in a public issue. Rotate an exposed credential or overlay capability before continuing use.
