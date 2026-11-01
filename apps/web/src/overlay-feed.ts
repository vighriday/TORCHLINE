import { HttpError, request } from './api.ts';
import type { DashboardSnapshot } from './api.ts';

// A broadcast should return within seconds once its server recovers. Reads are cheap and GET-only,
// so retries stop growing at four seconds instead of leaving viewers on a stale frame.
const RETRY_CAP_MS = 4000;
// A read that has not answered in this long is retried rather than awaited, and a reopened feed
// that sends no first frame in this long is reopened: a broadcast must not wait on one stuck request.
const READ_TIMEOUT_MS = 6000;
const FIRST_FRAME_MS = 6000;

/** A capability exchange and GET-only recovery; never retries a gameplay mutation. */
export function connectOverlayFeed(
  channel: string,
  snapshot: (value: DashboardSnapshot) => void,
  status: (message: string, terminal: boolean) => void,
  serverTime: (value: string) => void = () => {},
) {
  let stopped = false,
    attempt = 0,
    source: EventSource | undefined,
    timer: ReturnType<typeof setTimeout> | undefined,
    watchdog: ReturnType<typeof setTimeout> | undefined;
  const root = `/overlay/${encodeURIComponent(channel)}`;
  const token = location.hash.slice(1);
  let exchanged = !token;
  const end = () => {
    stopped = true;
    source?.close();
    if (timer) clearTimeout(timer);
    if (watchdog) clearTimeout(watchdog);
  };
  const denied = () => {
    end();
    status('Overlay access ended. Generate a current OBS link.', true);
  };
  const retry = () => {
    if (stopped) return;
    if (watchdog) clearTimeout(watchdog);
    watchdog = undefined;
    source?.close();
    status('Overlay reconnecting. Your saved Ark will return when the connection recovers.', false);
    if (timer) return;
    timer = setTimeout(
      () => {
        timer = undefined;
        void open();
      },
      Math.min(RETRY_CAP_MS, 500 * 2 ** Math.min(attempt++, 3)),
    );
  };
  const open = async () => {
    try {
      if (!exchanged) {
        await request(`${root}/session`, { token }, undefined, READ_TIMEOUT_MS);
        if (stopped) return;
        exchanged = true;
        // Drop the private capability fragment, retain the chosen read-only layout.
        history.replaceState(null, '', location.pathname + location.search);
      }
      const current = await request<DashboardSnapshot>(
        `${root}/state`,
        undefined,
        undefined,
        READ_TIMEOUT_MS,
      );
      if (stopped) return;
      // The saved Ark has returned; live updates resume when the feed attaches.
      snapshot(current);
      status('', false);
      const feed = new EventSource(`${root}/events`);
      source = feed;
      watchdog = setTimeout(() => {
        watchdog = undefined;
        if (!stopped && source === feed) retry();
      }, FIRST_FRAME_MS);
      feed.addEventListener('snapshot', (event) => {
        if (stopped || source !== feed) return;
        if (watchdog) clearTimeout(watchdog);
        watchdog = undefined;
        try {
          snapshot(JSON.parse((event as MessageEvent).data));
          attempt = 0;
          status('', false);
        } catch {
          retry();
        }
      });
      feed.addEventListener('clock', (event) => {
        if (stopped || source !== feed) return;
        try {
          const { serverAt } = JSON.parse((event as MessageEvent).data) as { serverAt?: unknown };
          if (typeof serverAt === 'string') serverTime(serverAt);
        } catch {
          /* A malformed clock frame is ignored; the next snapshot carries a fresh server time. */
        }
      });
      feed.addEventListener('unavailable', () => {
        if (!stopped && source === feed) denied();
      });
      feed.addEventListener('retrying', () => {
        if (!stopped && source === feed) retry();
      });
      feed.onerror = () => {
        if (!stopped && source === feed) retry();
      };
    } catch (error) {
      if (stopped) return;
      if (error instanceof HttpError && [401, 403].includes(error.status)) denied();
      else retry();
    }
  };
  void open();
  return end;
}
