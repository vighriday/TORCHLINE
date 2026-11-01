import { useEffect, useRef, useState } from 'react';
import type { Command, LivewireRequest, WorldPresentation } from '@torchline/contracts';
import { request } from '../api.ts';
import type { DashboardSnapshot, HandoffView } from '../api.ts';
import { Button, Icon } from './primitives.tsx';
import { useGame } from './session.tsx';
import { ArrivalDossier } from './Dossier.tsx';
import { GameFeed, gameContexts } from './LivewireFeed.tsx';
import type { FeedPhase } from './feedKit.tsx';
import type { GameContext, Mode } from './types.ts';

// A guided two-community relay for judges and new creators. Every step calls the same public
// endpoints the dashboard uses, as the named practice identity, so the engine, PostgreSQL
// transactions and custody rules decide each outcome. Only the raid proof is simulated, and the
// server refuses that proof for live worlds. Each community keeps streaming its own game: their
// LIVEWIRE missions change the same Ark, and the feeds are illustrations, never game telemetry.
type Captain = 'alpha' | 'beta' | 'gamma';
type Side = 'alpha' | 'receiver';
interface MissionRecord {
  game: string;
  label: string;
  target: string;
  outcome: 'success' | 'failure';
  delta: number;
}
interface Line {
  actor: string;
  text: string;
  tone: 'command' | 'result' | 'evidence';
}
interface Progress {
  step: number;
  receiver: Exclude<Captain, 'alpha'>;
  worldId: string | null;
  handoffId: string | null;
  missions: Partial<Record<Side, MissionRecord>>;
  log: Line[];
}
const STORAGE_KEY = 'torchline:relay-rehearsal:v2';
const fresh = (receiver: Progress['receiver'] = 'beta'): Progress => ({
  step: 0,
  receiver,
  worldId: null,
  handoffId: null,
  missions: {},
  log: [],
});
const label = (captain: Captain) => `Simulation ${captain}`;
const state = () => request<DashboardSnapshot>('/api/state');
const login = (channel: Captain) => request('/api/simulator/login', { channel });
const chat = (actor: string, text: string) =>
  request<DashboardSnapshot>('/api/simulator/commands', { actor, text });
const command = (world: WorldPresentation, next: Command) =>
  request<DashboardSnapshot>(`/api/worlds/${world.worldId}/commands`, {
    command: next,
    expectedVersion: world.worldVersion,
    commandId: crypto.randomUUID(),
  });
const mission = (world: WorldPresentation, action: LivewireRequest['action']) =>
  request<DashboardSnapshot>(`/api/worlds/${world.worldId}/livewire`, {
    action,
    expectedVersion: world.worldVersion,
    commandId: crypto.randomUUID(),
  });
const unresolvedMission = (world: WorldPresentation) =>
  !!world.livewire?.stake && ['open', 'paused', 'locked'].includes(world.livewire.stake.status);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Context {
  progress: Progress;
  note: (actor: string, text: string, tone?: Line['tone']) => void;
  save: (patch: Partial<Progress>) => void;
  /** Drives the illustrated feed of a channel while a step runs. */
  stream: (side: Side, phase: FeedPhase) => void;
}
interface MissionPlan {
  preset: 'challenge' | 'match' | 'boss';
  context: GameContext;
  label: string;
  outcome: 'success' | 'failure';
  crew: [string, string][];
}
interface Step {
  actor: string;
  /** Which channel is on screen for this step. */
  side: Side;
  /** What each channel is doing while this step is next: [alpha, receiver]. */
  status: [string, string];
  title: string;
  body: string;
  proof: string;
  /** The receiver reads the inheritance dossier before this step runs. */
  dossier?: boolean;
  mission?: MissionPlan;
  run?: (context: Context) => Promise<void>;
}

