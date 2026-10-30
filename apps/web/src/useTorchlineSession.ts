import { useCallback, useEffect, useState } from 'react';
import type { Command } from '@torchline/contracts';
import { request } from './api.ts';
import type { BotSetupPreview, DashboardSnapshot } from './api.ts';
import { connectOverlayFeed } from './overlay-feed.ts';

// Presentation-independent session/transport. Components decide layout; the server decides authority.
export function useTorchlineSession(overlayChannel?: string) {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [reconnecting, setReconnecting] = useState(false);
  const [feedEpoch, setFeedEpoch] = useState(0);
  const [busy, setBusy] = useState(false);
  const [botSetup, setBotSetup] = useState<BotSetupPreview | null>(null);
  const refresh = useCallback(async () => {
    if (!overlayChannel) {
      const next = await request<DashboardSnapshot>('/api/state');
      const pending =
        next.mode === 'live'
          ? (await request<{ pending: BotSetupPreview | null }>('/api/operator/bot-setup')).pending
          : null;
      setData(next);
      setBotSetup(pending);
      setConnectionError('');
      return next;
    }
  }, [overlayChannel]);
  useEffect(() => {
    void refresh().catch((e) => setConnectionError(e.message));
  }, [refresh]);
  useEffect(() => {
    if (overlayChannel || !data?.me) return;
    let active = true;
    const source = new EventSource('/api/live/events');
    source.addEventListener('snapshot', (event) => {
      if (!active) return;
      try {
        setData(JSON.parse((event as MessageEvent).data));
        setConnectionError('');
      } catch {
        setConnectionError('Connection interrupted. Reconnect to check your latest saved state.');
      }
    });
    source.addEventListener('unavailable', () => {
      source.close();
      void refresh()
        .then((next) => {
          if (active && next?.me)
            setConnectionError('Live updates interrupted. Reconnect to resume.');
        })
        .catch(() => {
          if (active)
            setConnectionError(
              'Connection interrupted. Reconnect to check your latest saved state.',
            );
        });
    });
    source.onerror = () => {
      if (active) setConnectionError('Connection interrupted. Reconnecting…');
    };
    return () => {
      active = false;
      source.close();
    };
  }, [data?.me?.id, overlayChannel, refresh, feedEpoch]);
  useEffect(() => {
    if (!overlayChannel) return;
    const replacement = () => {
      if (!location.hash.slice(1)) return;
      setData(null);
      setError('');
      setFeedEpoch((epoch) => epoch + 1);
    };
    addEventListener('hashchange', replacement);
    return () => removeEventListener('hashchange', replacement);
  }, [overlayChannel]);
  useEffect(() => {
    if (!overlayChannel) return;
    return connectOverlayFeed(overlayChannel, setData, (message, terminal) => {
      if (terminal) setData(null);
      setError(message);
    });
  }, [overlayChannel, feedEpoch]);
  async function perform(action: () => Promise<unknown>) {
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
    setData,
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
