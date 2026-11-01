import { lazy, Suspense, useEffect, useState } from 'react';
import { GameSession, useGame } from './session.tsx';
import { Button, Icon, Brand, ResourceBar } from './primitives.tsx';
import { GameControls, PhaseClock } from './GameControls.tsx';
import { Livewire } from './Livewire.tsx';
import {
  Inheritance,
  Hangar,
  BroadcastStudio,
  Archive,
  Codex,
  Simulator,
  Settings,
} from './platform.tsx';
import type { Mode, Sector, World } from './types.ts';
import type { WorldPresentation } from '@torchline/contracts';
import { SceneBoundary } from './SceneBoundary.tsx';
import { ArrivalDossier } from './Dossier.tsx';
import { SoundEffects } from './SoundEffects.tsx';
import './index.css';
import './integration.css';
import './experience.css';
const Ark3D = lazy(() => import('./Ark3D.tsx').then((module) => ({ default: module.Ark3D })));
const sectorData = {
  bridge: { name: 'Navigation Bridge', code: 'NAV-01' },
  cryo: { name: 'Cryogenic Bays', code: 'CRYO-04' },
  reactor: { name: 'Reactor Core', code: 'RX-02' },
  life: { name: 'Life Support', code: 'LS-03' },
};
export function ArkShip({
  selected = 'bridge',
  navigation = 100,
  mini = false,
  onSelect,
  view = 'exterior',
  presentation,
}: {
  selected?: Sector;
  navigation?: number;
  mini?: boolean;
  onSelect?: (sector: Sector) => void;
  view?: 'exterior' | 'cockpit';
  presentation?: WorldPresentation;
}) {
  const { canonical: current, readOnly, preferences } = useGame();
  const canonical = presentation ?? current;
  const dead = navigation === 0;
  return (
    <div
      className={`ark-viewport ${mini ? 'ark-viewport--mini' : ''} ${dead ? 'ark-viewport--damaged' : ''}`}
    >
      <SceneBoundary readOnly={readOnly}>
        <Suspense
          fallback={
            <div className="ark-canvas-loading">
              <span>INITIALIZING VESSEL TWIN</span>
              <b>ARK—001</b>
            </div>
          }
        >
          <Ark3D
            selected={selected}
            navigation={navigation}
            mini={mini}
            onSelect={onSelect}
            view={view}
            resources={canonical?.resources}
            systems={canonical?.systems}
            reducedMotion={!preferences.motion}
            readOnly={readOnly}
          />
        </Suspense>
      </SceneBoundary>
      {dead && !mini && (
        <div className="nav-dead-stamp">
          <span>SYSTEM LOSS</span>
          <strong>NAVIGATION OFFLINE</strong>
        </div>
      )}
    </div>
  );
}

const modeNames: Record<Mode, string> = {
  awakening: 'The Awakening',
  mission: 'Mission Control',
  livewire: 'Livewire',
  inheritance: 'Relay Handoff',
  hangar: 'World Hangar',
  broadcast: 'Creator Studio',
  archive: 'World Chronicle',
  codex: 'Field Manual',
  simulator: 'Judge Arena',
  settings: 'Settings',
};

function TopBar({
  mode,
  setMode,
  openLauncher,
}: {
  mode: Mode;
  setMode: (mode: Mode) => void;
  openLauncher: () => void;
}) {
  const { data } = useGame();
  return (
    <header className="topbar">
      <Button
        className="brand-button"
        onClick={() => setMode('awakening')}
        ariaLabel="Open The Awakening"
      >
        <Brand />
      </Button>
      <nav className="mode-nav" aria-label="Experience mode">
        <Button className={mode === 'mission' ? 'active' : ''} onClick={() => setMode('mission')}>
          <Icon name="grid" /> Mission Control
        </Button>
        <Button className={mode === 'livewire' ? 'active' : ''} onClick={() => setMode('livewire')}>
          <Icon name="pulse" /> Livewire Dock
        </Button>
        <Button
          className={mode === 'inheritance' ? 'active' : ''}
          onClick={() => setMode('inheritance')}
        >
          <Icon name="transfer" /> Inheritance
        </Button>
      </nav>
      <Button className="system-launcher-button" onClick={openLauncher}>
        <span>COMMAND OS</span>
        <b>{modeNames[mode]}</b>
        <Icon name="grid" />
      </Button>
      <div className="sim-status">
        <span className="status-pip" />{' '}
        {data?.mode === 'live' ? 'TWITCH SESSION' : 'SAVED PRACTICE'}{' '}
        <b>{data?.me?.label ?? 'CONNECT CAPTAIN'}</b>
      </div>
    </header>
  );
}

