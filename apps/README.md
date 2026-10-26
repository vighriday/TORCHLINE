# Application boundaries

Planned after architecture review:

- `server/`: long-running Fastify service, authenticated HTTP, signed Twitch ingress, durable work, application coordination and live read feeds.
- `web/`: React dashboard, OBS overlay, history and a visibly isolated simulation interface.

No application code or package manifests exist yet. See [system design](../docs/architecture/system-design.md) and [development guide](../docs/operations/development.md).
