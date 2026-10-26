# Security and privacy

No production application is running yet. The following requirements govern the planned implementation.

- Twitch credentials and refresh tokens stay on the server. Encrypt persisted credentials with a separately managed key and redact them from logs.
- Use authorization code OAuth, one-time state validation, secure HTTP-only sessions, CSRF protection, and server-side custody checks.
- Verify EventSub signatures over raw request bytes before trusting notifications, challenges, or revocations.
- Overlay URLs carry revocable read-only access. They must never confer dashboard privileges or expose Twitch tokens.
- Accept only bounded commands; render user-provided names as text. Chat must never become executable code, HTML, or model instructions.
- Store minimal viewer information. Raw chat is transient operational input, not a permanent product archive. The retention proposal is in [the data design](docs/architecture/data-and-contracts.md).
- Keep `docs/internal/`, every case variant of the original idea filename, `.env` files, local credentials, recordings, and personal Codex session exports out of Git.

Report suspected vulnerabilities privately through the repository owner's available GitHub contact channel. No dedicated security inbox or private reporting feature has been configured. Do not post credentials or exploit details in a public issue. Rotate an exposed credential or overlay capability before continuing use.
