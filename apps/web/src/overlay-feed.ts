import { HttpError, request } from './api.ts';
import type { DashboardSnapshot } from './api.ts';

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
    timer: ReturnType<typeof setTimeout> | undefined;
  const root = `/overlay/${encodeURIComponent(channel)}`;
  const token = location.hash.slice(1);
  let exchanged = !token;
  const end = () => {
    stopped = true;
    source?.close();
    if (timer) clearTimeout(timer);
  };
  const denied = () => {
    end();
    status('Overlay access ended. Generate a current OBS link.', true);
  };
  const retry = () => {
    if (stopped) return;
    source?.close();
    status('Overlay reconnecting. Your saved Ark will return when the connection recovers.', false);
    if (timer) return;
    timer = setTimeout(
      () => {
        timer = undefined;
        void open();
      },
      Math.min(15000, 500 * 2 ** Math.min(attempt++, 5)),
    );
  };
  const open = async () => {
    try {
      if (!exchanged) {
        await request(`${root}/session`, { token });
        if (stopped) return;
        exchanged = true;
        // Drop the private capability fragment, retain the chosen read-only layout.
        history.replaceState(null, '', location.pathname + location.search);
      }
      const current = await request<DashboardSnapshot>(`${root}/state`);
      if (stopped) return;
      snapshot(current);
      const feed = new EventSource(`${root}/events`);
      source = feed;
      feed.addEventListener('snapshot', (event) => {
        if (stopped || source !== feed) return;
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