/** Frees a practice captain's dock without deleting anything: worlds are parked, never erased. */
async function clearDock(captain: Captain, context: Context) {
  let snapshot = await state();
  const world = snapshot.world;
  if (!world || world.outcome) return snapshot;
  if (world.handoffPending) {
    const pending = snapshot.handoffs?.find(
      (item) =>
        item.source_id === `sim-${captain}` && ['prepared', 'verified'].includes(item.status),
    );
    if (pending) {
      await request(`/api/handoffs/${pending.id}/cancel`, {});
      context.note(label(captain), 'Cancelled an earlier pending relay');
    }
    snapshot = await state();
  }
  if (snapshot.world && unresolvedMission(snapshot.world))
    throw new Error(
      `${label(captain)} has an unresolved LIVEWIRE mission. Resolve or cancel it on the Livewire dock, then run this step again.`,
    );
  if (snapshot.world) {
    await request(`/api/worlds/${snapshot.world.worldId}/hosting`, { resume: false });
    context.note(label(captain), 'Parked their previous Ark safely in the Hangar');
  }
  return state();
}
async function rehearsalWorld(context: Context) {
  const snapshot = await state();
  if (!snapshot.world || snapshot.world.worldId !== context.progress.worldId)
    throw new Error(
      'The rehearsal Ark is no longer in this dock. Restart the rehearsal to launch a fresh one.',
    );
  return snapshot.world;
}
async function crew(lines: [string, string][], context: Context, tolerated: RegExp) {
  for (const [actor, text] of lines) {
    try {
      await chat(actor, text);
      context.note(actor, text, 'command');
    } catch (error) {
      if (!tolerated.test((error as Error).message)) throw error;
    }
  }
}

/**
 * Opens, crews, locks and attests one LIVEWIRE mission for the signed-in captain. Re-running a
 * step resumes from the saved mission instead of opening a second one.
 */
async function playMission(context: Context, side: Side, plan: MissionPlan) {
  const captain = side === 'alpha' ? 'alpha' : context.progress.receiver;
  await login(captain);
  let world = await rehearsalWorld(context);
  if (!world.livewire?.enabled) {
    context.note(
      'Engine',
      'LIVEWIRE is switched off on this deployment; the relay continues without it',
      'result',
    );
    return;
  }
  const game = gameContexts[plan.context].name;
  let stake = world.livewire.stake;
  if (
    !stake ||
    stake.chapter !== world.chapter ||
    ['cancelled', 'expired'].includes(stake.status)
  ) {
    world = (await mission(world, { type: 'open', preset: plan.preset, game, label: plan.label }))
      .world!;
    stake = world.livewire!.stake!;
    context.note(
      label(captain),
      `Opened a LIVEWIRE mission · ${game} · ${plan.label} · 1 supply spent`,
    );
  }
  if (stake.status === 'open') {
    await crew(plan.crew, context, /window|closed|not open|unavailable/i);
    world = await rehearsalWorld(context);
    world = (await mission(world, { type: 'lock', stakeId: stake.id })).world!;
    stake = world.livewire!.stake!;
    const ballots = (stake.tallies ?? [0, 0, 0]).reduce((a, b) => a + b, 0);
    context.note(
      label(captain),
      `Locked ${stake.target} before the attempt · ${ballots} crew ballots`,
      'result',
    );
  }
  if (stake.status === 'locked') {
    context.stream(side, 'attempt');
    await pause(2100);
    world = await rehearsalWorld(context);
    world = (await mission(world, { type: 'resolve', stakeId: stake.id, outcome: plan.outcome }))
      .world!;
    stake = world.livewire!.stake!;
  }
  if (stake.status !== 'success' && stake.status !== 'failure')
    throw new Error(`The mission ended as ${stake.status}. Restart the rehearsal for a fresh Ark.`);
  const target = stake.target!;
  const option = stake.options.find((item) => item.target === target)!;
  const record: MissionRecord = {
    game: stake.game,
    label: stake.label,
    target,
    outcome: stake.status,
    delta: option[stake.status],
  };
  context.stream(side, record.outcome === 'success' ? 'win' : 'loss');
  context.save({ missions: { ...context.progress.missions, [side]: record } });
  context.note(
    label(captain),
    `Attested ${record.outcome} · streamer-confirmed, not read from the game`,
    'evidence',
  );
  context.note(
    'Engine',
    `${record.target} ${record.delta > 0 ? '+' : ''}${record.delta} saved to the same Ark`,
    'result',
  );
}

