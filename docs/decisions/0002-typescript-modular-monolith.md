# ADR 0002: TypeScript modular monolith

Status: proposed, 2026-10-26; approved 2026-10-26 (see [index](README.md)). Coverage: D1, D2, D3, D12.

## Context and decision

The same rules and contracts are used in simulation, backend validation and browser presentation. Use strict TypeScript on Node 24, Fastify 5, React 19/Vite, and a small pnpm workspace. Deploy one application service with internal module boundaries; keep engine/contracts reusable and storage/Twitch server-only.

## Alternatives and consequences

Go can handle high concurrency effectively but introduces a second language and shared-contract boundary. Next.js provides a cohesive full-stack framework, but SSR is not a product requirement and a long-running ingress/worker host remains necessary. Microservices add deployment and consistency work before measured need. Fastify's raw parser and streaming integration still need explicit tests; choosing it does not automatically make HMAC or jobs reliable.

## Validation and revisit

Pin compatible versions, verify browser bundle boundaries, deploy raw-body/streaming spikes, and measure event-loop lag under replay/load. Extract CPU-intensive replay into a worker if it delays ingress. Split services only when independent scaling or fault evidence warrants it. References and alternatives: [technology](../planning/technology.md).
