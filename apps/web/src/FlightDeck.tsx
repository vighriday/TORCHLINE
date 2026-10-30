import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Command, ResourceId, WorldPresentation } from '@torchline/contracts';
import { ArkView } from './ArkView.tsx';
import { ChallengeView } from './ChallengeView.tsx';
import { CooperationView, EpisodeSettings, PhaseClock } from './EpisodeView.tsx';
import {
  EncounterLayer,
  CrewUplink,
  SectorLocator,
  encounterObjectives,
} from './EncounterLayer.tsx';

const chapters = [
  'Awaiting launch',
  'A radiation storm is closing in. Save the passengers. Decide what the Ark can afford to lose.',
  'The next jump carries every consequence of your last decision. Find a safe path through the debris.',
  'Life support is failing. Find the faults together before the oxygen runs out.',
  'A colony needs supplies. Choose what you will risk, and what you will leave behind.',
  'This is what it was all for. Guide the Ark and everyone still aboard to the surface.',
];
const labels: Record<ResourceId, string> = {
  passengers: 'Passengers',
  hull: 'Hull',
  power: 'Power',
  oxygen: 'Oxygen',
  navigation: 'Navigation',
  supplies: 'Supplies',
};
function Vitals({ world }: { world: WorldPresentation }) {
  const latest = world.events.at(-1);
  return (
    <section className="resources game-vitals" aria-label="Ark resources">
      {(Object.keys(labels) as ResourceId[]).map((key) => {
        const cap = key === 'passengers' ? 216 : 100,
          value = world.resources[key];
        return (
          <div
            key={key}
            className={['hull', 'oxygen'].includes(key) && value <= 25 ? 'resource-critical' : ''}
          >
            <span>{labels[key]}</span>
            <div className="meter-track" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (value / cap) * 100)}%` }} />
            </div>
            <strong data-resource={key}>{value}</strong>
            {latest?.resourceDelta[key] !== undefined && (
              <small
                key={latest.id}
                className={`resource-delta ${latest.resourceDelta[key]! > 0 ? 'gain' : 'loss'}`}
              >
                {latest.resourceDelta[key]! > 0 ? '+' : ''}
                {latest.resourceDelta[key]}
              </small>
            )}
          </div>
        );
      })}
    </section>
  );
}
export function VoteBalance({ world }: { world: WorldPresentation }) {
  const total = Object.values(world.votes).reduce((a, b) => a + b, 0),
    a = world.votes[world.choices[0]?.id] ?? 0,
    b = world.votes[world.choices[1]?.id] ?? 0;
  return (
    <div
      className="vote-balance"
      aria-label={`Crew advice: ${a} votes for option one, ${b} for option two`}
    >
      <b>
        {total ? Math.round((a / total) * 100) : 0}
        <small>%</small>
      </b>
      <div>
        <span>
          {world.phase === 'awaiting-commit' ? 'CREW ADVICE LOCKED' : 'CHAT IS VOTING'} · {total}{' '}
          VOTES
        </span>
        <div className="vote-track">
          <i style={{ width: `${total ? (a / total) * 100 : 50}%` }} />
        </div>
      </div>
      <b>
        {total ? Math.round((b / total) * 100) : 0}
        <small>%</small>
      </b>
    </div>
  );
}
function Decisions({
  world,
  busy,
  onCommand,
  readonly,
}: {
  world: WorldPresentation;
  busy: boolean;
  onCommand: (c: Command) => void;
  readonly: boolean;
}) {
  return (
    <div className="game-decisions">
      <VoteBalance world={world} />
      <div className="game-choice-grid">
        {world.choices.map((choice, index) => (
          <article
            key={choice.id}
            className={`game-choice ${choice.preview?.outcome === 'wreck' ? 'lethal-choice' : ''}`}
          >
            <span className="choice-key" aria-hidden="true">
              {index + 1}
            </span>
            <div className="choice-body">
              <h3>{choice.label}</h3>
              <div className="effect-chips">
                {choice.preview &&
                  (Object.keys(labels) as ResourceId[])
                    .filter((key) => choice.preview!.resources[key] !== world.resources[key])
                    .map((key) => {
                      const delta = choice.preview!.resources[key] - world.resources[key];
                      return (
                        <span key={key} className={delta > 0 ? 'gain' : 'loss'}>
                          {labels[key]} {delta > 0 ? '+' : ''}
                          {delta}
                        </span>
                      );
                    })}
              </div>
              <p>{choice.description}</p>
              <small>
                !vote {index + 1} · {world.votes[choice.id] ?? 0} crew votes
              </small>
              {!choice.available && <p className="warning">{choice.unavailableReason}</p>}
              {readonly && choice.preview?.warnings[0] && (
                <p className="spectator-warning">{choice.preview.warnings[0]}</p>
              )}
              {choice.preview?.warnings.length ? (
                <details className="choice-warnings">
                  <summary>Consequence forecast · {choice.preview.warnings.length} alerts</summary>
                  {choice.preview.warnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                  <p>
                    {Object.entries(choice.preview.resources)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(' · ')}
                  </p>
                </details>
              ) : null}
              {!readonly && (
                <button
                  disabled={busy || !world.capabilities.canCommit || !choice.available}
                  onClick={() => onCommand({ type: 'commit', option: choice.id })}
                >
                  Commit {choice.label}
                  {choice.preview?.outcome === 'wreck' ? ' — wreck forecast' : ''}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
function useConsequence(world: WorldPresentation) {
  const previous = useRef(world.events.at(-1)?.id),
    [event, setEvent] = useState<WorldPresentation['events'][number] | null>(null);
  const latest = world.events.at(-1);
  useEffect(() => {
    if (!latest || latest.id === previous.current) return;
    previous.current = latest.id;
    if (!latest.cues.length) {
      setEvent(null);
      return;
    }
    setEvent(latest);
    const timer = setTimeout(() => setEvent(null), 3200);
    return () => clearTimeout(timer);
  }, [latest?.id]);
  return event;
}
export function FlightDeck({
  world,
  busy = false,
  onCommand = () => {},
  onPark,
  onArchive,
  onTiming,
  simulator,
  readonly = false,
  error = '',
}: {
  world: WorldPresentation;
  busy?: boolean;
  onCommand?: (c: Command) => void;
  onPark?: () => void;
  onArchive?: () => void;
  onTiming?: (
    d: Record<'investigation' | 'challenge' | 'allocation' | 'decision', number | null>,
  ) => void;
  simulator?: ReactNode;
  readonly?: boolean;
  error?: string;
}) {
  const [motionReduced] = useState(() => {
    try {
      return localStorage.getItem('torchline.motion') === 'reduced';
    } catch {
      return false;
    }
  });
  const event = useConsequence(world),
    deciding = ['decision', 'awaiting-commit'].includes(world.phase);
  const phaseCopy =
    world.phase === 'challenge'
      ? world.challenge?.kind === 'work-order'
        ? 'Scan the faults. Patch A and B, then C.'
        : 'Discover the relays. Connect S to T.'
      : world.phase === 'investigation'
        ? 'Choose a shared clue before the challenge.'
        : world.phase === 'allocation'
          ? 'Your preferences become real hull repairs and oxygen.'
          : deciding
            ? 'Chat advises. The captain chooses what survives.'
            : world.phase === 'paused'
              ? 'Episode paused. Every decision and scar is saved.'
              : 'The next chapter is yours.';
  return (
    <section
      className={`flight-deck ${readonly ? 'spectator-deck' : 'captain-deck'} ${motionReduced ? 'motion-reduced' : ''} phase-${world.phase} chapter-${world.chapter} ${world.outcome ? 'outcome-' + world.outcome : ''}`}
      aria-label={readonly ? 'Read-only broadcast' : 'Ark flight deck'}
      data-world={world.worldId}
    >
      <div className="flight-nebula" aria-hidden="true" />
      <EncounterLayer world={world} readonly={readonly} />
      <div className="flight-vessel">
        <ArkView
          key={`flight:${world.worldId}`}
          systems={world.systems}
          resources={world.resources}
          chapter={world.chapter}
          events={world.events}
          variant="flight"
          readOnly={readonly}
        />
        <SectorLocator chapter={world.chapter} />
      </div>
      <header className="flight-heading">
        <div className="chapter-pips" aria-label={`Chapter ${world.chapter} of five`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <i key={n} data-active={n <= world.chapter} />
          ))}
          <span>
            CHAPTER {String(world.chapter).padStart(2, '0')} / 05 ·{' '}
            {world.phase.replaceAll('-', ' ')}
          </span>
        </div>
        <h1>{world.title}</h1>
        <p>
          {world.chapter
            ? chapters[world.chapter]
            : 'A colony ship. An uncertain future. A community at the controls.'}
        </p>
      </header>
      <div className="flight-status">
        <aside className="flight-captain">
          <span className="captain-avatar" aria-hidden="true">
            {world.host.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <span>CAPTAIN</span>
            <strong>{world.host}</strong>
            <small>
              {world.participantCount} contributors ·{' '}
              {world.mode === 'simulation' ? 'SIMULATION' : 'TWITCH WORLD'}
            </small>
          </div>
        </aside>
        <div className="flight-clock">
          <PhaseClock world={world} compact />
        </div>
      </div>
      <Vitals world={world} />
      {world.outcome ? (
        <section className="game-ending" aria-live="polite">
          <span className="eyebrow">THE VOYAGE IS RECORDED</span>
          <h2>
            {world.outcome === 'colony'
              ? 'COLONY ESTABLISHED'
              : world.outcome === 'wreck'
                ? 'ARK LOST'
                : 'WE MADE IT. ALMOST.'}
          </h2>
          <p>{world.endingReason}</p>
          {!readonly && (
            <div className="buttons">
              <button onClick={onArchive}>Read the Ark’s history</button>
              <button disabled={busy} onClick={onPark}>
                Park / archive Ark
              </button>
            </div>
          )}
        </section>
      ) : (
        <>
          {!deciding && (
            <section className="flight-mission">
              <span className="eyebrow">
                {world.handoffPending
                  ? 'WORLD HANDOFF IN PROGRESS'
                  : world.challenge?.solved
                    ? 'CREW CHALLENGE COMPLETE'
                    : 'CREW OPERATIONS'}
              </span>
              <h2>{phaseCopy}</h2>
              {world.handoffPending ? (
                <p>The Ark is frozen until the receiver accepts or the offer ends.</p>
              ) : world.phase === 'ready' ? (
                <>
                  <p>
                    {world.livewire?.stake &&
                    ['open', 'paused', 'locked'].includes(world.livewire.stake.status)
                      ? 'Your LIVEWIRE mission is still active. Resolve or cancel it in LIVEWIRE before starting the next chapter.'
                      : 'Continue this voyage here, or pass its story to another community through Relay.'}
                  </p>
                  {!readonly && (
                    <button
                      className="primary-flight-action"
                      disabled={busy || !world.capabilities.canStart}
                      onClick={() => onCommand({ type: 'start' })}
                    >
                      Start chapter {world.chapter + 1}
                    </button>
                  )}
                  {!readonly && onTiming && (
                    <details className="episode-configuration">
                      <summary>Configure crew & pacing</summary>
                      <EpisodeSettings
                        key={`${world.worldId}:${world.chapter}`}
                        world={world}
                        busy={busy}
                        onCommand={onCommand}
                        onTiming={onTiming}
                      />
                    </details>
                  )}
                </>
              ) : world.phase === 'paused' ? (
                <>
                  <p>
                    {world.clock?.recoveryReason ??
                      'The captain will resume when the crew is ready.'}
                  </p>
                  {!readonly && (
                    <button
                      disabled={busy || !world.capabilities.canResume}
                      onClick={() => onCommand({ type: 'resume' })}
                    >
                      Resume
                    </button>
                  )}
                </>
              ) : world.phase === 'investigation' || world.phase === 'allocation' ? (
                <>
                  <CooperationView world={world} compact={readonly} />
                  {!readonly && (
                    <div className="direct-crew-inputs">
                      {world.phase === 'investigation' ? (
                        (['engine', 'cargo', 'life'] as const).map((area) => (
                          <button
                            disabled={busy}
                            key={area}
                            onClick={() => onCommand({ type: 'inspect', area })}
                          >
                            Investigate {area}
                          </button>
                        ))
                      ) : (
                        <>
                          <button
                            disabled={busy}
                            onClick={() => onCommand({ type: 'allocate', hull: 5, oxygen: 0 })}
                          >
                            Prefer hull repairs
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => onCommand({ type: 'allocate', hull: 0, oxygen: 5 })}
                          >
                            Prefer oxygen recovery
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : null}
              {world.phase === 'challenge' && world.challenge && (
                <ChallengeView
                  challenge={world.challenge}
                  interactive={!readonly && !world.handoffPending}
                  onCommand={onCommand}
                  busy={busy}
                  compact={readonly}
                  hud
                  displayTitle={encounterObjectives[world.chapter]}
                />
              )}
            </section>
          )}
          {deciding && (
            <div className="flight-decision-zone">
              <Decisions world={world} busy={busy} onCommand={onCommand} readonly={readonly} />
            </div>
          )}
        </>
      )}
      {event && !event.cues.some((c) => c.kind === 'chapter-arrived') && (
        <div
          className={`cinematic-consequence cue-${event.cues.at(-1)?.kind}`}
          key={event.id}
          aria-live="polite"
        >
          <span>
            {event.cues.some((c) => c.kind === 'chapter-arrived')
              ? 'ENTERING NEW SECTOR'
              : event.cues.some((c) => c.kind === 'sacrifice')
                ? 'SACRIFICE RECORDED'
                : event.cues.some((c) => c.kind === 'challenge-solved')
                  ? 'CREW SOLUTION CONFIRMED'
                  : event.cues.some((c) => c.kind === 'repair')
                    ? 'REPAIRS CONFIRMED'
                    : 'ARK STATUS CHANGED'}
          </span>
          <p>{event.summary}</p>
        </div>
      )}
      <footer className="flight-footer">
        {readonly ? (
          <div className="flight-guidance">
            <span>
              {world.phase === 'challenge'
                ? world.chapter === 3
                  ? '!scan A · !patch A'
                  : '!scan A · !route <path>'
                : world.phase === 'investigation'
                  ? '!inspect engine · !inspect cargo · !inspect life'
                  : world.phase === 'allocation'
                    ? '!allocate 3 2 · HULL / OXYGEN'
                    : world.phase === 'decision'
                      ? '!vote 1 · !vote 2'
                      : '!status · !history'}
            </span>
            <p>{world.recap}</p>
          </div>
        ) : (
          <CrewUplink world={world} />
        )}
        {!readonly && (
          <div className="flight-actions">
            {world.capabilities.canCloseChallenge && (
              <button disabled={busy} onClick={() => onCommand({ type: 'close-challenge' })}>
                {world.cooperation?.budget ? 'Open crew allocation' : 'Open final decision'}
              </button>
            )}
            {world.capabilities.canCloseInvestigation && (
              <button disabled={busy} onClick={() => onCommand({ type: 'close-investigation' })}>
                Open cooperative challenge
              </button>
            )}
            {world.capabilities.canCloseAllocation && (
              <button disabled={busy} onClick={() => onCommand({ type: 'close-allocation' })}>
                Lock repairs & open decision
              </button>
            )}
            {world.capabilities.canCloseVoting && (
              <button disabled={busy} onClick={() => onCommand({ type: 'close-voting' })}>
                Freeze advisory votes
              </button>
            )}
            {world.capabilities.canPause && (
              <button disabled={busy} onClick={() => onCommand({ type: 'pause' })}>
                Pause
              </button>
            )}
            {!world.outcome && (
              <button className="quiet" disabled={busy || world.handoffPending} onClick={onPark}>
                Park / archive Ark
              </button>
            )}
          </div>
        )}
      </footer>
      {!readonly && simulator && (
        <details key={world.phase} className="simulation-console">
          <summary>Simulation chat</summary>
          {simulator}
        </details>
      )}
      {error && (
        <div role="alert" className="flight-error">
          {error}
        </div>
      )}
    </section>
  );
}
