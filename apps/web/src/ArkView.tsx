import { useEffect, useId, useRef, useState } from 'react';
import type { Resources, ShipSystem, SystemId, WorldPresentation } from '@torchline/contracts';
import { conditionColor, markSeed, shipDescription, systemLabels } from './visual-state.ts';
export interface ArkRendererProps {
  systems: ShipSystem[];
  resources: Resources;
  reducedMotion?: boolean;
  readOnly?: boolean;
  variant?: 'panel' | 'flight' | 'title';
  chapter?: number;
  events?: WorldPresentation['events'];
}
const anchors: Record<SystemId, [number, number]> = {
  hull: [550, 255],
  reactor: [200, 255],
  habitat: [620, 255],
  lifeSupport: [395, 195],
  cargo: [790, 300],
  navigation: [985, 245],
  shields: [560, 255],
};
function Schematic({ systems, resources }: ArkRendererProps) {
  const id = useId().replaceAll(':', '');
  return (
    <svg
      className="ark-schematic"
      viewBox="0 0 1200 500"
      role="img"
      aria-label={shipDescription(systems, resources)}
    >
      <defs>
        <linearGradient id={`${id}-metal`} x2="0" y2="1">
          <stop stopColor="#66727b" />
          <stop offset=".46" stopColor="#27323d" />
          <stop offset="1" stopColor="#131c25" />
        </linearGradient>
        <radialGradient id={`${id}-engine`}>
          <stop stopColor="#fff0bd" />
          <stop offset=".3" stopColor="#ff8a2a" />
          <stop offset="1" stopColor="#ff8a2a" stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}-grid`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#8fdce4" strokeOpacity=".05" />
        </pattern>
      </defs>
      <rect width="1200" height="500" fill={`url(#${id}-grid)`} />
      <ellipse
        cx="580"
        cy="260"
        rx="490"
        ry="150"
        fill="none"
        stroke="#8fdce4"
        strokeOpacity=".12"
        strokeDasharray="3 12"
      />
      <path d="M55 255H1120M600 35V465" stroke="#8fdce4" strokeOpacity=".09" />
      <ellipse cx="150" cy="255" rx="130" ry="58" fill={`url(#${id}-engine)`} />
      {systems.map((system) => {
        const [x, y] = anchors[system.id];
        const lost = system.condition === 'destroyed';
        return (
          <g
            key={system.id}
            className={`ship-module condition-${system.condition}`}
            style={{ color: conditionColor(system) }}
          >
            <g
              stroke="currentColor"
              strokeWidth="2"
              fill={`url(#${id}-metal)`}
              opacity={lost ? 0.5 : 1}
            >
              {system.id === 'hull' && (
                <>
                  <path d="M235 225 880 225 965 255 880 286 235 286Z" />
                  <path
                    d="M280 227V283M340 227V283M460 227V283M520 227V283M710 227V283M850 227V283"
                    opacity=".4"
                  />
                </>
              )}
              {system.id === 'reactor' && (
                <>
                  <circle cx={x} cy={y} r="55" />
                  <circle cx={x} cy={y} r="35" />
                  <path d="M158 225 134 240V270L158 285" />
                  <circle cx={x} cy={y} r="20" fill="#ff8a2a" fillOpacity=".5" />
                </>
              )}
              {system.id === 'habitat' && (
                <>
                  <ellipse cx={x} cy={y} rx="45" ry="135" strokeWidth="16" />
                  <path d="m620 122 0 266M579 255H663" />
                  <ellipse
                    cx={x}
                    cy={y}
                    rx="46"
                    ry="135"
                    fill="none"
                    stroke="#8fdce4"
                    strokeWidth="3"
                    strokeDasharray="2 9"
                    opacity={resources.passengers > 0 ? 0.9 : 0.1}
                  />
                </>
              )}
              {system.id === 'lifeSupport' &&
                [0, 1, 2].map((i) => (
                  <g key={i}>
                    <rect x={x - 50 + i * 36} y={y - 25} width="28" height="80" rx="14" />
                    <path
                      d={`M${x - 50 + i * 36} ${y}h28M${x - 50 + i * 36} ${y + 25}h28`}
                      opacity=".5"
                    />
                  </g>
                ))}
              {system.id === 'cargo' &&
                [0, 1, 2].map((i) => (
                  <g key={i}>
                    <path
                      d={`m${x - 60 + i * 48} ${y - 5}v50h42v-50Z`}
                      fill={lost ? 'none' : '#776045'}
                      strokeDasharray={lost ? '4 5' : undefined}
                    />
                    <path d={`m${x - 53 + i * 48} ${y + 2} 27 36m-27 0 27-36`} opacity=".4" />
                  </g>
                ))}
              {system.id === 'navigation' && (
                <g transform={lost ? `rotate(35 ${x} ${y})` : undefined}>
                  <path
                    d={`M${x - 20} ${y}v-70l36-20M${x - 32} ${y - 98}q55 28 70-15q-40 7-70 15Z`}
                  />
                  <circle cx={x + 12} cy={y - 90} r="4" fill="currentColor" />
                </g>
              )}
              {system.id === 'shields' && (
                <ellipse
                  cx={x}
                  cy={y}
                  rx="475"
                  ry="158"
                  fill="#8fdce4"
                  fillOpacity={lost ? 0 : 0.018}
                  strokeDasharray={lost ? '3 20' : '45 9'}
                  opacity={lost ? 0.15 : 0.4}
                />
              )}
            </g>
            {system.marks.slice(-8).map((mark, i) => {
              const dx = (markSeed(mark.eventId) - 0.5) * 65,
                dy = (markSeed(mark.eventId + 'y') - 0.5) * 45;
              return (
                <path
                  key={`${mark.eventId}-${i}`}
                  d={`m${x + dx - 10} ${y + dy - 15} 15 10-13 12 17 13`}
                  fill="none"
                  stroke={mark.kind === 'repair' ? '#8fdce4' : '#f57865'}
                  strokeWidth={mark.kind === 'repair' ? 4 : 2}
                  strokeDasharray={mark.kind === 'seal' ? '3 4' : undefined}
                />
              );
            })}
          </g>
        );
      })}
      <text x="40" y="42" className="schematic-label">
        ARK / SYSTEM TOPOLOGY
      </text>
      <text x="40" y="465" className="schematic-label">
        PHYSICAL RECORD PERSISTS ACROSS CUSTODY
      </text>
    </svg>
  );
}
export function ArkView({
  systems,
  resources,
  reducedMotion = false,
  readOnly = false,
  variant = 'panel',
  chapter = 0,
  events = [],
}: ArkRendererProps) {
  const [cinematic, setCinematic] = useState(() => {
    try {
      return localStorage.getItem('torchline.visual') !== 'schematic';
    } catch {
      return true;
    }
  });
  const [eligible, setEligible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [focusedSystem, setFocusedSystem] = useState<SystemId | null>(null);
  const mount = useRef<HTMLDivElement>(null);
  const controller = useRef<Awaited<
    ReturnType<(typeof import('./ark-scene.ts'))['createArkScene']>
  > | null>(null);
  const current = useRef({ systems, resources, chapter, events });
  current.current = { systems, resources, chapter, events };
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce), (max-width: 700px)');
    const update = () => {
      let savedReduction = false;
      try {
        savedReduction = localStorage.getItem('torchline.motion') === 'reduced';
      } catch {
        /* Optional local preference. */
      }
      setEligible(!query.matches && !reducedMotion && !savedReduction);
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [reducedMotion]);
  useEffect(() => {
    if (!cinematic || !eligible || failed || !mount.current) return;
    let cancelled = false;
    const element = mount.current;
    void import('./ark-scene.ts')
      .then(({ createArkScene }) => {
        if (cancelled) return;
        const scene = createArkScene(
          element,
          () => setFailed(true),
          () => {
            if (!cancelled) setReady(true);
          },
          variant,
          variant === 'flight'
            ? (points) => {
                const stage = element.parentElement;
                if (!stage) return;
                for (const marker of stage.querySelectorAll<HTMLElement>('[data-anchor]')) {
                  const p = points[marker.dataset.anchor!];
                  marker.hidden = !p?.visible;
                  if (p) {
                    marker.style.left = `${p.x}%`;
                    marker.style.top = `${p.y}%`;
                  }
                }
              }
            : undefined,
        );
        controller.current = scene;
        scene.update(
          current.current.systems,
          current.current.resources,
          current.current.chapter,
          current.current.events,
        );
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      controller.current?.dispose();
      controller.current = null;
      setReady(false);
    };
  }, [cinematic, eligible, failed, variant]);
  useEffect(() => {
    controller.current?.update(systems, resources, chapter, events);
  }, [systems, resources, chapter, events]);
  const focused = systems.find((s) => s.id === focusedSystem);
  useEffect(() => {
    controller.current?.focus(focusedSystem);
  }, [focusedSystem, ready]);
  return (
    <section className={`panel ark-panel ark-${variant}`} aria-label="Persistent Ark condition">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE ARK PROTOCOL</span>
          <h2>One ship. Every scar remembered.</h2>
        </div>
        {!readOnly && (
          <button
            className="quiet"
            aria-pressed={cinematic}
            onClick={() => {
              const next = !cinematic;
              setCinematic(next);
              try {
                localStorage.setItem('torchline.visual', next ? 'cinematic' : 'schematic');
              } catch {
                /* Optional local preference. */
              }
            }}
          >
            {cinematic ? 'Use schematic view' : 'Use cinematic view'}
          </button>
        )}
      </div>
      <div className={`ark-stage ${ready ? 'scene-ready' : ''}`}>
        <Schematic systems={systems} resources={resources} />
        <div ref={mount} className="ark-canvas" aria-hidden="true" />
        {variant === 'flight' &&
          ready &&
          systems
            .filter((s) => ['lifeSupport', 'navigation', 'cargo', 'shields'].includes(s.id))
            .map((system) =>
              readOnly ? (
                <span
                  key={system.id}
                  className={`ship-anchor condition-${system.condition}`}
                  data-anchor={system.id}
                >
                  <i aria-hidden="true" />
                  {systemLabels[system.id]} <b>{system.integrity}%</b>
                </span>
              ) : (
                <button
                  key={system.id}
                  className={`ship-anchor condition-${system.condition}`}
                  data-anchor={system.id}
                  aria-label={`Inspect ${systemLabels[system.id]}`}
                  aria-pressed={focusedSystem === system.id}
                  onClick={() => {
                    const next = focusedSystem === system.id ? null : system.id;
                    setFocusedSystem(next);
                    controller.current?.focus(next);
                  }}
                >
                  <i aria-hidden="true" />
                  {systemLabels[system.id]} <b>{system.integrity}%</b>
                </button>
              ),
            )}
        <div className="ark-telemetry" aria-hidden="true">
          <span>ARK / PERSISTENT VESSEL</span>
          <span>{ready ? 'CINEMATIC TELEMETRY' : 'SYSTEM SCHEMATIC'}</span>
        </div>
      </div>
      {variant === 'flight' && !readOnly && focused && (
        <aside className="ship-focus-card" aria-label="Selected ship system">
          <div>
            <span className="eyebrow">LIVE SYSTEM TELEMETRY</span>
            <button
              aria-label="Close ship inspection"
              onClick={() => {
                setFocusedSystem(null);
                controller.current?.focus(null);
              }}
            >
              ×
            </button>
          </div>
          <h3>
            {systemLabels[focused.id]} <strong>{focused.integrity}%</strong>
          </h3>
          <p>
            {focused.condition} · {focused.marks.length} permanent changes
          </p>
          <p>
            {focused.marks.length
              ? `${focused.marks.at(-1)!.kind} recorded in chapter ${focused.marks.at(-1)!.chapter}.`
              : 'No permanent modifications recorded.'}
          </p>
          <small>This condition travels with the Ark.</small>
        </aside>
      )}
      <details className="system-inspector" open={variant === 'panel'}>
        <summary>
          Ship condition · {systems.reduce((sum, s) => sum + s.marks.length, 0)} permanent marks
        </summary>
        <div className="system-list" aria-label="Ship system conditions">
          {systems.map((system) => (
            <details
              key={system.id}
              className={`system-state condition-${system.condition}`}
              data-system={system.id}
              data-condition={system.condition}
            >
              <summary>
                <strong>{systemLabels[system.id]}</strong>
                <span>
                  {system.condition} · {system.integrity}%
                </span>
                <small>
                  {system.marks.length} recorded {system.marks.length === 1 ? 'change' : 'changes'}
                </small>
              </summary>
              <ul>
                {system.marks.length === 0 ? (
                  <li>No recorded changes.</li>
                ) : (
                  system.marks.map((mark, i) => (
                    <li key={`${mark.eventId}-${i}`}>
                      Chapter {mark.chapter} · {mark.kind} · {mark.community}
                    </li>
                  ))
                )}
              </ul>
            </details>
          ))}
        </div>
      </details>
      {!readOnly && (
        <p className={`muted renderer-note ${failed ? 'renderer-failed' : ''}`}>
          Repairs restore function; the physical record remains.{' '}
          {failed
            ? 'Cinematic graphics unavailable; schematic active.'
            : !eligible
              ? 'Schematic active for small screens or reduced motion.'
              : 'Visual preferences never change the world.'}
        </p>
      )}
    </section>
  );
}
