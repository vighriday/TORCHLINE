import { useEffect, useRef, useState } from 'react';
import type {
  ResourceId,
  Resources,
  WorldPresentation,
  RecordedWorldEvent,
} from '@torchline/contracts';
import { ArkView } from './ArkView.tsx';
import { ChallengeView } from './ChallengeView.tsx';
import { useWorldHistory } from './useWorldHistory.ts';
import { CooperationView, PhaseClock } from './EpisodeView.tsx';
export type Workspace = 'bridge' | 'relay' | 'hangar' | 'broadcast' | 'archive';
const destinations: { id: Workspace; label: string; detail: string }[] = [
  { id: 'bridge', label: 'Bridge', detail: 'Play & cooperate' },
  { id: 'relay', label: 'Relay', detail: 'Pass the torch' },
  { id: 'hangar', label: 'Hangar', detail: 'Your worlds' },
  { id: 'broadcast', label: 'Broadcast', detail: 'Twitch & OBS' },
  { id: 'archive', label: 'Archive', detail: 'Scars & consequences' },
];
export function DeckNav({
  active,
  onChange,
}: {
  active: Workspace;
  onChange: (id: Workspace) => void;
}) {
  return (
    <nav className="deck-nav" aria-label="Command deck">
      <div className="nav-emblem" aria-hidden="true">
        T<span>01 / ARK PROTOCOL</span>
      </div>
      {destinations.map((item, index) => (
        <button
          key={item.id}
          aria-current={active === item.id ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          <span className="nav-number">0{index + 1}</span>
          <span>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </span>
        </button>
      ))}
      <p className="nav-foot">
        THE STREAM ENDS.
        <br />
        <strong>THE WORLD DOESN’T.</strong>
      </p>
    </nav>
  );
}
export function ResourceMeters({ world }: { world: WorldPresentation }) {
  const limits: Record<ResourceId, number> = {
    passengers: 180,
    hull: 100,
    power: 100,
    oxygen: 100,
    navigation: 100,
    supplies: 100,
  };
  return (
    <section className="resources" aria-label="Ark resources">
      {(['passengers', 'hull', 'power', 'oxygen', 'navigation', 'supplies'] as ResourceId[]).map(
        (key) => (
          <div
            key={key}
            className={
              ['hull', 'oxygen'].includes(key) && world.resources[key] <= 25
                ? 'resource-critical'
                : ''
            }
          >
            <span>{key}</span>
            <strong>
              <b data-resource={key}>{world.resources[key]}</b>
              <small>{key === 'passengers' ? ' souls' : key === 'supplies' ? ' units' : '%'}</small>
            </strong>
            <div className="meter-track" aria-hidden="true">
              <i
                style={{ width: `${Math.min(100, (world.resources[key] / limits[key]) * 100)}%` }}
              />
            </div>
            <small>
              {key === 'passengers'
                ? 'Colony goal ≥ 120'
                : key === 'supplies'
                  ? 'Colony goal ≥ 30'
                  : key === 'navigation'
                    ? 'Safer entry ≥ 40'
                    : key === 'oxygen' || key === 'hull'
                      ? 'Zero ends the voyage'
                      : 'Power reserve'}
            </small>
          </div>
        ),
      )}
    </section>
  );
}
export function ParticipationGuide({
  world,
  broadcast = false,
}: {
  world: WorldPresentation;
  broadcast?: boolean;
}) {
  return (
    <aside className="participation-guide" aria-label="How to participate">
      <span className="eyebrow">YOUR CHAT. YOUR SHIP.</span>
      <h3>
        {world.handoffPending
          ? 'The torch is in transit'
          : world.outcome
            ? 'This voyage has ended'
            : world.phase === 'challenge'
              ? 'Discover. Connect. Repair.'
              : world.phase === 'investigation'
                ? 'Discover a shared clue.'
                : world.phase === 'allocation'
                  ? 'Choose where repairs matter.'
                  : world.phase === 'awaiting-commit'
                    ? 'Advice is locked. Captain decides.'
                    : world.phase === 'decision'
                      ? 'Choose what survives.'
                      : 'The next chapter is yours.'}
      </h3>
      <p>
        {world.handoffPending
          ? 'The ship is frozen while the communities complete the handoff.'
          : world.outcome
            ? 'Every permanent mark remains in the Ark’s record.'
            : world.phase === 'challenge'
              ? 'Share clues in Twitch chat. Solving the challenge changes resources, ship systems and the choices ahead.'
              : world.phase === 'investigation'
                ? 'Prioritize an area to reveal a real puzzle clue for everyone.'
                : world.phase === 'allocation'
                  ? 'Distribute the captain’s fixed reserve. Your latest preference affects real repairs and oxygen.'
                  : world.phase === 'awaiting-commit'
                    ? 'Voting is closed. The captain will commit a choice with the locked crew plan.'
                    : world.phase === 'decision'
                      ? 'Chat advises; the captain commits. Read the forecast before making a sacrifice.'
                      : world.phase === 'paused'
                        ? 'The captain has paused the episode. Your progress is safe.'
                        : 'The captain can start the next chapter. Keep playing here or prepare a handoff at this boundary.'}
      </p>
      <div className="command-strip">
        <code>
          {world.phase === 'challenge'
            ? world.challenge?.kind === 'work-order'
              ? '!scan A · !patch A'
              : '!scan A · !route <path>'
            : world.phase === 'investigation'
              ? '!inspect engine · !inspect life · !inspect cargo'
              : world.phase === 'allocation'
                ? '!allocate 3 2 (hull / oxygen)'
                : world.phase === 'decision'
                  ? '!vote 1 · !vote 2'
                  : '!status · !history'}
        </code>
      </div>
      <small>
        {world.mode === 'simulation'
          ? broadcast
            ? 'Simulation broadcast. The captain sends inputs from the dashboard.'
            : 'Simulation inputs below rehearse the same rules.'
          : 'Use the broadcaster’s ordinary Twitch chat, including on mobile.'}{' '}
        No raid required to play.
      </small>
    </aside>
  );
}
export function ChoiceForecast({
  resources,
  current,
}: {
  resources: Resources;
  current: Resources;
}) {
  return (
    <div className="choice-forecast">
      <span className="eyebrow">FORECAST AFTER COMMIT</span>
      <ul>
        {Object.entries(resources).map(([key, value]) => {
          const delta = value - current[key as ResourceId];
          return (
            <li key={key}>
              <span>{key}</span>
              <strong>{value}</strong>
              <small>{delta === 0 ? 'unchanged' : `${delta > 0 ? '+' : ''}${delta}`}</small>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
export function ConsequenceSignal({ world }: { world: WorldPresentation }) {
  const latest = world.events.at(-1);
  const seen = useRef(latest?.id);
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    if (latest?.id !== seen.current) {
      setAnimate(true);
      seen.current = latest?.id;
    }
  }, [latest?.id]);
  if (!latest) return null;
  return (
    <aside
      key={latest.id}
      className={`consequence-signal ${animate ? 'new-consequence' : ''}`}
      aria-label="Latest consequence"
    >
      <span className="eyebrow">SHIP LOG / CHAPTER {latest.chapter}</span>
      <p>{latest.summary}</p>
      {Object.keys(latest.resourceDelta).length > 0 && (
        <small>
          {Object.entries(latest.resourceDelta)
            .map(([key, n]) => `${key} ${n! > 0 ? '+' : ''}${n}`)
            .join(' · ')}
        </small>
      )}
    </aside>
  );
}
export function WorldArchive({ world }: { world: WorldPresentation }) {
  const { record, error, loading, load } = useWorldHistory(world.worldId);
  const events: (WorldPresentation['events'][number] &
    Partial<Pick<RecordedWorldEvent, 'at' | 'community'>>)[] =
    record?.events ?? world.events.slice().reverse();
  return (
    <section className="archive-view">
      <div className="workspace-title">
        <span className="eyebrow">THE COST OF GETTING HERE</span>
        <h2>World lineage</h2>
        <p>Every repair has a past. Every sacrifice leaves a trace.</p>
      </div>
      <ArkView key={world.worldId} systems={world.systems} resources={world.resources} />
      <section className="panel">
        <h3>Unfinished consequences</h3>
        <div className="obligations">
          {world.obligations.length === 0 ? (
            <p>No inherited obligations recorded.</p>
          ) : (
            world.obligations.map((item) => (
              <article key={item.id}>
                <span className="badge">{item.status}</span>
                <h4>{item.kind.replaceAll('-', ' ')}</h4>
                <p>Due chapter {item.dueChapter}</p>
                <small>Origin: {item.originEventId}</small>
              </article>
            ))
          )}
        </div>
      </section>
      <section className="panel">
        <h3>Communities that carried this Ark</h3>
        {record?.custody.length ? (
          <ol className="history">
            {record.custody.map((step) => (
              <li key={step.id}>
                <span className="event-chapter">{step.mode === 'simulation' ? 'SIM' : 'LIVE'}</span>
                <div>
                  <strong>
                    {step.source.label} → {step.target.label}
                  </strong>
                  <small>
                    <time dateTime={step.at}>{new Date(step.at).toLocaleString()}</time>
                  </small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p>{loading ? 'Loading custody record…' : 'No completed custody transfers recorded.'}</p>
        )}
        {record?.nextCustodyCursor && (
          <button disabled={loading} onClick={() => void load('custody')}>
            Load earlier communities
          </button>
        )}
      </section>
      <section className="panel">
        <h3>Ship log</h3>
        <p className="muted">
          {record
            ? 'The saved record across every chapter. Votes are summarized in decisions; individual ballots stay private.'
            : 'Loading the complete saved record…'}{' '}
          Open a system above to explore permanent damage and repairs.
        </p>
        {error && <p role="status">{error}</p>}
        {record && world.gameVersion > record.throughSequence && (
          <p>
            New chapter activity is available.{' '}
            <button disabled={loading} onClick={() => void load('refresh')}>
              Refresh ship log
            </button>
          </p>
        )}
        <ol className="history">
          {events.map((event) => (
            <li key={event.id} id={`event-${event.id}`}>
              <span className="event-chapter">CH {String(event.chapter).padStart(2, '0')}</span>
              <div>
                <strong>{event.summary}</strong>
                {event.at && event.community && (
                  <small>
                    <time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time> ·{' '}
                    {event.community.label}
                  </small>
                )}
                <small>
                  {Object.entries(event.resourceDelta)
                    .map(([key, n]) => `${key} ${n! > 0 ? '+' : ''}${n}`)
                    .join(' · ') || 'World state recorded'}
                </small>
                {event.causes.length > 0 && (
                  <small>
                    Inherited cause:{' '}
                    {event.causes.map((cause) => {
                      const origin = events.find((item) => item.id === cause);
                      return origin ? (
                        <a key={cause} href={`#event-${cause}`}>
                          {origin.summary}{' '}
                        </a>
                      ) : (
                        <span key={cause}>Earlier chapter record </span>
                      );
                    })}
                  </small>
                )}
                <small className="event-id">Event {event.id}</small>
              </div>
            </li>
          ))}
        </ol>
        {record?.nextCursor !== null && record && (
          <button disabled={loading} onClick={() => void load('events')}>
            Load earlier events
          </button>
        )}
        {error && (
          <button disabled={loading} onClick={() => void load('refresh')}>
            Retry history
          </button>
        )}
      </section>
    </section>
  );
}
export function RelayProgress({ status, mode }: { status: string; mode: string }) {
  const current =
    status === 'committed' ? 3 : status === 'verified' ? 2 : status === 'prepared' ? 1 : 0;
  return (
    <ol className="relay-progress" aria-label="World handoff progress">
      {[
        'Prepared',
        mode === 'simulation' ? 'Simulated evidence' : 'Native raid evidence',
        'Receiver acceptance',
      ].map((label, index) => (
        <li key={label} data-complete={current > index}>
          <span>{current > index ? '✓' : `0${index + 1}`}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
export function BroadcastOverlay({
  world,
  error,
  mode,
}: {
  world: WorldPresentation | null | undefined;
  error: string;
  mode?: string;
}) {
  return (
    <main className="broadcast-overlay">
      <header>
        <div>
          <span className="eyebrow">TORCHLINE / THE ARK PROTOCOL</span>
          <h1>{world?.title ?? 'Awaiting the Ark'}</h1>
        </div>
        {world && <PhaseClock world={world} compact />}
        <div className="overlay-host">
          {world?.host ?? 'READ-ONLY BROADCAST'}
          <span className="badge">
            {mode === 'live'
              ? 'LIVE WORLD · VERIFICATION PENDING'
              : 'SIMULATION · NOT TWITCH FOOTAGE'}
          </span>
          {error && (
            <span role="status" className="overlay-connection">
              {error}
            </span>
          )}
        </div>
      </header>
      {world ? (
        <>
          <ResourceMeters world={world} />
          <div className="overlay-scene">
            <ArkView
              key={world.worldId}
              systems={world.systems}
              resources={world.resources}
              readOnly
            />
            <section className="overlay-context">
              <CooperationView world={world} compact />
              <span className="eyebrow">
                CHAPTER {world.chapter}/5 · {world.phase} · {world.participantCount} CONTRIBUTORS
              </span>
              <p className="overlay-recap">{world.recap}</p>
              {world.challenge && world.phase === 'challenge' && (
                <ChallengeView
                  challenge={world.challenge}
                  interactive={false}
                  onCommand={() => {}}
                  busy={false}
                  compact
                />
              )}
              {['decision', 'awaiting-commit'].includes(world.phase) && (
                <div className="overlay-choices">
                  {world.choices.map((choice, i) => (
                    <article key={choice.id}>
                      <strong>
                        {i + 1}. {choice.label}
                      </strong>
                      <span>{world.votes[choice.id] ?? 0} votes</span>
                      <p>{choice.description}</p>
                      {!choice.available && <small>{choice.unavailableReason}</small>}
                    </article>
                  ))}
                </div>
              )}
              {world.outcome && (
                <div className="ending">
                  <h2>
                    {world.outcome === 'colony'
                      ? 'Colony established'
                      : world.outcome === 'wreck'
                        ? 'Ark lost'
                        : 'Partial survival'}
                  </h2>
                  <p>{world.endingReason}</p>
                </div>
              )}
            </section>
          </div>
          <div className="overlay-bottom">
            <ParticipationGuide world={world} broadcast />
            <ConsequenceSignal key={world.worldId} world={world} />
          </div>
        </>
      ) : (
        <section className="panel overlay-waiting">
          <h2>No active Ark</h2>
          <p>
            The captain can create, resume or accept a world. This read-only source follows the
            channel automatically.
          </p>
        </section>
      )}
      <footer>
        THE STREAM ENDS. THE WORLD DOESN’T. <span>Read-only broadcast · progress persists</span>
      </footer>
    </main>
  );
}