const steps: Step[] = [
  {
    actor: 'CAPTAIN · SIMULATION ALPHA',
    side: 'alpha',
    status: ['ON AIR · TAKING COMMAND', 'ON AIR · NO ARK YET'],
    title: 'Alpha takes command of a fresh Ark',
    body: 'Practice captain alpha launches ARK—001: 216 passengers, five chapters. Any Ark alpha was already flying is parked in the Hangar, never deleted.',
    proof: 'POST /api/simulator/login · POST /api/worlds',
    run: async (context) => {
      await login('alpha');
      context.note(label('alpha'), 'Signed in as practice captain alpha');
      const current = (await state()).world;
      const reusable =
        current &&
        !current.outcome &&
        current.chapter === 0 &&
        current.phase === 'ready' &&
        !current.handoffPending &&
        !unresolvedMission(current);
      if (!reusable) {
        await clearDock('alpha', context);
        await request('/api/worlds', {});
      }
      const launched = (await state()).world!;
      context.save({ worldId: launched.worldId, handoffId: null });
      context.note(label('alpha'), 'Launched the Ark · 216 passengers aboard', 'result');
    },
  },
  {
    actor: 'ALPHA STREAMS MINECRAFT · LIVEWIRE',
    side: 'alpha',
    status: ['ON AIR · MISSION OPEN', 'ON AIR · NO ARK YET'],
    title: 'Chat stakes the hull on one Minecraft jump',
    body: 'Alpha never leaves their own game. Chat picks which Ark system rides on the next attempt and the choice locks before the jump. The jump fails, alpha attests it, and the hull keeps the damage.',
    proof: 'POST /api/worlds/:id/livewire · open → lock → streamer-attested resolve',
    mission: {
      preset: 'challenge',
      context: 'voxel',
      label: 'LAVA GAP JUMP',
      outcome: 'failure',
      crew: [
        ['nova', '!stake 2'],
        ['quill', '!stake hull'],
        ['rook', '!stake 2'],
      ],
    },
  },
  {
    actor: "ALPHA'S CREW · SIMULATED CHAT",
    side: 'alpha',
    status: ['ON AIR · CHAPTER 1', 'ON AIR · NO ARK YET'],
    title: 'The crew solves the shield relay',
    body: 'Viewers scan relays to reveal clues, then route power around the unsafe relay. Solving it is not a vote: it repairs the shields and returns hull and power.',
    proof: 'POST /api/simulator/commands · same parser as Twitch chat',
    run: async (context) => {
      let world = await rehearsalWorld(context);
      if (world.chapter === 0 && world.phase === 'ready') {
        world = (await command(world, { type: 'start' })).world!;
        context.note(label('alpha'), 'Started chapter 1 · Radiation Storm');
      }
      if (world.chapter !== 1) return;
      await crew(
        [
          ['nova', '!scan A'],
          ['quill', '!scan C'],
          ['rook', '!scan B'],
          ['nova', '!route S A C T'],
        ],
        context,
        /already (known|applied)|challenge window is closed/i,
      );
      context.note(
        'Engine',
        'Shields restored by the crew: +15 hull, +10 power, recorded once',
        'result',
      );
    },
  },
  {
    actor: "ALPHA'S CREW ADVISES · CAPTAIN COMMITS",
    side: 'alpha',
    status: ['ON AIR · CHAPTER 1', 'ON AIR · NO ARK YET'],
    title: 'Alpha sacrifices navigation to save everyone',
    body: 'The radiation storm forces a choice. The crew votes; the captain commits. Burning navigation saves all 216 passengers and saves a debt for whoever flies chapter two.',
    proof: 'POST /api/worlds/:id/commands · commit burn-navigation',
    run: async (context) => {
      let world = await rehearsalWorld(context);
      if (world.chapter !== 1 || world.phase === 'ready') return;
      if (world.phase === 'challenge') {
        world = (await command(world, { type: 'close-challenge' })).world!;
        context.note(label('alpha'), 'Opened the survival decision');
      }
      await crew(
        [
          ['nova', '!vote 1'],
          ['quill', '!vote 1'],
          ['rook', '!vote 2'],
          ['vega', '!vote 1'],
        ],
        context,
        /voting is not open/i,
      );
      world = await rehearsalWorld(context);
      await command(world, { type: 'commit', option: 'burn-navigation' });
      context.note(label('alpha'), 'Committed · Sacrifice navigation (3 of 4 crew advised it)');
      context.note(
        'Engine',
        'Navigation destroyed · 216 survive · blind-jump debt saved for chapter 2',
        'result',
      );
    },
  },
  {
    actor: 'CAPTAIN · RECEIVING COMMUNITY',
    side: 'receiver',
    status: ['ON AIR · CHAPTER 1 DONE', 'OPTING IN TO RECEIVE'],
    title: 'Another community opts in to receive',
    body: 'Nobody can push a world onto a channel. The receiving captain has to opt in, and their dock must be free. A playable Ark of theirs is parked, never overwritten.',
    proof: 'POST /api/receive-opt-in',
    run: async (context) => {
      const receiver = context.progress.receiver;
      await login(receiver);
      context.note(label(receiver), `Signed in as practice captain ${receiver}`);
      await clearDock(receiver, context);
      await request('/api/receive-opt-in', { enabled: true });
      context.note(label(receiver), 'Accepts incoming world offers', 'result');
    },
  },
  {
    actor: 'CAPTAIN · SIMULATION ALPHA',
    side: 'alpha',
    status: ['PREPARING THE RELAY', 'OPTED IN · WAITING'],
    title: 'Alpha prepares the relay before raiding',
    body: 'Alpha names the receiver at a finished chapter boundary. The Ark freezes until the raid is verified and accepted, the receiver declines, or the offer expires.',
    proof: 'POST /api/handoffs',
    run: async (context) => {
      await login('alpha');
      const snapshot = await state();
      const world = await rehearsalWorld(context);
      const target = `sim-${context.progress.receiver}`;
      const open = snapshot.handoffs?.find(
        (item) =>
          item.world_id === world.worldId &&
          item.target_id === target &&
          ['prepared', 'verified'].includes(item.status),
      );
      const intent =
        open ??
        (await request<HandoffView>('/api/handoffs', {
          worldId: world.worldId,
          targetId: target,
          expectedVersion: world.worldVersion,
        }));
      context.save({ handoffId: intent.id });
      context.note(
        label('alpha'),
        `Prepared a relay to ${label(context.progress.receiver)} · Ark frozen`,
        'result',
      );
    },
  },
  {
    actor: 'TWITCH RAID · SIMULATED EVIDENCE',
    side: 'alpha',
    status: ['RAIDING · ARK FROZEN', 'RAID INCOMING'],
    title: 'The raid lands',
    body: 'Live custody moves only on Twitch’s signed channel.raid notification. Here a labeled practice proof stands in. The server rejects this proof for any live world.',
    proof: 'POST /api/handoffs/:id/simulate-raid · simulation mode only',
    run: async (context) => {
      if (!context.progress.handoffId) throw new Error('Prepare the relay first.');
      await login('alpha');
      await request(`/api/handoffs/${context.progress.handoffId}/simulate-raid`, {});
      context.note(
        'Simulated evidence',
        `channel.raid alpha → ${context.progress.receiver} recorded as practice-only proof`,
        'evidence',
      );
    },
  },
  {
    actor: 'CAPTAIN · RECEIVING COMMUNITY',
    side: 'receiver',
    status: ['RAIDED · AWAITING ACCEPTANCE', 'RAID LANDED · OFFER WAITING'],
    title: 'The receiver accepts the inherited Ark',
    body: 'Acceptance moves custody in one transaction: the same passengers, scars, debts and history. A duplicate or late proof cannot move it twice.',
    proof: 'POST /api/handoffs/:id/accept',
    run: async (context) => {
      if (!context.progress.handoffId) throw new Error('Prepare the relay first.');
      const receiver = context.progress.receiver;
      await login(receiver);
      await request(`/api/handoffs/${context.progress.handoffId}/accept`, {});
      context.note(
        label(receiver),
        'Accepted the inherited Ark · custody committed once',
        'result',
      );
    },
  },
  {
    actor: 'RECEIVER STREAMS ROCKET LEAGUE · LIVEWIRE',
    side: 'receiver',
    status: ['ARK HANDED ON', 'ON AIR · NEW CAPTAIN'],
    dossier: true,
    title: 'A different game repairs the same Ark',
    body: "Read the dossier first: it names who decided what. Then the new captain goes back to their own game. Their chat stakes the hull alpha's crew cracked on one aerial goal; it scores, and the repair lands on that same hull.",
    proof: "POST /api/worlds/:id/livewire · the new captain's own mission",
    mission: {
      preset: 'match',
      context: 'rocket',
      label: 'AERIAL GOAL',
      outcome: 'success',
      crew: [
        ['orbit', '!stake 2'],
        ['nova', '!stake hull'],
        ['lumen', '!vote 2'],
      ],
    },
  },
  {
    actor: 'CAPTAIN · RECEIVING COMMUNITY',
    side: 'receiver',
    status: ['ARK HANDED ON', 'ON AIR · CHAPTER 2'],
    title: "Alpha's decision becomes their crisis",
    body: "Starting chapter two applies the saved debt. Navigation is gone, so this community faces the Blind Jump that alpha's sacrifice created.",
    proof: 'POST /api/worlds/:id/commands · start',
    run: async (context) => {
      const receiver = context.progress.receiver;
      await login(receiver);
      const world = await rehearsalWorld(context);
      if (world.chapter === 1 && world.phase === 'ready') {
        await command(world, { type: 'start' });
        context.note(label(receiver), 'Started chapter 2');
      }
      const after = await rehearsalWorld(context);
      context.note(
        'Engine',
        `${after.title} · caused by Simulation alpha's “Sacrifice navigation”`,
        'result',
      );
    },
  },
  {
    actor: 'THE CHRONICLE',
    side: 'receiver',
    status: ['ARK HANDED ON', 'ON AIR · CHAPTER 2'],
    title: 'Trace the lineage across both communities',
    body: 'The Chronicle links every consequence to the earlier decision that caused it, records both LIVEWIRE missions and keeps the custody change between the two crews.',
    proof: 'GET /api/worlds/:id/history',
  },
];

