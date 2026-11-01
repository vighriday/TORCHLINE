import { useEffect, useRef, useState } from 'react';
import type { Command, WorldPresentation } from '@torchline/contracts';
import { request } from '../api.ts';
import type { DashboardSnapshot, HandoffView } from '../api.ts';
import { Button, Icon } from './primitives.tsx';
import { useGame } from './session.tsx';
import { ArrivalDossier } from './Dossier.tsx';
import type { Mode } from './types.ts';

// A guided two-community relay for judges and new creators. Every step calls the same public
// endpoints the dashboard uses, as the named practice identity, so the engine, PostgreSQL
// transactions and custody rules decide each outcome. Only the raid proof is simulated, and the
// server refuses that proof for live worlds.
type Captain = 'alpha' | 'beta' | 'gamma';
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
  log: Line[];
}
const STORAGE_KEY = 'torchline:relay-rehearsal:v1';
const fresh = (receiver: Progress['receiver'] = 'beta'): Progress => ({
  step: 0,
  receiver,
  worldId: null,
  handoffId: null,
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
const unresolvedMission = (world: WorldPresentation) =>
  !!world.livewire?.stake && ['open', 'paused', 'locked'].includes(world.livewire.stake.status);

interface Context {
  progress: Progress;
  note: (actor: string, text: string, tone?: Line['tone']) => void;
  save: (patch: Partial<Progress>) => void;
}
interface Step {
  actor: string;
  title: string;
  body: string;
  proof: string;
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

const steps: Step[] = [
  {
    actor: 'CAPTAIN · SIMULATION ALPHA',
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
    actor: "ALPHA'S CREW · SIMULATED CHAT",
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
    actor: 'CAPTAIN · RECEIVING COMMUNITY',
    title: "Alpha's decision becomes their crisis",
    body: 'Read the dossier first: it names who decided what. Starting chapter two applies the saved debt. Navigation is gone, so this community faces the Blind Jump.',
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
    title: 'Trace the lineage across both communities',
    body: 'The Chronicle links every consequence to the earlier decision that caused it and records the custody change between the two crews.',
    proof: 'GET /api/worlds/:id/history',
  },
];

function readProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (raw && typeof raw.step === 'number' && Array.isArray(raw.log))
      return {
        ...fresh(raw.receiver === 'gamma' ? 'gamma' : 'beta'),
        ...raw,
        step: Math.max(0, Math.min(steps.length - 1, raw.step)),
      };
  } catch {
    /* Private browsing or a corrupt entry starts a new rehearsal. */
  }
  return fresh();
}

export function Rehearsal({ setMode }: { setMode: (mode: Mode) => void }) {
  const { data, canonical, busy, perform, setArchiveWorld } = useGame();
  const [progress, setProgress] = useState<Progress>(readProgress);
  const [failure, setFailure] = useState('');
  const [auto, setAuto] = useState(false);
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
      const pending: Line[] = [];
      let patch: Partial<Progress> = {};
      const context: Context = {
        progress: live.current,
        note: (actor, text, tone = 'command') => pending.push({ actor, text, tone }),
        save: (next) => {
          patch = { ...patch, ...next };
          context.progress = { ...context.progress, ...next };
        },
      };
      try {
        await target.run(context);
        setProgress((current) => ({
          ...current,
          ...patch,
          step: Math.min(steps.length - 1, index + 1),
          log: [...current.log, ...pending].slice(-40),
        }));
      } catch (error) {
        setAuto(false);
        setProgress((current) => ({
          ...current,
          ...patch,
          log: [...current.log, ...pending].slice(-40),
        }));
        setFailure((error as Error).message);
      }
    });
  // Autoplay walks the relay up to the moment the receiver reads the dossier, then stops so a
  // person sees the inherited consequence before the next chapter applies it.
  useEffect(() => {
    if (!auto || busy || failure) return;
    if (progress.step >= 7) {
      setAuto(false);
      return;
    }
    const timer = setTimeout(() => void run(progress.step), 900);
    return () => clearTimeout(timer);
  }, [auto, busy, failure, progress.step]);
  const restart = (receiver: Progress['receiver']) => {
    setAuto(false);
    setFailure('');
    setProgress(fresh(receiver));
  };
  const dossierWorld = progress.step === 7 && canonical?.arrival ? canonical : null;
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
            {progress.step < 7 && (
              <Button disabled={busy || auto} onClick={() => setAuto(true)}>
                {auto ? 'AUTOPLAYING…' : 'AUTOPLAY TO THE HANDOFF'}
              </Button>
            )}
            {progress.step >= 7 && (
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
