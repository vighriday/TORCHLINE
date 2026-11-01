# ADR 0004: Hosted Twitch webhooks and consented native transfers

Status: proposed, 2026-10-26; approved 2026-10-26 (see [index](README.md)). Coverage: D6, D17; PR-01, PR-03, PR-05, PR-08.

## Context and decision

Use a confidential app, a dedicated cloud bot and explicit broadcaster `channel:bot` grants. Receive chat and canonical incoming raid notifications through signed EventSub HTTPS webhooks. Validate OAuth at startup/hourly, handle refresh/revocation, and reconcile subscriptions. A live transfer requires source intent, a matching native notification and receiver acceptance; no raid-management scope is needed.

## Alternatives and consequences

Per-creator WebSocket subscriptions simplify local ingress but add reconnect/resubscribe handling and lost-event gaps. IRC is not the recommended starting point for modern Twitch chat integration. A chat notice, manual assertion or simulated event cannot replace native proof. Webhooks require public TLS and carefully preserved bytes. Raid notifications are chat-visible only and contain no application nonce or per-viewer roster, so timing correlation remains bounded rather than perfect.

## Validation and revisit

Use signed fixtures now and genuine two-channel testing as soon as accounts are available. Preserve source custody when proof is missing. Reconsider transport only if actual hosting/authorization constraints require it; do not weaken consent or proof requirements. See [Twitch research](../research/twitch-integration.md).
