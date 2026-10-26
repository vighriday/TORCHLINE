# ADR 0005: SVG/DOM presentation and server-sent updates

Status: proposed, 2026-10-26. Coverage: D4, D5.

## Context and decision

The first season displays ship systems, clues, a small route graph, decisions and aggregate state. Use React with original SVG/CSS and semantic DOM; reserve Canvas for effects justified by profiling. Send sanitized, versioned snapshots over SSE; use authenticated HTTP for creator commands. Overlays follow a channel's current hosted world through a scoped read session.

## Alternatives and consequences

Canvas/PixiJS/Phaser provide richer scene rendering but add work for accessible labels, inspection and UI testing. WebSocket supports continuous bidirectional input, which these browser surfaces do not currently require. SSE reduces custom reconnect/protocol logic, but proxy buffering, connection limits and actual OBS session behavior are risks. The browser feed is separate from Twitch's ingress transport.

## Validation and revisit

Prove deployed SSE and capability/session exchange in actual OBS before expanding the UI. Measure readability and frame time under coalesced updates. If streaming fails the gate, switch the same projection contract to WebSocket. If rich sprite/particle scenes dominate, add a Canvas/Pixi renderer without moving rules to the client. See [component review](../architecture/decision-stress-review.md).
