import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { LivewireRequest, WorldPresentation } from '@torchline/contracts';
import { request } from '../api.ts';
import type { DashboardSnapshot } from '../api.ts';
import { useTorchlineSession } from '../useTorchlineSession.ts';
import type { Mode, World } from './types.ts';

const modes: Mode[] = [
  'awakening',
  'mission',
  'livewire',
  'inheritance',
  'hangar',
  'broadcast',
  'archive',
  'codex',
  'simulator',
  'settings',
];
export interface Preferences {
  motion: boolean;
  contrast: boolean;
  captions: boolean;
  audio: boolean;
  scale: number;
}
const defaults: Preferences = {
  motion: true,
  contrast: false,
  captions: true,
  audio: false,
  scale: 100,
};
type Controller = ReturnType<typeof useTorchlineSession> & {
  mode: Mode;
  setMode: (mode: Mode) => void;
  readOnly: boolean;
  overlayChannel?: string;
  overlayView: string | null;
  canonical: WorldPresentation | undefined;
  display: World | undefined;
  archiveWorld: WorldPresentation | null;
  setArchiveWorld: (world: WorldPresentation | null) => void;
  overlayUrl: string;
  makeOverlay: () => void;
  launch: () => void;
  mission: (action: LivewireRequest['action']) => void;
  simulate: (text: string, actor?: string) => void;
  preferences: Preferences;
  setPreferences: (next: Preferences) => void;
};
const Context = createContext<Controller | null>(null);
export function useGame() {
  const value = useContext(Context);
  if (!value) throw Error('Missing game session');
  return value;
}
export function GameSession({ children }: { children: ReactNode }) {
  const overlayChannel = location.pathname.match(/^\/overlay\/([^/]+)\//)?.[1];
  const session = useTorchlineSession(overlayChannel);
  const [mode, changeMode] = useState<Mode>(() => {
    const name = new URLSearchParams(location.search).get('screen') as Mode;
    return modes.includes(name) ? name : 'awakening';
  });
  const [archiveWorld, setArchiveWorld] = useState<WorldPresentation | null>(null);
  const [overlayUrl, setOverlayUrl] = useState('');
  const [preferences, setPreferences] = useState<Preferences>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('torchline:display:v2') ?? 'null');
      return raw && typeof raw === 'object'
        ? {
            motion:
              typeof raw.motion === 'boolean'
                ? raw.motion
                : !matchMedia('(prefers-reduced-motion: reduce)').matches,
            contrast: raw.contrast === true,
            captions: raw.captions !== false,
            audio: raw.audio === true,
            scale: Math.max(80, Math.min(130, Number(raw.scale) || 100)),
          }
        : { ...defaults, motion: !matchMedia('(prefers-reduced-motion: reduce)').matches };
    } catch {
      return defaults;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('torchline:display:v2', JSON.stringify(preferences));
    } catch {}
    document.documentElement.dataset.motion = preferences.motion ? 'full' : 'reduced';
    document.documentElement.dataset.contrast = preferences.contrast ? 'high' : 'normal';
    document.documentElement.style.setProperty('--hud-scale', String(preferences.scale / 100));
  }, [preferences]);
  useEffect(() => {
    setArchiveWorld(null);
    setOverlayUrl('');
  }, [session.data?.me?.id]);
  useEffect(() => {
    const changed = () => {
      const name = new URLSearchParams(location.search).get('screen') as Mode;
      if (modes.includes(name)) changeMode(name);
    };
    addEventListener('popstate', changed);
    return () => removeEventListener('popstate', changed);
  }, []);
  const setMode = (next: Mode) => {
    if (overlayChannel) return;
    changeMode(next);
    const url = new URL(location.href);
    url.searchParams.set('screen', next);
    history.replaceState(null, '', url);
  };
  useEffect(() => {
    if (session.botSetup && !overlayChannel) setMode('broadcast');
  }, [session.botSetup?.accountLabel]);
  const canonical = session.data?.world ?? undefined;
  const display: World | undefined = canonical
    ? {
        ...canonical.resources,
        custodian: canonical.host,
        log: canonical.events.map((event) => ({
          time: `CH.${event.chapter}`,
          text: event.summary,
          tone: Object.values(event.resourceDelta).some((value) => (value ?? 0) < 0)
            ? 'loss'
            : 'info',
        })),
      }
    : undefined;
  const launch = () => {
    if (!session.data) return;
    if (session.data.mode === 'live' && !session.data.me) {
      location.assign('/auth/twitch');
      return;
    }
    void session.perform(async () => {
      if (!session.data?.me) await request('/api/simulator/login', { channel: 'alpha' });
      const current = await request<DashboardSnapshot>('/api/state');
      if (!current.world) await request('/api/worlds', {});
      setMode('mission');
    });
  };
  const mission = (action: LivewireRequest['action']) => {
    if (!canonical || overlayChannel) return;
    void session.perform(() =>
      request(`/api/worlds/${canonical.worldId}/livewire`, {
        action,
        expectedVersion: canonical.worldVersion,
        commandId: crypto.randomUUID(),
      }),
    );
  };
  const simulate = (text: string, actor = 'crew-one') => {
    if (session.data?.mode !== 'simulation' || overlayChannel) return;
    void session.perform(() => request('/api/simulator/commands', { text, actor }));
  };
  const makeOverlay = () => {
    if (overlayChannel) return;
    void session.perform(async () => {
      const result = await request<{ url: string }>('/api/overlay-grant', {});
      setOverlayUrl(result.url);
    });
  };
  return (
    <Context.Provider
      value={{
        ...session,
        mode,
        setMode,
        readOnly: !!overlayChannel,
        overlayChannel,
        overlayView: new URLSearchParams(location.search).get('view'),
        canonical,
        display,
        archiveWorld,
        setArchiveWorld,
        overlayUrl,
        makeOverlay,
        launch,
        mission,
        simulate,
        preferences,
        setPreferences,
      }}
    >
      {children}
    </Context.Provider>
  );
}
