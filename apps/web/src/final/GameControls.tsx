import { useEffect, useMemo, useState } from 'react';
import type { WorldPresentation } from '@torchline/contracts';
import { Button, Icon } from './primitives.tsx';
import { useGame } from './session.tsx';
import { request } from '../api.ts';
import { systemLabels } from './condition.ts';
import { debtCopy } from './Dossier.tsx';

// Reasons an audience member can act on, in the words a streamer would say them out loud.
const rejectionLabels: Record<string, string> = {
  INPUT_RATE_LIMITED: 'rate limited',
  INPUT_BACKLOG: 'queue full',
  INPUT_WRONG_PHASE: 'wrong phase for the command',
};

export function PhaseClock({ world }: { world: WorldPresentation }) {
  const [now, setNow] = useState(Date.now());
  const offset = useMemo(
    () => Date.now() - Date.parse(world.clock?.serverAt ?? new Date().toISOString()),
    [world.clock?.serverAt],
  );
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const ms = world.clock?.deadlineAt
    ? Math.max(0, Date.parse(world.clock.deadlineAt) - now + offset)
    : world.clock?.remainingMs;
  return (
    <div className="countdown">
      <span>{world.phase.replaceAll('-', ' ').toUpperCase()}</span>
      <b role="timer">{ms == null ? 'MANUAL' : `${Math.ceil(ms / 1000)}s`}</b>
      {world.clock?.recoveryReason && <small>{world.clock.recoveryReason} · captain resumes</small>}
    </div>
  );
}
export function PhysicalSystems({ world }: { world: WorldPresentation }) {
  return (
    <details className="physical-record">
      <summary>
        Physical ship record · {world.systems.reduce((n, s) => n + s.marks.length, 0)} lasting marks
      </summary>
      <div className="physical-grid">
        {world.systems.map((system) => (
          <article
            key={system.id}
            data-system={system.id}
            data-condition={system.condition}
            data-severity={system.severity}
          >
            <div>
              <strong>{systemLabels[system.id]}</strong>
              <b>{system.integrity}%</b>
            </div>
            <span>
              {system.condition} · {system.severity}
            </span>
            {system.marks.length > 0 ? (
              <ul>
                {system.marks.slice(-4).map((mark, index) => (
                  <li key={`${mark.eventId}-${index}`}>
                    {mark.kind} · chapter {mark.chapter} · {mark.community}
                  </li>
                ))}
              </ul>
            ) : (
              <small>No recorded damage</small>
            )}
          </article>
        ))}
      </div>
      {world.obligations
        .filter((o) => o.status === 'pending')
        .map((obligation) => (
          <p key={obligation.id}>
            Unresolved: {debtCopy[obligation.kind].title} · due chapter {obligation.dueChapter}
          </p>
        ))}
    </details>
  );
}
export function PracticeChat() {
  const { data, readOnly, busy, simulate } = useGame();
  const [actor, setActor] = useState('crew-one');
  const [text, setText] = useState('!scan A');
  if (readOnly || data?.mode !== 'simulation' || !data.me) return null;
  return (
    <details className="practice-chat">
      <summary>Practice chat · saved simulation</summary>
      <p>These inputs use the real engine. They are never sent to Twitch.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          simulate(text, actor);
        }}
      >
        <label>
          Simulated viewer
          <input value={actor} maxLength={64} onChange={(e) => setActor(e.target.value)} />
        </label>
        <label>
          Chat command
          <input
            value={text}
            maxLength={160}
            onChange={(e) => setText(e.target.value)}
            placeholder="!scan A"
          />
        </label>
        <button disabled={busy || !text.trim()}>Send simulated input</button>
      </form>
    </details>
  );
}
function EpisodeSettings({ world }: { world: WorldPresentation }) {
  const { send, perform, busy, readOnly } = useGame();
  const [budget, setBudget] = useState(world.cooperation?.budget ?? 0),
    [investigation, setInvestigation] = useState(world.cooperation?.investigation ?? false);
  const saved = world.clock?.durations;
  const savedKey = JSON.stringify(saved);
  const savedKind =
    saved && Object.values(saved).every((v) => v === null)
      ? 'manual'
      : saved &&
          saved.investigation === 30 &&
          saved.challenge === 90 &&
          saved.allocation === 45 &&
          saved.decision === 60
        ? 'timed'
        : 'custom';
  const [timingDraft, setTimingDraft] = useState<string | null>(null);
  const timing = timingDraft ?? savedKind;
  useEffect(() => {
    setBudget(world.cooperation?.budget ?? 0);
    setInvestigation(world.cooperation?.investigation ?? false);
  }, [world.worldId, world.phase, world.cooperation?.budget, world.cooperation?.investigation]);
  useEffect(() => setTimingDraft(null), [world.worldId, world.phase]);
  useEffect(() => {
    // Late HTTP/SSE snapshots may initialize or change the saved clock while
    // the captain edits. Only adopt them when no local selection is pending.
    if (timingDraft === savedKind) setTimingDraft(null);
  }, [savedKey, savedKind, timingDraft]);
  if (readOnly || !world.capabilities.canStart) return null;
  return (
    <details className="episode-preparation">
      <summary>Prepare next chapter · crew and pacing</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send({ type: 'configure-cooperation', budget, investigation });
        }}
      >
        <label>
          Repair reserve (0–10 power)
          <input
            type="number"
            min="0"
            max={Math.min(10, world.resources.power)}
            value={budget}
            disabled={busy}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={investigation}
            disabled={busy}
            onChange={(e) => setInvestigation(e.target.checked)}
          />
          Investigate a shared clue first
        </label>
        <button disabled={busy}>Save crew settings</button>
      </form>
      <label>
        Next chapter timing
        <select value={timing} disabled={busy} onChange={(e) => setTimingDraft(e.target.value)}>
          <option value="manual">Manual · captain closes each window</option>
          <option value="timed">Timed · automatic countdowns</option>
          {savedKind === 'custom' && <option value="custom">Custom · keep saved timing</option>}
        </select>
      </label>
      <Button
        disabled={busy}
        onClick={() =>
          void perform(() =>
            request(
              `/api/worlds/${world.worldId}/timing`,
              timing === 'custom' && saved
                ? saved
                : {
                    investigation: timing === 'manual' ? null : 30,
                    challenge: timing === 'manual' ? null : 90,
                    allocation: timing === 'manual' ? null : 45,
                    decision: timing === 'manual' ? null : 60,
                  },
            ),
          )
        }
      >
        Save timing
      </Button>
    </details>
  );
}
export function GameControls() {
  const {
    canonical: world,
    readOnly,
    busy,
    send,
    data,
    perform,
    setMode,
    setArchiveWorld,
  } = useGame();
  const [route, setRoute] = useState('');
  const [choice, setChoice] = useState('');
  const [hull, setHull] = useState(0);
  const [oxygen, setOxygen] = useState(0);
  useEffect(() => {
    setChoice('');
    setRoute('');
  }, [world?.worldId, world?.phase]);
  if (!world) return null;
  const cap = world.capabilities,
    challenge = world.challenge,
    co = world.cooperation;
  const interactive = !readOnly && !busy;
  const selected = world.choices.find((c) => c.id === choice);
  const relevant = world.events.at(-1);
  const unknown = challenge?.nodes.find((node) => !['S', 'T'].includes(node.id) && !node.revealed);
  const unpatched = challenge?.nodes.find(
    (node) => node.revealed && !node.patched && !['S', 'T'].includes(node.id),
  );
  const chatHint =
    world.phase === 'challenge' && !challenge?.solved
      ? unknown
        ? `!scan ${unknown.id}`
        : challenge?.kind === 'work-order' && unpatched
          ? `!patch ${unpatched.id}`
          : '!route S … T'
      : world.phase === 'decision'
        ? '!vote 1'
        : world.phase === 'investigation'
          ? '!inspect engine'
          : world.phase === 'allocation'
            ? '!allocate hull 3 oxygen 2'
            : world.livewire?.stake?.status === 'open'
              ? '!stake 1 · 2 · 3'
              : 'commands open when the chapter starts';
  return (
    <div className="game-directives" aria-label="Game controls">
      <div className="panel-cut">
        <span className="eyebrow">
          {world.chapter === 0 ? 'PRE-LAUNCH' : `CHAPTER ${world.chapter}`} / CANONICAL STATE
        </span>
        <div className="sector-title">
          <div>
            <strong>{world.title}</strong>
            <span>{world.phase.replaceAll('-', ' ').toUpperCase()}</span>
          </div>
        </div>
        <p>{world.recap}</p>
      </div>
      {world.outcome && (
        <div
          className={`consequence ${world.outcome === 'colony' ? '' : 'consequence--loss'}`}
          data-outcome={world.outcome}
          role="status"
        >
          <span>VOYAGE COMPLETE</span>
          <strong>
            {world.outcome === 'colony'
              ? 'A NEW HOME'
              : world.outcome === 'partial'
                ? 'SURVIVORS REACH LAND'
                : 'THE ARK IS LOST'}
          </strong>
          <p>{world.endingReason}</p>
          <b>{world.resources.passengers} passengers remain</b>
          {!readOnly && (
            <div className="ending-actions">
              <Button
                onClick={() => {
                  setArchiveWorld(world);
                  setMode('archive');
                }}
              >
                Read the season record
              </Button>
              <Button
                className="commit-button"
                disabled={!interactive}
                onClick={() =>
                  void perform(async () => {
                    await request('/api/worlds', {});
                  })
                }
              >
                Launch a new Ark
                <Icon name="chevron" />
              </Button>
            </div>
          )}
        </div>
      )}
      {co && (
        <section className="investigation">
          <div className="section-label">
            <span>CREW COOPERATION</span>
            <small>{world.participantCount} PARTICIPANTS</small>
          </div>
          {world.rejections && world.rejections.length > 0 && (
            <p className="rejected-inputs">
              Not applied this window ·{' '}
              {world.rejections
                .map(
                  (entry) =>
                    `${entry.dropped} ${
                      rejectionLabels[entry.reason] ??
                      entry.reason.toLowerCase().replaceAll('_', ' ')
                    }`,
                )
                .join(' · ')}
            </p>
          )}
          {world.phase === 'investigation' ? (
            <>
              <p>
                Chat: <code>!inspect engine</code>, <code>!inspect cargo</code> or{' '}
                <code>!inspect life</code>
              </p>
              <ul>
                {['engine', 'cargo', 'life'].map((area) => (
                  <li key={area}>
                    <b>{co.inspections[area] ?? 0}</b>
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p>
                Repair reserve: {co.budget} power · {co.allocations} plans
              </p>
              <p>
                Locked plan: hull +{co.plan.hull} · oxygen +{co.plan.oxygen}
              </p>
            </>
          )}
          {world.phase === 'allocation' && (
            <>
              <p>
                Chat: <code>!allocate hull 3 oxygen 2</code> or <code>!allocate 3 2</code> · up to
                five preference points each. Preferences share the {co.budget} reserved power; a
                bigger audience never adds power.
              </p>
              {!readOnly && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send({ type: 'allocate', hull, oxygen });
                  }}
                >
                  <label>
                    Hull preference
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={hull}
                      onChange={(e) => setHull(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Oxygen preference
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={oxygen}
                      onChange={(e) => setOxygen(Number(e.target.value))}
                    />
                  </label>
                  <button disabled={!interactive || hull + oxygen < 1 || hull + oxygen > 5}>
                    Submit repair plan
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      )}
      {challenge && (
        <section
          className="investigation challenge-panel"
          aria-label="Cooperative challenge"
          data-kind={challenge.kind}
        >
          <div className="section-label">
            <span>{challenge.title}</span>
            <small>{challenge.solved ? 'SOLVED · REWARD SAVED' : 'SHARED OBJECTIVE'}</small>
          </div>
          <p>{challenge.prompt}</p>
          <p className="mechanical-reward">Success: {challenge.reward}</p>
          {challenge.kind === 'route' && (
            <>
              <div className="constraint-row">
                <span>Budget {challenge.budget}</span>
                <span>Required {challenge.requiredNode ?? 'scan to discover'}</span>
                <span>Unsafe {challenge.blockedNode ?? 'scan to discover'}</span>
              </div>
              <svg
                className="relay-map"
                viewBox="0 0 460 180"
                role="group"
                aria-label="Relay connections and signal costs"
              >
                {challenge.edges.map((edge) => {
                  const positions: Record<string, [number, number]> = {
                    S: [25, 90],
                    A: [150, 35],
                    B: [150, 145],
                    C: [310, 35],
                    D: [310, 145],
                    T: [435, 90],
                  };
                  const a = positions[edge.from],
                    b = positions[edge.to];
                  return (
                    <g key={edge.from + edge.to}>
                      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
                      <text x={(a[0] + b[0]) / 2} y={(a[1] + b[1]) / 2 - 6}>
                        {edge.cost}
                      </text>
                    </g>
                  );
                })}
                {challenge.nodes.map((node) => {
                  const position: Record<string, [number, number]> = {
                    S: [25, 90],
                    A: [150, 35],
                    B: [150, 145],
                    C: [310, 35],
                    D: [310, 145],
                    T: [435, 90],
                  };
                  const [x, y] = position[node.id];
                  return (
                    <g key={node.id} transform={`translate(${x} ${y})`}>
                      <circle r="19" />
                      <text y="5">{node.id}</text>
                    </g>
                  );
                })}
              </svg>
            </>
          )}
          <div className="clue-list">
            {challenge.nodes
              .filter((node) => !['S', 'T'].includes(node.id))
              .map((node) => (
                <article key={node.id} className={node.revealed ? 'found' : ''}>
                  <div>
                    <b>{node.id}</b>
                    <span>
                      {node.patched ? 'PATCHED' : node.revealed ? 'DISCOVERED' : 'UNKNOWN'}
                    </span>
                  </div>
                  <p>{node.clue ?? `Chat: !scan ${node.id}`}</p>
                  {!readOnly && world.phase === 'challenge' && !challenge.solved && (
                    <>
                      {!node.revealed ? (
                        <Button
                          disabled={!interactive}
                          onClick={() => send({ type: 'scan', node: node.id as 'A' })}
                        >
                          Scan {node.id}
                        </Button>
                      ) : challenge.kind === 'work-order' && !node.patched ? (
                        <Button
                          disabled={!interactive}
                          onClick={() => send({ type: 'patch', node: node.id as 'A' })}
                        >
                          Patch {node.id}
                        </Button>
                      ) : null}
                    </>
                  )}
                </article>
              ))}
          </div>
          {challenge.kind === 'route' && world.phase === 'challenge' && !challenge.solved && (
            <div className="route-entry">
              <p>
                Chat: <code>!route S … T</code> · discover safe relays before submitting.
              </p>
              {!readOnly && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send({
                      type: 'route',
                      nodes: route.trim().toUpperCase().split(/\s+/) as (
                        'S' | 'A' | 'B' | 'C' | 'D' | 'T'
                      )[],
                    });
                  }}
                >
                  <label>
                    Candidate route
                    <input
                      value={route}
                      maxLength={24}
                      placeholder="S … T"
                      onChange={(e) => setRoute(e.target.value)}
                    />
                  </label>
                  <button disabled={!interactive || !route.trim()}>Submit route</button>
                </form>
              )}
            </div>
          )}
        </section>
      )}
      {world.choices.length > 0 && (
        <section className="decision">
          <div className="section-label">
            <span>SURVIVAL DECISION</span>
            <small>CHAT ADVISES · CAPTAIN COMMITS</small>
          </div>
          {world.choices.map((item, index) => (
            <div key={item.id}>
              <Button
                className={`choice ${choice === item.id ? 'selected' : ''} ${!item.available ? 'choice--danger' : ''}`}
                disabled={!interactive || !item.available || !cap.canCommit}
                onClick={() => setChoice(item.id)}
              >
                <span className="choice-radio" />
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.description}</p>
                  <small>
                    Chat: !vote {index + 1} · {world.votes[item.id] ?? 0} votes
                  </small>
                  {item.preview && (
                    <small className="choice-deltas">
                      {Object.entries(item.preview.resources).map(([key, value]) => {
                        const delta = value - world.resources[key as keyof typeof world.resources];
                        return delta ? (
                          <span key={key}>
                            {key} {delta > 0 ? '+' : ''}
                            {delta}{' '}
                          </span>
                        ) : null;
                      })}
                    </small>
                  )}
                  {!item.available && <small>{item.unavailableReason}</small>}
                </div>
              </Button>
              {item.preview?.warnings.map((warning) => (
                <p className="warning-copy" key={warning}>
                  {warning}
                </p>
              ))}
            </div>
          ))}
          {!readOnly && (
            <>
              {cap.canCommit && !selected && (
                <p className="commit-hint">Select a directive above, then commit it.</p>
              )}
              <Button
                className="commit-button"
                disabled={!interactive || !cap.canCommit || !selected?.available}
                onClick={() => send({ type: 'commit', option: choice })}
              >
                <span>Commit directive</span>
                <Icon name="lock" />
              </Button>
            </>
          )}
        </section>
      )}
      {!readOnly && (
        <div className="phase-actions">
          {cap.canStart && (
            <Button
              className="commit-button"
              disabled={!interactive}
              onClick={() => send({ type: 'start' })}
            >
              Start chapter {world.chapter + 1}
              <Icon name="chevron" />
            </Button>
          )}
          {cap.canCloseInvestigation && (
            <Button disabled={!interactive} onClick={() => send({ type: 'close-investigation' })}>
              Close investigation
            </Button>
          )}
          {cap.canCloseChallenge && (
            <Button disabled={!interactive} onClick={() => send({ type: 'close-challenge' })}>
              Close challenge
            </Button>
          )}
          {cap.canCloseAllocation && (
            <Button disabled={!interactive} onClick={() => send({ type: 'close-allocation' })}>
              Close allocation
            </Button>
          )}
          {cap.canCloseVoting && (
            <Button disabled={!interactive} onClick={() => send({ type: 'close-voting' })}>
              Close voting
            </Button>
          )}
          {cap.canPause && world.phase !== 'ready' && (
            <Button disabled={!interactive} onClick={() => send({ type: 'pause' })}>
              Pause chapter
            </Button>
          )}
          {cap.canResume && (
            <Button disabled={!interactive} onClick={() => send({ type: 'resume' })}>
              Resume chapter
            </Button>
          )}
          {cap.canStart && (
            <Button
              disabled={!interactive}
              onClick={() =>
                void perform(() =>
                  request(`/api/worlds/${world.worldId}/hosting`, { resume: false }),
                )
              }
            >
              Park this Ark
            </Button>
          )}
        </div>
      )}
      <EpisodeSettings world={world} />
      <PhysicalSystems world={world} />
      <PracticeChat />
      {data?.mode === 'live' && (
        <a
          className="chat-link"
          href={`https://www.twitch.tv/popout/${encodeURIComponent(world.host)}/chat`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Twitch chat · {chatHint}
        </a>
      )}
      {relevant && (
        <p className="latest-consequence" role="status">
          Last saved consequence: {relevant.summary}
        </p>
      )}
    </div>
  );
}
