import { useCallback, useEffect, useRef, useState } from 'react';
import type { Command } from '@torchline/contracts';
import { HttpError, request } from './api.ts';
import type { BotSetupPreview, DashboardSnapshot } from './api.ts';
import { connectOverlayFeed } from './overlay-feed.ts';
import { orderedSnapshot, withServerTime } from './snapshot-order.ts';

// Presentation-independent session/transport. Components decide layout; the server decides authority.
export function useTorchlineSession(overlayChannel?: string) {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const current = useRef<DashboardSnapshot | null>(null);
  const refreshVersion = useRef(0);
  const adopt = useCallback((next: DashboardSnapshot) => {
    current.current = orderedSnapshot(current.current, next);
    setData(current.current);
  }, []);
  const clear = useCallback(() => {
    current.current = null;
    setData(null);
  }, []);
  const patchClock = useCallback((serverAt: string) => {
    const next = withServerTime(current.current, serverAt);
    if (!next || next === current.current) return;
    current.current = next;
    setData(next);
  }, []);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [reconnecting, setReconnecting] = useState(false);
  const [feedEpoch, setFeedEpoch] = useState(0);
  const [busy, setBusy] = useState(false);
  const [botSetup, setBotSetup] = useState<BotSetupPreview | null>(null);
  const refresh = useCallback(async () => {
    if (!overlayChannel) {
      const version = ++refreshVersion.current;
      try {
        const next = await request<DashboardSnapshot>('/api/state');
        const pending =
          next.mode === 'live'
            ? (await request<{ pending: BotSetupPreview | null }>('/api/operator/bot-setup'))
                .pending
            : null;
        if (version !== refreshVersion.current) return;
        adopt(next);
        setBotSetup(pending);
        setConnectionError('');
        return current.current;
      } catch (error) {
        if (version !== refreshVersion.current) return;
        if (error instanceof HttpError && [401, 403].includes(error.status)) {
          clear();
          setBotSetup(null);
        }
        throw error;
      }
    }
  }, [overlayChannel, adopt, clear]);
  useEffect(() => {
    void refresh().catch((e) => setConnectionError(e.message));
  }, [refresh]);
  useEffect(() => {
    if (overlayChannel || !data?.me) return;
    let active = true;
    const channel = data.me.id;
    let source: EventSource | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const close = () => {
      source?.close();
      source = undefined;
    };
    const retry = () => {
      if (!active || timer) return;
      close();
      setConnectionError('Connection interrupted. Reconnecting…');
      timer = setTimeout(
        () => {
          timer = undefined;
          void recover();
        },
        Math.min(15000, 500 * 2 ** Math.min(attempt++, 5)),
      );
    };
    const open = () => {
      if (!active) return;
      const feed = new EventSource('/api/live/events');
      source = feed;
      feed.addEventListener('snapshot', (event) => {
        if (!active || source !== feed || current.current?.me?.id !== channel) return;
        try {
          const next: DashboardSnapshot = JSON.parse((event as MessageEvent).data);
          if (next.me?.id !== channel) throw Error('Feed identity changed.');
          adopt(next);
          attempt = 0;
          setConnectionError('');
        } catch {
          retry();
        }
      });
      feed.addEventListener('clock', (event) => {
        if (!active || source !== feed || current.current?.me?.id !== channel) return;
        try {
          const { serverAt } = JSON.parse((event as MessageEvent).data) as { serverAt?: unknown };
          if (typeof serverAt === 'string') patchClock(serverAt);
        } catch {
          /* A malformed clock frame is ignored; the next snapshot carries a fresh server time. */
        }
      });
      feed.addEventListener('unavailable', () => {
        if (!active || source !== feed || current.current?.me?.id !== channel) return;
        retry();
      });
      feed.onerror = () => {
        if (active && source === feed) retry();
      };
    };
    const recover = async () => {
      if (!active || current.current?.me?.id !== channel) return;
      try {
        const next = await refresh();
        if (!active || next?.me?.id !== channel) return;
        open();
      } catch (error) {
        if (error instanceof HttpError && [401, 403].includes(error.status)) {
          if (active) setConnectionError('Your creator session ended. Reconnect to resume.');
          return;
        }
        retry();
      }
    };
    open();
    return () => {
      active = false;
      close();
      if (timer) clearTimeout(timer);
    };
  }, [data?.me?.id, overlayChannel, refresh, feedEpoch, adopt, patchClock]);
  useEffect(() => {
    if (!overlayChannel) return;
    const replacement = () => {
      if (!location.hash.slice(1)) return;
      clear();
      setError('');
      setFeedEpoch((epoch) => epoch + 1);
    };
    addEventListener('hashchange', replacement);
    return () => removeEventListener('hashchange', replacement);
  }, [overlayChannel, clear]);
  useEffect(() => {
    if (!overlayChannel) return;
    return connectOverlayFeed(
      overlayChannel,
      adopt,
      (message, terminal) => {
        if (terminal) clear();
        setError(message);
      },
      patchClock,
    );
  }, [overlayChannel, feedEpoch, adopt, clear, patchClock]);
  async function perform(action: () => Promise<unknown>) {
    refreshVersion.current++;
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  async function reconnect() {
    setReconnecting(true);
    setError('');
    setConnectionError('');
    try {
      await refresh();
      setFeedEpoch((epoch) => epoch + 1);
    } catch (e) {
      setConnectionError((e as Error).message);
    } finally {
      setReconnecting(false);
    }
  }
  const visibleError = error || connectionError;
  const world = data?.world;
  const send = (command: Command) => {
    if (world)
      void perform(() =>
        request(`/api/worlds/${world.worldId}/commands`, {
          command,
          expectedVersion: world.worldVersion,
          commandId: crypto.randomUUID(),
        }),
      );
  };
  return {
    data,
    botSetup,
    busy,
    reconnecting,
    visibleError,
    setError,
    perform,
    reconnect,
    send,
  };
}
