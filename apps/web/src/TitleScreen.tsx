import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ShipSystem, SystemId } from '@torchline/contracts';
import { systemLabels } from './visual-state.ts';
import { ArkView } from './ArkView.tsx';

// A clearly identified unsaved vessel visualization. Live worlds always come from the server.
const resources = {
  passengers: 216,
  hull: 80,
  power: 60,
  oxygen: 65,
  navigation: 70,
  supplies: 50,
};
const systems: ShipSystem[] = (Object.keys(systemLabels) as SystemId[]).map((id) => ({
  id,
  integrity: id === 'hull' ? 80 : id === 'navigation' ? 70 : 100,
  condition: 'operational',
  marks: [],
  lastEventId: null,
}));
export function TitleScreen({
  mode,
  ready,
  busy,
  label,
  onLaunch,
  error,
  children,
}: {
  mode?: string;
  ready: boolean;
  busy: boolean;
  label: string;
  onLaunch: () => void;
  error: string;
  children: ReactNode;
}) {
  const [reduced, setReduced] = useState(() => {
    try {
      return localStorage.getItem('torchline.motion') === 'reduced';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const enter = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        !e.repeat &&
        ready &&
        !busy &&
        (e.target === document.body || e.target === document.documentElement)
      ) {
        e.preventDefault();
        onLaunch();
      }
    };
    window.addEventListener('keydown', enter);
    return () => window.removeEventListener('keydown', enter);
  }, [onLaunch, ready, busy]);
  return (
    <main className={`title-screen ${reduced ? 'motion-reduced' : ''}`}>
      <div className="title-nebula" aria-hidden="true" />
      <div className="title-ship">
        <ArkView
          systems={systems}
          resources={resources}
          variant="title"
          readOnly
          reducedMotion={reduced}
        />
      </div>
      <div className="title-brand">
        <span className="torch-emblem" aria-hidden="true" />
        <h1>TORCHLINE</h1>
        <p className="season-label">SEASON 01 · THE ARK PROTOCOL</p>
        <p className="title-tagline">The stream ends. The world doesn’t.</p>
      </div>
      <div className="title-launch">
        <button className="launch-button" disabled={!ready || busy} onClick={onLaunch}>
          <kbd>ENTER</kbd>
          <span>{busy ? 'CONNECTING…' : label}</span>
          <span className="launch-arrow" aria-hidden="true">
            ↗
          </span>
        </button>
        <p>216 passengers · 5 chapters · every captain inherits the last one’s choices</p>
        {mode === 'live' && label === 'Create an Ark' && (
          <p className="launch-instruction">
            Create your saved voyage, then launch chapter 1 from the flight deck.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="title-access">{children}</div>
      <footer className="title-footer">
        <span>
          {mode === 'live'
            ? 'TWITCH MODE · LIVE VERIFICATION PENDING'
            : 'SIMULATION · LOCAL SAVED GAME'}
        </span>
        <span>PRELAUNCH VESSEL · AWAITING DEPARTURE</span>
        <button
          className="motion-switch"
          aria-pressed={reduced}
          onClick={() => {
            const next = !reduced;
            setReduced(next);
            try {
              localStorage.setItem('torchline.motion', next ? 'reduced' : 'full');
            } catch {
              /* Optional local preference. */
            }
          }}
        >
          {reduced ? 'Motion reduced' : 'Reduce motion'}
        </button>
      </footer>
    </main>
  );
}
