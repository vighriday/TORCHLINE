# Application boundaries

Implemented functional boundaries:

- `server/`: long-running Fastify service, authenticated HTTP, signed Twitch ingress, durable work, application coordination and live read feeds.
- `web/`: React dashboard, OBS overlay, history and a visibly isolated simulation interface.

The reference UI is replaceable by Claude Design. See [implementation status](../docs/planning/implementation-status.md), [system design](../docs/architecture/system-design.md), and [the design handoff](../docs/design/README.md).