const navigationItems: Array<{ mode: Mode; index: string; name: string; description: string }> = [
  {
    mode: 'awakening',
    index: '01',
    name: 'The Awakening',
    description: 'Cinematic platform entry',
  },
  { mode: 'mission', index: '02', name: 'Mission Control', description: 'Operate ARK—001' },
  { mode: 'livewire', index: '03', name: 'Livewire', description: 'Cross-game tactical dock' },
  { mode: 'inheritance', index: '04', name: 'Relay', description: 'Custody and handoff' },
  { mode: 'hangar', index: '05', name: 'Hangar', description: 'World and vessel library' },
  { mode: 'broadcast', index: '06', name: 'Broadcast', description: 'Creator and OBS studio' },
  { mode: 'archive', index: '07', name: 'Archive', description: 'Persistent world chronicle' },
  { mode: 'codex', index: '08', name: 'The Codex', description: 'Field manual and rules' },
  { mode: 'simulator', index: '09', name: 'Judge Arena', description: 'Guided deterministic demo' },
  { mode: 'settings', index: '10', name: 'Settings', description: 'Display and accessibility' },
];

function CommandLauncher({
  mode,
  setMode,
  close,
}: {
  mode: Mode;
  setMode: (mode: Mode) => void;
  close: () => void;
}) {
  useEffect(() => {
    const previous = document.activeElement;
    const panel = document.querySelector<HTMLElement>('.launcher-panel');
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>('button,[href],input,select,[tabindex="0"]') ?? [],
      );
    focusable()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') {
        const all = focusable();
        if (!all.length) return;
        const first = all[0],
          last = all[all.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <div className="command-launcher">
      <Button className="launcher-scrim" onClick={close} ariaLabel="Close command launcher" />
      <section
        className="launcher-panel"
        role="dialog"
        aria-modal="true"
        aria-label="All ship systems"
      >
        <div className="launcher-heading">
          <div>
            <span>TORCHLINE COMMAND OS</span>
            <strong>ALL SHIP SYSTEMS</strong>
          </div>
          <small>ARK—001 / CAPTAIN AUTHORITY</small>
          <Button onClick={close} ariaLabel="Close launcher">
            <Icon name="close" />
          </Button>
        </div>
        <div className="launcher-grid">
          {navigationItems.map((item) => (
            <Button
              key={item.mode}
              className={mode === item.mode ? 'active' : ''}
              onClick={() => {
                setMode(item.mode);
                close();
              }}
            >
              <span>{item.index}</span>
              <div>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </div>
              <Icon name="chevron" />
            </Button>
          ))}
        </div>
        <div className="launcher-footer">
          <span className="status-pip" /> ONE ARK · SAVED CONSEQUENCES <b>LIVEWIRE v0</b>
        </div>
      </section>
    </div>
  );
}

export function MissionControl({
  navigation,
  selected,
  setSelected,
  world,
}: {
  navigation: number;
  selected: Sector;
  setSelected: (s: Sector) => void;
  world: World;
}) {
  const { canonical: ship, readOnly } = useGame();
  const [view, setView] = useState<'exterior' | 'cockpit'>('exterior');
  const dead = navigation === 0;
  if (!ship) return null;
  const diagnostic = ship.systems.find(
    (system) =>
      system.id ===
      ({ bridge: 'navigation', cryo: 'habitat', reactor: 'reactor', life: 'lifeSupport' } as const)[
        selected
      ],
  )!;
  return (
    <main
      className={`mission ${dead ? 'mission--nav-dead' : ''}`}
      data-world={ship.worldId}
      data-phase={ship.phase}
      data-version={ship.worldVersion}
    >
      <section className="left-rail">
        <div className="chapter-block">
          <span className="eyebrow">
            {ship.chapter === 0 ? 'PRE-LAUNCH' : `CHAPTER ${ship.chapter}`} / EVENT{' '}
            {ship.gameVersion}
          </span>
          <strong>{ship.title}</strong>
          <p>{ship.recap}</p>
          {!readOnly && <ArrivalDossier world={ship} />}
          <PhaseClock world={ship} />
        </div>
        <div className="vital-stack">
          <ResourceBar
            label="HULL INTEGRITY"
            value={world.hull}
            tone={world.hull < 35 ? 'critical' : 'warning'}
          />
          <ResourceBar
            label="OXYGEN RESERVE"
            value={world.oxygen}
            tone={world.oxygen < 35 ? 'critical' : 'normal'}
          />
          <ResourceBar label="POWER LOAD" value={world.power} tone="warning" />
          <ResourceBar
            label="NAVIGATION"
            value={navigation}
            tone={navigation === 0 ? 'critical' : 'warning'}
          />
          <ResourceBar
            label="SUPPLIES"
            value={world.supplies}
            unit="crates"
            tone={world.supplies < 30 ? 'critical' : 'warning'}
          />
        </div>
        <div className="passenger-readout">
          <Icon name="people" size={24} />
          <div>
            <strong>{world.passengers}</strong>
            <span>PASSENGERS ABOARD</span>
          </div>
          <small>{Math.max(0, 216 - world.passengers)} LOST · 216 CAPACITY</small>
        </div>
        <div className="captain-note">
          <span>FLIGHT RECORDER / {ship.gameVersion}</span>
          <p>
            {ship.events.at(-1)?.summary ??
              'No recorded consequence yet. Every commitment will stay with this Ark.'}
          </p>
        </div>
      </section>

      <section className={`ship-stage ship-stage--${selected} ${dead ? 'ship-stage--dead' : ''}`}>
        <div className="ark-environment" aria-hidden="true">
          <div className="space-body" />
          <div className="orbital-rings">
            <span />
            <span />
            <span />
          </div>
          <div className="hangar-depth">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="light-shaft light-shaft--one" />
          <div className="light-shaft light-shaft--two" />
          <div className="drift-field">
            {Array.from({ length: 22 }).map((_, i) => (
              <i key={i} />
            ))}
          </div>
        </div>
        <div className="cockpit-frame" aria-hidden="true">
          <div className="frame-top">
            <span />
            <span />
            <span />
          </div>
          <div className="frame-left" />
          <div className="frame-right" />
          <div className="frame-console">
            <span>THRUST VECTOR</span>
            <i />
            <i />
            <i />
            <i />
            <b>0.042</b>
          </div>
        </div>
        <div className="stage-heading">
          <div>
            <span className="eyebrow">ARK-001 / INTERNAL TELEMETRY</span>
            <strong>
              {view === 'cockpit'
                ? 'COMMAND DECK'
                : dead
                  ? 'GUIDANCE FAILURE'
                  : 'SHIP CROSS-SECTION'}
            </strong>
          </div>
          <div className="telemetry">
            <span>
              CHAPTER <b>{ship.chapter}/5</b>
            </span>
            <span>
              STATE <b>{ship.worldVersion}</b>
            </span>
            <span>
              PHASE <b>{ship.phase.replaceAll('-', ' ').toUpperCase()}</b>
            </span>
          </div>
          <div className="view-switch">
            <Button
              className={view === 'exterior' ? 'active' : ''}
              onClick={() => setView('exterior')}
            >
              EXTERIOR
            </Button>
            <Button
              className={view === 'cockpit' ? 'active' : ''}
              onClick={() => setView('cockpit')}
            >
              3D COCKPIT
            </Button>
          </div>
        </div>
        <ArkShip selected={selected} navigation={navigation} onSelect={setSelected} view={view} />
        {readOnly && <ArrivalDossier world={ship} variant="broadcast" />}
        <div className="spatial-reticle" aria-hidden="true">
          <span />
          <span />
          <i />
          <b>{selected === 'bridge' ? 'NAV—01' : sectorData[selected].code}</b>
          <small>RANGE 041.8m</small>
        </div>
        <div className="world-caption" aria-hidden="true">
          <span>PERSISTENT VESSEL / DIGITAL TWIN</span>
          <strong>{ship.title}</strong>
          <small>CONSEQUENCES SURVIVE CHAPTERS AND CAPTAINS</small>
        </div>
        <div className="sector-tabs">
          {(Object.keys(sectorData) as Sector[]).map((id, index) => (
            <Button
              key={id}
              className={selected === id ? 'active' : ''}
              onClick={() => setSelected(id)}
            >
              <span>0{index + 1}</span>
              <strong>{sectorData[id].name}</strong>
              <small>
                {
                  ship.systems.find(
                    (system) =>
                      system.id ===
                      (
                        {
                          bridge: 'navigation',
                          cryo: 'habitat',
                          reactor: 'reactor',
                          life: 'lifeSupport',
                        } as const
                      )[id],
                  )?.condition
                }
              </small>
            </Button>
          ))}
        </div>
        <div className="signal-strip">
          <span className="signal-label">
            {ship.events.at(-1)?.summary ?? 'Awaiting the first saved command'}
          </span>
          <div className="signal-wave">
            {Array.from({ length: 48 }).map((_, i) => (
              <i key={i} style={{ '--h': `${8 + ((i * 17) % 28)}px` } as React.CSSProperties} />
            ))}
          </div>
          <span>SAVED / {ship.gameVersion}</span>
        </div>
      </section>

      <aside className="decision-panel">
        <div className="panel-cut">
          <span className="eyebrow">{sectorData[selected].code} / DIAGNOSTIC</span>
          <div className="sector-title">
            <div>
              <strong>{sectorData[selected].name}</strong>
              <span className={diagnostic.severity === 'lost' ? 'critical' : ''}>
                {diagnostic.condition.toUpperCase()}
              </span>
            </div>
            <b>{diagnostic.integrity}%</b>
          </div>
          <p>
            {diagnostic.marks.length} lasting marks · {diagnostic.severity}. The digital twin
            reflects the saved Ark.
          </p>
        </div>
        <GameControls />
      </aside>
    </main>
  );
}

function Awakening({ setMode }: { setMode: (mode: Mode) => void }) {
  const { canonical, data, launch } = useGame();
  const [powered, setPowered] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setPowered(true), 900);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <main className={`awakening ${powered ? 'awakening--powered' : ''}`}>
      <div className="awakening-space">
        <ArkShip selected="bridge" navigation={canonical?.resources.navigation ?? 100} />
      </div>
      <div className="awakening-copy">
        <span className="eyebrow">PERSISTENT WORLD / CREATOR SURVIVAL PROTOCOL</span>
        <strong>
          THE STREAM ENDS.
          <br />
          <em>THE WORLD DOESN'T.</em>
        </strong>
        <p>
          One generation ship. 216 sleeping lives. Every audience decision leaves a physical
          scar—and every captain inherits what came before.
        </p>
        <div className="awakening-actions">
          <Button onClick={launch}>
            {data?.mode === 'live' && !data.me
              ? 'CONNECT CREATOR WITH TWITCH'
              : canonical
                ? 'ENTER MISSION CONTROL'
                : 'LAUNCH THE ARK'}{' '}
            <Icon name="chevron" />
          </Button>
          <Button onClick={() => setMode('simulator')}>TRY THE JUDGE SIMULATION</Button>
        </div>
      </div>
      <div className="awakening-metrics">
        <div>
          <span>VESSEL</span>
          <b>ARK—001</b>
          <small>GENERATION CLASS</small>
        </div>
        <div>
          <span>SOULS</span>
          <b>{canonical?.resources.passengers ?? 216}</b>
          <small>{canonical ? 'PASSENGERS ABOARD' : 'PASSENGER CAPACITY'}</small>
        </div>
        <div>
          <span>CURRENT CUSTODIAN</span>
          <b>{canonical?.host ?? data?.me?.label ?? 'AWAITING CAPTAIN'}</b>
          <small>{data?.mode === 'live' ? 'TWITCH WORLD' : 'SAVED PRACTICE'}</small>
        </div>
        <div className="critical">
          <span>ACTIVE CRISIS</span>
          <b>{canonical?.title ?? 'AWAITING DEPARTURE'}</b>
          <small>
            {canonical
              ? `NAVIGATION / ${canonical.resources.navigation}%`
              : 'UNLAUNCHED VISUALIZATION'}
          </small>
        </div>
      </div>
      <div className="awakening-scroll">
        <span /> EXPLORE THE COMMAND OS
      </div>
    </main>
  );
}

