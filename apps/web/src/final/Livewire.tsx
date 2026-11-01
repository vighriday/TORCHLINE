import { useEffect, useState } from 'react';
import { debtCopy } from './Dossier.tsx';
import type { LivewireTarget } from '@torchline/contracts';
import { ArkShip } from './App.tsx';
import { Button, Brand, Icon } from './primitives.tsx';
import { useGame } from './session.tsx';
import { contextForPreset, GameFeed, GameHud, gameContexts } from './LivewireFeed.tsx';
import type { FeedPhase } from './feedKit.tsx';
import type { GameContext, Risk } from './types.ts';
const risks: Risk[] = ['Navigation', 'Hull', 'Life Support'];
const targets: LivewireTarget[] = ['navigation', 'hull', 'oxygen'];
const targetFor: Record<Risk, LivewireTarget> = {
  Navigation: 'navigation',
  Hull: 'hull',
  'Life Support': 'oxygen',
};
const stakeSteps = [
  ['open', 'OPEN STAKE'],
  ['voting', 'VIEWER VOTING'],
  ['locked', 'STAKE LOCKED'],
  ['result', 'CONFIRM OUTCOME'],
  ['consequence', 'SHIP CONSEQUENCE'],
] as const;
export function Livewire({ overlay = false }: { overlay?: boolean }) {
  const {
    data,
    canonical: world,
    display,
    readOnly,
    busy,
    mission,
    simulate,
    launch,
    setMode,
    visibleError,
    preferences,
  } = useGame();
  const [collapsed, setCollapsed] = useState(overlay),
    [won, setWon] = useState<boolean | null>(null),
    [game, setGame] = useState<GameContext>('voxel');
  const [placement, setPlacement] = useState<'bottom' | 'left' | 'right'>('bottom'),
    [scale, setScale] = useState(1),
    [chroma, setChroma] = useState(false),
    [controlsOpen, setControlsOpen] = useState(false),
    [controlsTab, setControlsTab] = useState<'game' | 'overlay' | 'history'>('game');
  const [solo, setSolo] = useState<LivewireTarget | ''>(''),
    [attempting, setAttempting] = useState(false),
    [finished, setFinished] = useState(false);
  const [attempt, setAttempt] = useState(gameContexts.voxel.attempt),
    [actor, setActor] = useState('crew-one');
  const [now, setNow] = useState(Date.now());
  const saved = world?.livewire,
    stake = saved?.stake;
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    setWon(null);
    setAttempting(false);
    setFinished(false);
    setSolo('');
    // A saved mission replays in the scene of the preset it was opened with, even after reload.
    if (stake) setGame(contextForPreset(stake.preset));
  }, [stake?.id]);
  useEffect(() => {
    if (!attempting) return;
    const timer = setTimeout(() => {
      setAttempting(false);
      setFinished(true);
    }, 1900);
    return () => clearTimeout(timer);
  }, [attempting]);
  const unresolved = !!stake && ['open', 'locked', 'paused'].includes(stake.status);
  const stage =
    stake?.status === 'open'
      ? 'voting'
      : stake?.status === 'paused'
        ? 'paused'
        : stake?.status === 'locked'
          ? attempting
            ? 'attempting'
            : finished
              ? 'result'
              : 'locked'
          : stake && ['success', 'failure'].includes(stake.status)
            ? 'consequence'
            : saved?.chargeAvailable === false
              ? 'cooldown'
              : 'open';
  const votes = saved?.tallies ?? [0, 0, 0];
  const total = votes.reduce((a, b) => a + b, 0);
  const leader = risks[votes.indexOf(Math.max(...votes))];
  const risk = stake?.target ? risks[targets.indexOf(stake.target)] : leader;
  const chosen = stake?.options.find((option) => option.target === targetFor[risk]);
  const timer = stake?.deadlineAt
    ? Math.max(0, Math.ceil((Date.parse(stake.deadlineAt) - now) / 1000))
    : 0;
  // The saved mission names the feed until the captain picks another game for the next one.
  const savedScene = !!stake && (unresolved || game === contextForPreset(stake.preset));
  const attemptName = stake && savedScene ? stake.label : attempt;
  const gameName = stake && savedScene ? stake.game : gameContexts[game].name;
  const history =
    world?.events.filter((event) => /livewire|mission|stake/i.test(event.summary)) ?? [];
  const stageIndex = stakeSteps.findIndex(
    ([key]) => key === (stage === 'attempting' ? 'locked' : stage),
  );
  const stageLabel =
    stage === 'attempting'
      ? 'ATTEMPT IN PROGRESS'
      : stage === 'paused'
        ? 'SELECTION PAUSED'
        : stage === 'cooldown'
          ? 'CHAPTER ALLOWANCE SPENT'
          : stake?.status === 'expired'
            ? 'WINDOW EXPIRED'
            : stake?.status === 'cancelled'
              ? 'MISSION CANCELLED'
              : (stakeSteps[stageIndex]?.[1] ?? 'ARK STANDBY');
  const control = !readOnly && !!saved?.canControl && !busy;
  const lock = () => {
    if (stake)
      mission({ type: 'lock', stakeId: stake.id, ...(total === 0 && solo ? { solo } : {}) });
  };
  const open = () =>
    mission({
      type: 'open',
      preset: gameContexts[game].preset,
      game: gameContexts[game].name,
      label: attempt.trim(),
    });
  const action =
    stage === 'open'
      ? {
          label: 'Open mission · spend 1 supply',
          run: open,
          disabled: !saved?.available || !attempt.trim(),
        }
      : stage === 'voting'
        ? {
            label: 'Lock commitment · start attempt',
            run: lock,
            disabled: timer === 0 || (total === 0 && !solo),
          }
        : stage === 'locked'
          ? { label: `ATTEMPT ${attemptName}`, run: () => setAttempting(true), disabled: false }
          : stage === 'attempting'
            ? { label: 'ATTEMPT IN PROGRESS…', run: () => {}, disabled: true }
            : stage === 'result'
              ? {
                  label: 'WRITE CONSEQUENCE TO ARK',
                  run: () => {
                    if (stake && won !== null)
                      mission({
                        type: 'resolve',
                        stakeId: stake.id,
                        outcome: won ? 'success' : 'failure',
                      });
                  },
                  disabled: won === null,
                }
              : stage === 'paused'
                ? {
                    label: 'Resume mission selection',
                    run: () => {
                      if (stake) mission({ type: 'resume', stakeId: stake.id });
                    },
                    disabled: false,
                  }
                : { label: 'CONTINUE THE VOYAGE', run: () => setMode('mission'), disabled: false };
  const wonSaved = stake?.status === 'success';
  const feedPhase: FeedPhase = !preferences.motion
    ? 'idle'
    : stage === 'attempting'
      ? 'attempt'
      : stage === 'result'
        ? 'hold'
        : stage === 'consequence' && savedScene
          ? wonSaved
            ? 'win'
            : 'loss'
          : 'idle';
  const hudPhase: FeedPhase =
    stage === 'consequence' && savedScene ? (wonSaved ? 'win' : 'loss') : feedPhase;
  const message =
    stage === 'cooldown'
      ? 'This chapter boundary has already been used. Cancellation and expiry do not refund the opening. Continue the voyage.'
      : stage === 'locked'
        ? `${risk} is committed. The target and exact effects are saved before your real attempt.`
        : stage === 'attempting'
          ? 'The commitment is locked. This scene illustrates the attempt; it does not detect your game.'
          : stage === 'result'
            ? 'Confirm the true outcome. The server writes one bounded consequence to the same Ark.'
            : stage === 'consequence'
              ? 'Streamer-attested result saved. The same Ark, physical record and Chronicle now include this consequence.'
              : stage === 'paused'
                ? `Recovery: ${stake?.pauseReason ?? 'connection interrupted'}. The captain must explicitly resume.`
                : 'Play your usual game. Chat chooses which Ark system carries the next attempt. No automated bot replies are required.';
  if (!world || !display)
    return (
      <main className="platform-page livewire-empty">
        <Brand />
        <span className="eyebrow">LIVEWIRE / THE GAME YOU ALREADY STREAM</span>
        <h1>ONE ATTEMPT. ONE LASTING CONSEQUENCE.</h1>
        <p>
          {visibleError ||
            'Launch or resume an Ark to attach a mission to its real persistent world.'}
        </p>
        {!readOnly && (
          <Button className="platform-primary" onClick={launch}>
            Launch the Ark
          </Button>
        )}
      </main>
    );
  return (
    <main
      className={`livewire-world ${overlay ? 'livewire-world--overlay' : ''} ${chroma ? 'livewire-world--chroma' : ''} ${stage === 'consequence' ? (wonSaved ? 'livewire-world--win' : 'livewire-world--loss') : ''}`}
      data-stage={stage}
      data-world={world.worldId}
      data-evidence={world.mode}
    >
      {!overlay && (
        <div className="game-scene">
          {!chroma && (
            <GameFeed context={game} phase={feedPhase} reducedMotion={!preferences.motion} />
          )}
          <GameHud
            context={game}
            phase={hudPhase}
            game={gameName}
            attempt={attemptName}
            awaiting={stage === 'result'}
          />
        </div>
      )}
      {!readOnly && (
        <aside className={`livewire-controls ${controlsOpen ? 'open' : ''}`}>
          <Button className="controls-toggle" onClick={() => setControlsOpen(!controlsOpen)}>
            <Icon name="grid" />
            {controlsOpen ? 'HIDE STREAMER CONTROLS' : 'STREAMER CONTROLS'}
          </Button>
          {controlsOpen && (
            <div className="controls-body">
              <div className="controls-tabs">
                {(['game', 'overlay', 'history'] as const).map((tab) => (
                  <Button
                    key={tab}
                    className={controlsTab === tab ? 'active' : ''}
                    onClick={() => setControlsTab(tab)}
                  >
                    {tab.toUpperCase()}
                  </Button>
                ))}
              </div>
              {controlsTab === 'game' && (
                <div className="controls-list">
                  {(Object.keys(gameContexts) as GameContext[]).map((key) => (
                    <Button
                      key={key}
                      className={game === key ? 'active' : ''}
                      disabled={unresolved}
                      onClick={() => {
                        setGame(key);
                        setAttempt(gameContexts[key].attempt);
                      }}
                    >
                      <strong>{gameContexts[key].name}</strong>
                      <small>PRESET / {gameContexts[key].attempt}</small>
                    </Button>
                  ))}
                  <label>
                    One attempt
                    <input
                      value={unresolved ? attemptName : attempt}
                      disabled={unresolved}
                      maxLength={64}
                      onChange={(e) => setAttempt(e.target.value)}
                    />
                  </label>
                  <p>
                    Game context changes only before a new stake. The illustrated scene never
                    verifies the actual attempt.
                  </p>
                </div>
              )}
              {controlsTab === 'overlay' && (
                <div className="controls-list">
                  <span className="controls-label">DOCK PLACEMENT</span>
                  <div className="controls-row">
                    {(['left', 'bottom', 'right'] as const).map((item) => (
                      <Button
                        key={item}
                        className={placement === item ? 'active' : ''}
                        onClick={() => setPlacement(item)}
                      >
                        {item.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                  <span className="controls-label">OVERLAY SCALE</span>
                  <div className="controls-row">
                    {[0.85, 1, 1.15].map((item) => (
                      <Button
                        key={item}
                        className={scale === item ? 'active' : ''}
                        onClick={() => setScale(item)}
                      >
                        {Math.round(item * 100)}%
                      </Button>
                    ))}
                  </div>
                  <span className="controls-label">PREVIEW BACKGROUND</span>
                  <div className="controls-row">
                    <Button className={!chroma ? 'active' : ''} onClick={() => setChroma(false)}>
                      GAME PREVIEW
                    </Button>
                    <Button className={chroma ? 'active' : ''} onClick={() => setChroma(true)}>
                      CHROMA KEY
                    </Button>
                  </div>
                  <p>
                    The actual OBS source is transparent and read only. Generate its private link in
                    Creator Studio.
                  </p>
                </div>
              )}
              {controlsTab === 'history' && (
                <div className="stake-history">
                  {history.length ? (
                    history.map((event) => (
                      <div key={event.id}>
                        <b>CH.{event.chapter}</b>
                        <span>{event.summary}</span>
                      </div>
                    ))
                  ) : (
                    <p>No saved mission history yet.</p>
                  )}
                </div>
              )}
              <div className="farm-meter">
                <span>ONE OPENING PER CHAPTER BOUNDARY</span>
                <b>{saved?.chargeAvailable ? 'AVAILABLE' : 'SPENT'} / 5 MAX</b>
                <i>
                  <em
                    style={
                      { '--used': saved?.chargeAvailable ? '0%' : '100%' } as React.CSSProperties
                    }
                  />
                </i>
                <p>
                  Opening costs 1 supply. Maximum success +3; failure −6, with a floor of 1. No
                  refunds or lost-system resurrection.
                </p>
              </div>
            </div>
          )}
        </aside>
      )}
      {collapsed ? (
        <section
          className={`dock dock--collapsed dock--${placement}`}
          style={{ '--dock-scale': scale } as React.CSSProperties}
        >
          <div className="dock-edge" />
          <Brand compact />
          <div className="mini-status">
            <span>
              {stake ? stageLabel : world.arrival ? 'ARK RECEIVED' : 'ARK STANDBY'} ·{' '}
              {world.mode === 'live' ? 'TWITCH' : 'PRACTICE'}
            </span>
            <strong>
              {stake?.target ? risk.toUpperCase() : attemptName}
              {stage === 'voting' ? ` · ${timer}s · ${total} VOTES` : ''}
            </strong>
            <small>
              {stake?.status === 'open'
                ? '!stake 1 NAV · 2 HULL · 3 O₂'
                : stake?.status === 'locked'
                  ? 'COMMITMENT LOCKED · AWAITING ATTEMPT'
                  : world.arrival
                    ? `INHERITED FROM ${world.arrival.from.label.toUpperCase()}${
                        world.arrival.debts?.[0]
                          ? ` · ${debtCopy[world.arrival.debts[0].kind].title.toUpperCase()} DUE CH.${world.arrival.debts[0].dueChapter}`
                          : ''
                      }`
                    : 'SAVED SHIP · CAPTAIN OPENS NEXT MISSION'}
            </small>
            {visibleError && <small role="status">{visibleError}</small>}
          </div>
          <div className="mini-ark">
            <ArkShip mini navigation={world.resources.navigation} />
          </div>
          <div className="compact-resources">
            <b data-livewire-resource="hull">HULL {world.resources.hull}%</b>
            <b data-livewire-resource="oxygen">O₂ {world.resources.oxygen}%</b>
            <b data-livewire-resource="navigation">NAV {world.resources.navigation}%</b>
          </div>
          {!readOnly && (
            <Button onClick={() => setCollapsed(false)}>
              EXPAND
              <Icon name="chevron" />
            </Button>
          )}
        </section>
      ) : (
        <section
          className={`dock dock--${placement} dock--stage-${stage}`}
          style={{ '--dock-scale': scale } as React.CSSProperties}
        >
          <div className="dock-edge" />
          <div className="dock-header">
            <Brand compact />
            <div className="live-badge">
              <span />
              LIVEWIRE / {world.mode === 'live' ? 'TWITCH' : 'SAVED PRACTICE'}
            </div>
            {!readOnly && (
              <Button
                className="icon-button"
                onClick={() => setCollapsed(true)}
                ariaLabel="Collapse dock"
              >
                —
              </Button>
            )}
          </div>
          <div className="dock-progress">
            {stakeSteps.map(([key], index) => (
              <span
                key={key}
                className={index === stageIndex ? 'active' : stageIndex > index ? 'done' : ''}
              >
                {index + 1}
              </span>
            ))}
          </div>
          <div className="dock-body">
            <div className="stake-copy">
              <span className="eyebrow">
                {gameName.toUpperCase()} / {attemptName}
              </span>
              <strong>{stageLabel}</strong>
              {stage === 'voting' ? (
                <div className="vote-timer">
                  <b>{timer}s</b>
                  <i>
                    <em
                      style={
                        { '--time': `${Math.min(100, (timer / 45) * 100)}%` } as React.CSSProperties
                      }
                    />
                  </i>
                </div>
              ) : (
                <p>{message}</p>
              )}
              {!unresolved && !saved?.available && (
                <p>{saved?.reason ?? 'LIVEWIRE is unavailable on this world.'}</p>
              )}
            </div>
            <div className="dock-ark">
              <ArkShip mini navigation={world.resources.navigation} />
              <div className="ark-pulse">
                <span>NAV {world.resources.navigation}%</span>
                <b>
                  HULL {world.resources.hull}% · O₂ {world.resources.oxygen}%
                </b>
              </div>
            </div>
            <div className="dock-main">
              {['open', 'voting', 'locked', 'attempting', 'paused'].includes(stage) && (
                <div className="risk-options">
                  {risks.map((item, index) => {
                    const option = stake?.options.find((o) => o.target === targetFor[item]);
                    const eligible = stake ? !!option : world.resources[targetFor[item]] > 0;
                    return (
                      <Button
                        key={item}
                        className={`${stake?.target === targetFor[item] ? 'selected locked' : ''} ${stage === 'voting' && leader === item && total ? 'leading' : ''}`}
                        disabled={
                          readOnly ||
                          busy ||
                          stage !== 'voting' ||
                          data?.mode !== 'simulation' ||
                          !eligible
                        }
                        onClick={() => simulate(`!stake ${index + 1}`, actor)}
                      >
                        <div>
                          <span>
                            {eligible
                              ? `SUCCESS +${option?.success ?? 3} / FAILURE ${option?.failure ?? -6}`
                              : 'UNAVAILABLE · LOST OR SEALED'}
                          </span>
                          <strong>{item}</strong>
                        </div>
                        <b data-ballots={targetFor[item]}>
                          {stage === 'open' ? '—' : `${votes[index]} votes`}
                        </b>
                        <i>
                          <span
                            style={
                              {
                                '--vote': `${total ? (votes[index] / total) * 100 : 0}%`,
                              } as React.CSSProperties
                            }
                          />
                        </i>
                        <small>!stake {index + 1}</small>
                      </Button>
                    );
                  })}
                  <small className="vote-hint">
                    {stage === 'voting'
                      ? 'Latest accepted ballot per viewer. Commit before attempting.'
                      : 'Real selection opens only after the paid mission is saved.'}
                  </small>
                </div>
              )}
              {stage === 'result' && !readOnly && (
                <div className="outcome-confirm">
                  <span>STREAMER ATTESTATION REQUIRED</span>
                  <strong>DID THE {attemptName} SUCCEED?</strong>
                  <div>
                    <Button
                      className={won === true ? 'selected win' : ''}
                      onClick={() => setWon(true)}
                    >
                      CONFIRM WIN
                      <small>
                        {risk} +{chosen?.success ?? 0}
                      </small>
                    </Button>
                    <Button
                      className={won === false ? 'selected loss' : ''}
                      onClick={() => setWon(false)}
                    >
                      CONFIRM LOSS
                      <small>
                        {risk} {chosen?.failure ?? 0}
                      </small>
                    </Button>
                  </div>
                </div>
              )}
              {stage === 'consequence' && (
                <div className={`dock-consequence ${wonSaved ? 'win' : 'loss'}`} role="status">
                  <span>STREAMER-ATTESTED {wonSaved ? 'SUCCESS' : 'FAILURE'} SAVED</span>
                  <strong>
                    {risk.toUpperCase()} / {world.resources[targetFor[risk]]}%
                  </strong>
                  <p>
                    The result is persistent. Mission Control, physical marks and World Chronicle
                    share this Ark.
                  </p>
                </div>
              )}
              {stage === 'cooldown' && (
                <div className="dock-consequence loss">
                  <span>FINITE MISSION ALLOWANCE</span>
                  <strong>THIS CHAPTER IS SPENT</strong>
                  <p>{message}</p>
                </div>
              )}
            </div>
          </div>
          {!readOnly && stage === 'voting' && total === 0 && (
            <label className="solo-choice">
              No crew votes · explicit solo target
              <select value={solo} onChange={(e) => setSolo(e.target.value as LivewireTarget | '')}>
                <option value="">Choose a solo system before locking</option>
                {stake?.options.map((option) => (
                  <option key={option.target} value={option.target}>
                    {risks[targets.indexOf(option.target)]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!readOnly && data?.mode === 'simulation' && stage === 'voting' && (
            <details className="practice-chat">
              <summary>Practice chat · mission ballot</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  simulate('!stake 2', actor);
                }}
              >
                <label>
                  Simulated viewer
                  <input value={actor} onChange={(e) => setActor(e.target.value)} maxLength={64} />
                </label>
                <button disabled={busy}>Send practice ballot</button>
              </form>
            </details>
          )}
          <div className="dock-footer">
            <div>
              <Icon name="people" />
              <b>{total.toLocaleString()}</b>
              <span>VIEWER BALLOTS</span>
            </div>
            <div>
              <Icon name="pulse" />
              <b>{saved?.chargeAvailable ? '1' : '0'}/1</b>
              <span>CHAPTER ALLOWANCE</span>
            </div>
            {!readOnly && unresolved && stake && (
              <Button
                className="mission-link"
                disabled={!control}
                onClick={() => mission({ type: 'cancel', stakeId: stake.id })}
              >
                CANCEL STAKE
              </Button>
            )}
            {!readOnly && (
              <>
                <Button
                  className="dock-action"
                  onClick={action.run}
                  disabled={
                    busy ||
                    action.disabled ||
                    (['open', 'voting', 'locked', 'result', 'paused'].includes(stage) && !control)
                  }
                >
                  {action.label}
                  <Icon name="chevron" />
                </Button>
                <Button className="mission-link" onClick={() => setMode('mission')}>
                  MISSION CONTROL
                </Button>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
