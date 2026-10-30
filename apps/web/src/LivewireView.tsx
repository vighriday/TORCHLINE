import { useEffect, useState } from 'react';
import type { LivewireRequest, LivewireTarget, WorldPresentation } from '@torchline/contracts';
import { ArkView } from './ArkView.tsx';

const targets = ['navigation', 'hull', 'oxygen'] as const;
const names = { navigation: 'Navigation', hull: 'Hull', oxygen: 'Life support' };
function Deadline({ at }: { at: string | null | undefined }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span>
      {at
        ? `${Math.max(0, Math.ceil((Date.parse(at) - now) / 1000))}s remaining`
        : 'Captain resumes after recovery'}
    </span>
  );
}
function Selection({ world }: { world: WorldPresentation }) {
  const mission = world.livewire!,
    stake = mission.stake;
  return (
    <div className="lw-options" aria-label="Mission system choices">
      {targets.map((target, i) => {
        const option = stake?.options.find((o) => o.target === target);
        return (
          <div
            className="lw-option"
            key={target}
            data-selected={stake?.target === target}
            data-unavailable={!!stake && !option}
          >
            <div>
              <strong>{names[target]}</strong>
              <span data-livewire-resource={target}>{world.resources[target]}%</span>
            </div>
            <div className="lw-track" aria-hidden="true">
              <i style={{ width: `${world.resources[target]}%` }} />
            </div>
            {option && (
              <small>
                Success +{option.success} · Failure {option.failure}
              </small>
            )}
            {stake?.status === 'open' ? (
              <>
                <code>!stake {i + 1}</code>
                <span className="lw-count" data-ballots={target}>
                  {mission.tallies[i]} votes
                </span>
              </>
            ) : stake?.target === target ? (
              <b>Committed before attempt</b>
            ) : !option && stake ? (
              <small>Unavailable · lost or sealed</small>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
export function LivewireView({
  world,
  busy,
  onAction,
  onSimulate,
}: {
  world: WorldPresentation;
  busy: boolean;
  onAction: (action: LivewireRequest['action']) => void;
  onSimulate?: (text: string, actor: string) => void;
}) {
  const [game, setGame] = useState('');
  const [label, setLabel] = useState('');
  const [preset, setPreset] = useState<'boss' | 'match' | 'challenge'>('boss');
  const [solo, setSolo] = useState<LivewireTarget>('hull');
  const [input, setInput] = useState('!stake 2');
  const [actor, setActor] = useState('crew-one');
  const mission = world.livewire,
    stake = mission?.stake;
  const unresolved = stake && ['open', 'paused', 'locked'].includes(stake.status);
  const open = stake?.status === 'open',
    locked = stake?.status === 'locked';
  return (
    <section className="lw-workspace" aria-labelledby="lw-title">
      <header className="lw-heading">
        <span className="eyebrow">TORCHLINE // LIVEWIRE</span>
        <h2 id="lw-title">Your game. The Ark’s consequence.</h2>
        <p>
          Keep playing your usual game. Let chat choose a system, lock it before your attempt, then
          confirm what happened.
        </p>
      </header>
      <div className="lw-layout">
        <section className="panel lw-mission" aria-label="Mission control">
          <span className="badge">
            {world.mode === 'simulation'
              ? 'PRACTICE · simulated Twitch input'
              : 'TWITCH · incoming chat only'}{' '}
            · {stake?.status.toUpperCase() ?? 'BETWEEN CHAPTERS'}
          </span>
          {!mission ? (
            <p>LIVEWIRE is disabled on this server. Your Ark Protocol journey remains playable.</p>
          ) : (
            <>
              {stake && (
                <>
                  <h3>{stake.label}</h3>
                  <p>
                    {stake.game} · Chapter boundary {stake.chapter} · One supply committed
                  </p>
                </>
              )}
              {unresolved ? (
                <>
                  <p className="lw-state" role="status">
                    {open
                      ? 'Crew selection is open. Lock before you start playing.'
                      : locked
                        ? 'Commitment locked. Now make your attempt.'
                        : 'Selection paused; votes are closed.'}{' '}
                    <Deadline at={stake.deadlineAt} />
                  </p>
                  <Selection world={world} />
                  <p className="lw-ballot-summary" key={mission.revision}>
                    {mission.participants} unique participants · latest valid ballot per viewer ·
                    ties: navigation, hull, life support
                  </p>
                  {open && mission.canControl && (
                    <div className="lw-controls">
                      {!mission.participants && (
                        <label>
                          Solo system (no crew votes)
                          <select
                            value={solo}
                            onChange={(e) => setSolo(e.target.value as LivewireTarget)}
                          >
                            {stake.options.map((o) => (
                              <option key={o.target} value={o.target}>
                                {names[o.target]}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <button
                        disabled={busy}
                        onClick={() =>
                          onAction({
                            type: 'lock',
                            stakeId: stake.id,
                            ...(!mission.participants ? { solo } : {}),
                          })
                        }
                      >
                        Lock commitment · start attempt
                      </button>
                    </div>
                  )}
                  {locked && mission.canControl && (
                    <div className="lw-controls">
                      <p>
                        You are confirming the result. TORCHLINE does not detect or verify your
                        game.
                      </p>
                      <button
                        disabled={busy}
                        onClick={() =>
                          onAction({ type: 'resolve', stakeId: stake.id, outcome: 'success' })
                        }
                      >
                        Confirm success · streamer-attested
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          onAction({ type: 'resolve', stakeId: stake.id, outcome: 'failure' })
                        }
                      >
                        Confirm failure · streamer-attested
                      </button>
                    </div>
                  )}
                  {stake.status === 'paused' && mission.enabled && (
                    <button
                      disabled={busy}
                      onClick={() => onAction({ type: 'resume', stakeId: stake.id })}
                    >
                      Resume saved selection
                    </button>
                  )}
                  {mission.canControl && (
                    <button
                      className="lw-cancel"
                      disabled={busy}
                      onClick={() => onAction({ type: 'cancel', stakeId: stake.id })}
                    >
                      Cancel mission · allowance stays spent
                    </button>
                  )}
                </>
              ) : (
                <>
                  {stake && (
                    <div className="lw-result" role="status">
                      {['success', 'failure'].includes(stake.status)
                        ? `Streamer-attested ${stake.status}. The saved Ark and ship log now include this result.`
                        : `Mission ${stake.status}. No outcome applied; its allowance remains spent.`}
                    </div>
                  )}
                  <p>{mission.reason}</p>
                  {mission.available && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        onAction({ type: 'open', preset, game, label });
                      }}
                    >
                      <label>
                        Mission preset
                        <select
                          value={preset}
                          onChange={(e) => setPreset(e.target.value as typeof preset)}
                        >
                          <option value="boss">Boss attempt</option>
                          <option value="match">Match</option>
                          <option value="challenge">Personal challenge</option>
                        </select>
                      </label>
                      <label>
                        Game you are playing
                        <input
                          required
                          maxLength={64}
                          value={game}
                          onChange={(e) => setGame(e.target.value)}
                          placeholder="e.g. Rocket League"
                        />
                      </label>
                      <label>
                        One attempt
                        <input
                          required
                          maxLength={64}
                          value={label}
                          onChange={(e) => setLabel(e.target.value)}
                          placeholder="e.g. Win this ranked match"
                        />
                      </label>
                      <p>
                        45 seconds to choose and lock. One mission per boundary, one supply on
                        opening. Success repairs up to 3; failure damages up to 6. Lost systems stay
                        lost.
                      </p>
                      <button disabled={busy || !game.trim() || !label.trim()}>
                        Open mission · spend 1 supply
                      </button>
                    </form>
                  )}
                </>
              )}
              <p className="muted">
                No bot reply is required. Votes appear here and in the read-only OBS dock. Cancelled
                and expired missions cannot be reopened at this boundary.
              </p>
            </>
          )}
        </section>
        <section className="panel lw-ark" aria-label="Persistent mission Ark">
          <span className="eyebrow">THE SAME PERSISTENT ARK</span>
          <ArkView
            systems={world.systems}
            resources={world.resources}
            events={world.events}
            chapter={world.chapter}
            variant="panel"
            detailsExpanded={false}
            readOnly
          />
          <p>{world.recap}</p>
          <dl>
            {targets.map((t) => (
              <div key={t}>
                <dt>{names[t]}</dt>
                <dd>{world.resources[t]}%</dd>
              </div>
            ))}
          </dl>
          <small>
            Continue the expedition from Bridge after resolving this mission. The next chapter
            inherits every resource change.
          </small>
        </section>
      </div>
      {onSimulate && mission && unresolved && (
        <details className="panel lw-simulator">
          <summary>Practice chat · no Twitch messages</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSimulate(input, actor);
            }}
          >
            <label>
              Practice participant
              <input value={actor} maxLength={40} onChange={(e) => setActor(e.target.value)} />
            </label>
            <label>
              Practice command
              <input value={input} maxLength={160} onChange={(e) => setInput(e.target.value)} />
            </label>
            <button disabled={busy || !open}>Send practice ballot</button>
          </form>
        </details>
      )}
    </section>
  );
}
export function LivewireDock({
  world,
  error,
}: {
  world: WorldPresentation | null | undefined;
  error: string;
}) {
  const mission = world?.livewire,
    stake = mission?.stake;
  return (
    <main className="lw-overlay" aria-label="Compact LIVEWIRE broadcast">
      <section className="lw-dock" data-status={stake?.status ?? 'idle'}>
        <div className="lw-dock-brand">
          <strong>
            TORCHLINE <span>// LIVEWIRE</span>
          </strong>
          <small>
            {world?.mode === 'simulation' ? 'SIMULATION' : world ? 'TWITCH WORLD' : 'CONNECTING'}
          </small>
        </div>
        {world && (
          <svg
            className="lw-ship"
            viewBox="0 0 400 40"
            role="img"
            aria-label={`Persistent Ark: hull ${world.resources.hull}, navigation ${world.resources.navigation}, oxygen ${world.resources.oxygen}`}
          >
            <path
              d="M25 14H330L380 24 330 34H25L12 24Z"
              fill="#243640"
              stroke={world.resources.hull <= 25 ? '#ff7373' : '#8bbfc6'}
            />
            <path d="M290 14V34M45 14V34M170 4V39M185 4V39" stroke="#e4bd78" />
            <circle
              cx="155"
              cy="10"
              r="5"
              fill={
                world.systems.find((s) => s.id === 'lifeSupport')?.condition === 'destroyed'
                  ? '#ff7373'
                  : '#8bbfc6'
              }
            />
            <path
              d="M335 11V3L360 1"
              fill="none"
              stroke={world.resources.navigation === 0 ? '#ff7373' : '#8bbfc6'}
            />
          </svg>
        )}
        {world ? (
          <>
            <h1>{stake?.label ?? 'The Ark remembers'}</h1>
            <p>
              {stake?.game ?? `Chapter ${world.chapter} · ${world.phase}`} ·{' '}
              {stake?.status.toUpperCase() ?? 'READY'}
            </p>
            {mission && <Selection world={world} />}
            {stake?.status === 'open' ? (
              <p className="lw-dock-prompt">
                <code>!stake 1 / 2 / 3</code> · {mission?.participants ?? 0} crew ·{' '}
                <Deadline at={stake.deadlineAt} />
              </p>
            ) : stake?.status === 'locked' ? (
              <p className="lw-dock-prompt">
                {stake.target?.toUpperCase()} COMMITTED · waiting for streamer-attested result
              </p>
            ) : stake?.status === 'paused' ? (
              <p>Selection paused · captain resumes</p>
            ) : (
              <p className="lw-dock-prompt">{world.recap}</p>
            )}
            <small>
              {world.resources.passengers} passengers · Same Ark, lasting consequences ·{' '}
              {stake?.selection === 'solo'
                ? 'Solo commitment'
                : stake?.evidence === 'simulation'
                  ? 'Simulated ballots'
                  : stake?.evidence === 'twitch_signed'
                    ? 'Signed Twitch ballots'
                    : 'No automated outcome detection'}
            </small>
          </>
        ) : (
          <p>Waiting for the channel’s saved Ark.</p>
        )}
        {error && <p role="status">{error}</p>}
      </section>
    </main>
  );
}