function Application() {
  const session = useGame();
  const {
    data,
    canonical,
    display,
    mode,
    setMode,
    readOnly,
    overlayView,
    visibleError,
    reconnect,
    reconnecting,
    preferences,
  } = session;
  const [selected, setSelected] = useState<Sector>('bridge');
  const [launcherOpen, setLauncherOpen] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle('obs-document', readOnly);
    return () => document.documentElement.classList.remove('obs-document');
  }, [readOnly]);
  if (readOnly) {
    if (
      overlayView === 'compact' ||
      (overlayView === 'auto' && (!canonical || canonical.phase === 'ready'))
    )
      return (
        <div className="obs-source">
          {canonical && visibleError && (
            <p className="obs-warning" role="status">
              {visibleError}
            </p>
          )}
          <Livewire overlay />
        </div>
      );
    return (
      <div className="obs-full">
        {canonical && visibleError && (
          <p className="obs-warning" role="status">
            {visibleError}
          </p>
        )}
        {canonical && display ? (
          <MissionControl
            navigation={display.navigation}
            selected={selected}
            setSelected={setSelected}
            world={display}
          />
        ) : (
          <div className="connection-panel">
            <Brand />
            <p role="status">{visibleError || 'Waiting for an active Ark'}</p>
          </div>
        )}
      </div>
    );
  }
  if (!data)
    return (
      <div className="app-shell connection-panel" aria-busy={!visibleError}>
        <Brand />
        <h1>TORCHLINE</h1>
        <p role={visibleError ? 'alert' : 'status'}>{visibleError || 'Connecting to your Ark…'}</p>
        {visibleError && (
          <Button onClick={() => void reconnect()} disabled={reconnecting}>
            Retry connection
          </Button>
        )}
      </div>
    );
  return (
    <div
      className="app-shell"
      data-design="figma-v2"
      data-motion={preferences.motion ? 'full' : 'reduced'}
    >
      <a className="skip-link" href="#game-content">
        Skip to game
      </a>
      {mode !== 'inheritance' && (
        <TopBar mode={mode} setMode={setMode} openLauncher={() => setLauncherOpen(true)} />
      )}
      {mode === 'inheritance' && (
        <Button
          className="inheritance-close"
          onClick={() => setMode('mission')}
          ariaLabel="Exit inheritance"
        >
          <Icon name="close" />
        </Button>
      )}
      {launcherOpen && (
        <CommandLauncher mode={mode} setMode={setMode} close={() => setLauncherOpen(false)} />
      )}
      {visibleError && (
        <div className="connection-banner" role="alert">
          {visibleError}
          <Button disabled={reconnecting} onClick={() => void reconnect()}>
            Retry connection
          </Button>
        </div>
      )}
      <div id="game-content" tabIndex={-1}>
        {mode === 'awakening' && <Awakening setMode={setMode} />}
        {mode === 'mission' &&
          (canonical && display ? (
            <MissionControl
              navigation={display.navigation}
              selected={selected}
              setSelected={setSelected}
              world={display}
            />
          ) : (
            <Awakening setMode={setMode} />
          ))}
        {mode === 'livewire' && <Livewire />}
        {mode === 'inheritance' && (
          <Inheritance setMode={setMode} navigation={display?.navigation ?? 100} />
        )}
        {mode === 'hangar' && <Hangar setMode={setMode} />}
        {mode === 'broadcast' && <BroadcastStudio />}
        {mode === 'archive' && <Archive />}
        {mode === 'codex' && <Codex />}
        {mode === 'simulator' && <Simulator setMode={setMode} />}
        {mode === 'settings' && <Settings />}
      </div>
      <div className="screen-vignette" />
      <div className="grain" />
    </div>
  );
}
export default function FinalFrontend() {
  return (
    <GameSession>
      <SoundEffects />
      <Application />
    </GameSession>
  );
}