for (const item of steps)
  if (item.mission && !item.run) {
    const plan = item.mission;
    const side = item.side;
    item.run = (context) => playMission(context, side, plan);
  }
const DOSSIER_STEP = steps.findIndex((item) => item.dossier);

/**
 * The two channels side by side. Each keeps its own game on screen; the panel of the channel
 * whose captain acts next is live, the other holds still. Saved mission results stay pinned to
 * the channel that attested them.
 */
function RelayStreams({
  progress,
  live,
  motion,
}: {
  progress: Progress;
  live: { side: Side; phase: FeedPhase } | null;
  motion: boolean;
}) {
  const step = steps[progress.step];
  const channels: { side: Side; captain: Captain; context: GameContext; status: string }[] = [
    { side: 'alpha', captain: 'alpha', context: 'voxel', status: step.status[0] },
    { side: 'receiver', captain: progress.receiver, context: 'rocket', status: step.status[1] },
  ];
  return (
    <div className="relay-streams" aria-label="Both practice channels">
      {channels.map((channel, index) => {
        const active = live ? live.side === channel.side : step.side === channel.side;
        const phase: FeedPhase = motion && live?.side === channel.side ? live.phase : 'idle';
        const result = progress.missions[channel.side];
        return (
          <figure
            key={channel.side}
            className={`relay-stream ${active ? 'relay-stream--live' : ''}`}
            data-side={channel.side}
          >
            <figcaption>
              <span>
                CHANNEL {index ? 'B' : 'A'} · {label(channel.captain).toUpperCase()}
              </span>
              <b>{gameContexts[channel.context].name.toUpperCase()}</b>
              <em>{channel.status}</em>
            </figcaption>
            <div className="relay-feed">
              <GameFeed
                context={channel.context}
                phase={phase}
                reducedMotion={!motion || !active}
              />
              <small>ILLUSTRATIVE FEED · NOT GAME TELEMETRY</small>
              {result && (
                <p
                  className={`relay-result relay-result--${result.outcome}`}
                  data-outcome={result.outcome}
                >
                  <b>
                    {result.label} · {result.outcome === 'success' ? 'SUCCESS' : 'FAILURE'}
                  </b>
                  <span>
                    {result.target.toUpperCase()} {result.delta > 0 ? '+' : ''}
                    {result.delta} · STREAMER-ATTESTED · SAVED TO ARK—001
                  </span>
                </p>
              )}
            </div>
          </figure>
        );
      })}
    </div>
  );
}

function readProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (raw && typeof raw.step === 'number' && Array.isArray(raw.log))
      return {
        ...fresh(raw.receiver === 'gamma' ? 'gamma' : 'beta'),
        ...raw,
        missions: raw.missions && typeof raw.missions === 'object' ? raw.missions : {},
        step: Math.max(0, Math.min(steps.length - 1, raw.step)),
      };
  } catch {
    /* Private browsing or a corrupt entry starts a new rehearsal. */
  }
  return fresh();
}

export function Rehearsal({ setMode }: { setMode: (mode: Mode) => void }) {
  const { data, canonical, busy, perform, setArchiveWorld, preferences } = useGame();
  const [progress, setProgress] = useState<Progress>(readProgress);
  const [failure, setFailure] = useState('');
  const [auto, setAuto] = useState(false);
  const [feed, setFeed] = useState<{ side: Side; phase: FeedPhase } | null>(null);
  const live = useRef(progress);
  live.current = progress;
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      /* Progress is a convenience; the saved world is the record. */
    }
  }, [progress]);
  const step = steps[progress.step];
  const finished = progress.step === steps.length - 1;
  const handoff = data?.handoffs?.find((item) => item.id === progress.handoffId);
  const run = (index = progress.step) =>
    perform(async () => {
      const target = steps[index];
      if (!target.run) return;
      setFailure('');
      setFeed(null);
      let patch: Partial<Progress> = {};
      // The transcript fills in as each request lands, so a long step never looks stalled.
      const context: Context = {
        progress: live.current,
        note: (actor, text, tone = 'command') =>
          setProgress((current) => ({
            ...current,
            log: [...current.log, { actor, text, tone }].slice(-40),
          })),
        save: (next) => {
          patch = { ...patch, ...next };
          context.progress = { ...context.progress, ...next };
        },
        stream: (side, phase) => setFeed({ side, phase }),
      };
      try {
        await target.run(context);
        setProgress((current) => ({
          ...current,
          ...patch,
          step: Math.min(steps.length - 1, index + 1),
        }));
      } catch (error) {
        setAuto(false);
        setProgress((current) => ({ ...current, ...patch }));
        setFailure((error as Error).message);
      }
    });
  // Autoplay walks the relay up to the moment the receiver reads the dossier, then stops so a
  // person sees the inherited consequence before the next chapter applies it.
  useEffect(() => {
    if (!auto || busy || failure) return;
    if (progress.step >= DOSSIER_STEP) {
      setAuto(false);
      return;
    }
    const timer = setTimeout(() => void run(progress.step), 900);
    return () => clearTimeout(timer);
  }, [auto, busy, failure, progress.step]);
  const restart = (receiver: Progress['receiver']) => {
    setAuto(false);
    setFailure('');
    setFeed(null);
    setProgress(fresh(receiver));
  };
  const dossierWorld = progress.step === DOSSIER_STEP && canonical?.arrival ? canonical : null;
  const transcript = useRef<HTMLOListElement>(null);
  useEffect(() => {
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight });
  }, [progress.log.length]);
  return (
    <section className="rehearsal" aria-label="Relay rehearsal">
      <div
        className={`sim-stage rehearsal-stage ${dossierWorld ? 'rehearsal-stage--dossier' : ''}`}
        data-step={progress.step + 1}
      >
        {/* While the dossier waits to be read it takes the panel; the feeds return when the new captain acts. */}
        {!dossierWorld && (
          <RelayStreams progress={progress} live={feed} motion={preferences.motion} />
        )}
        <div className="rehearsal-copy">
          <div className="rehearsal-head">
            <div className="sim-orbit">
              <span>{String(progress.step + 1).padStart(2, '0')}</span>
              <i />
            </div>
            <div>
              <span className="rehearsal-actor">{step.actor}</span>
              <span className="eyebrow">
                STEP {progress.step + 1} OF {steps.length}
              </span>
            </div>
          </div>
          <strong>{step.title}</strong>
          <p>{step.body}</p>
          <code className="rehearsal-proof">{step.proof}</code>
          {handoff && ['prepared', 'verified'].includes(handoff.status) && (
            <p className="rehearsal-expiry" role="status">
              Relay {handoff.status} · expires {new Date(handoff.expires_at).toLocaleTimeString()}
            </p>
          )}
          {failure && (
            <p className="rehearsal-error" role="alert">
              {failure}
            </p>
          )}
          <div className="rehearsal-actions">
            {step.run ? (
              <Button
                className="platform-primary"
                disabled={busy}
                onClick={() => {
                  setAuto(false);
                  void run();
                }}
              >
                {busy ? 'RUNNING…' : `RUN STEP ${progress.step + 1}`}
                <Icon name="chevron" />
              </Button>
            ) : (
              <Button
                className="platform-primary"
                onClick={() => {
                  setArchiveWorld(null);
                  setMode('archive');
                }}
              >
                OPEN THE CHRONICLE
                <Icon name="chevron" />
              </Button>
            )}
            {progress.step < DOSSIER_STEP && (
              <Button disabled={busy || auto} onClick={() => setAuto(true)}>
                {auto ? 'AUTOPLAYING…' : 'AUTOPLAY TO THE HANDOFF'}
              </Button>
            )}
            {progress.step >= DOSSIER_STEP && (
              <Button onClick={() => setMode('mission')}>OPEN MISSION CONTROL</Button>
            )}
          </div>
        </div>
        {dossierWorld && <ArrivalDossier world={dossierWorld} vitals />}
      </div>
      <ol className="sim-path rehearsal-path">
        {steps.map((item, index) => (
          <li key={item.title}>
            <Button
              className={
                index === progress.step ? 'active' : index < progress.step || finished ? 'done' : ''
              }
              disabled={busy || index > progress.step}
              onClick={() => {
                setFailure('');
                setProgress((current) => ({ ...current, step: index }));
              }}
            >
              <b>{String(index + 1).padStart(2, '0')}</b>
              <span>{item.title}</span>
              <small>
                {index < progress.step ? 'SAVED' : index === progress.step ? 'NEXT' : 'AHEAD'} ·{' '}
                {item.actor}
              </small>
            </Button>
          </li>
        ))}
      </ol>
      <aside className="sim-disclosure rehearsal-log">
        <span>RELAY TRANSCRIPT</span>
        <div className="rehearsal-identity">
          <b>SIGNED IN AS</b>
          <p>{data?.me?.label ?? 'No practice captain'}</p>
        </div>
        <ol aria-live="polite" ref={transcript}>
          {progress.log.length ? (
            progress.log.map((line, index) => (
              <li key={index} data-tone={line.tone}>
                <b>{line.actor}</b>
                <span>{line.text}</span>
              </li>
            ))
          ) : (
            <li data-tone="result">
              <b>Ready</b>
              <span>Nothing has run yet. Each step writes real saved state.</span>
            </li>
          )}
        </ol>
        <div className="rehearsal-restart">
          <b>REAL VS SIMULATED</b>
          <p>
            Real: engine, PostgreSQL, authority and custody checks. Simulated: practice identities,
            chat lines and the labeled raid proof.
          </p>
          <Button disabled={busy} onClick={() => restart('beta')}>
            Restart with Simulation beta
          </Button>
          <Button disabled={busy} onClick={() => restart('gamma')}>
            Restart with Simulation gamma
          </Button>
        </div>
      </aside>
    </section>
  );
}
