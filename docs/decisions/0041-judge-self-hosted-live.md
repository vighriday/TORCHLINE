# ADR 0041 — Judges can run their own live instance

Date: 2026-11-02. Status: Accepted. Complements [ADR 0039](0039-hosted-practice-demo.md).

## Context

The hosted demo is practice only, and the verified live service runs on the owner's computer through a tunnel only while the owner streams. Judges could watch real Twitch play in the video but could not reproduce it without the owner. Reproducing it needs four things the owner cannot lend: a Twitch application, a public HTTPS address for EventSub, a broadcaster account and a separate bot account.

## Decision

1. **[`compose.live.yaml`](../../compose.live.yaml)** runs PostgreSQL 17 (named volume), the release image in `WORLD_MODE=live` with LIVEWIRE on, and the official ngrok agent pinned to `3.39.12-alpine`. The app publishes no port; Twitch and the browser reach it only through the judge's own ngrok dev domain, which every free ngrok account includes and which never changes.
2. **Development mode, as in the verified run.** The 2 November live session ran without `NODE_ENV=production`. Production mode additionally requires TLS to a remote database, which this private compose network does not use. `TRUST_PROXY_HOPS=1` because the tunnel always sits in front.
3. **[`.env.live.example`](../../.env.live.example)** lists only what a judge supplies: ngrok token and domain, Twitch client ID and secret, and four independent random keys. The redirect is derived from `PUBLIC_BASE_URL`, so the two cannot disagree. Compose refuses to start while any value is missing. `.env.live` is ignored by Git and excluded from the image build context.
4. **CI checks it on every push** ([`smoke-live-compose.mjs`](../../scripts/smoke-live-compose.mjs)): with throwaway credentials and without starting ngrok, the server must report live mode and send Twitch sign-in to the configured client with the exact redirect and the `channel:bot` scope. Nothing contacts Twitch or ngrok.
5. **The README judge guide** gives five self-contained paths: video, hosted demo, Docker practice, own live instance, and tests.

## Alternatives considered

- **Cloudflare quick tunnels.** No account needed, but Cloudflare documents that quick tunnels do not support server-sent events, which the dashboard and overlay use.
- **A judge-deployed Render service in live mode.** The free instance sleeps after idle time and the demo image recreates its database on every start, so a live session could reset mid-test.
- **Production mode with database TLS inside compose.** More moving parts for no benefit on a private network; the verified live run used development mode.

## Consequences

- Judges can play from their own chat, see their own overlay, run LIVEWIRE and get bot replies without the owner's machine or accounts. A native raid also works if they connect two of their own broadcaster accounts; that flow is contract-tested but not yet verified between two live broadcasters.
- CI evidence covers start-up and the sign-in redirect only. Chat delivery through a judge's tunnel is verified by the same server's 2 November live run, not by CI.
- Component review against C1–C13 is not recorded yet.
