import { mkdir, writeFile } from 'node:fs/promises';
import { applyCommand, createWorld, previewChoices, replayEvents } from '@torchline/engine';
import { CURRENT_RULES_VERSION } from '@torchline/contracts';
import type { Command, WorldEvent, WorldState } from '@torchline/contracts';
import { isDeepStrictEqual } from 'node:util';

function journey(viewerPatch: boolean) {
  let state = createWorld('readme-demonstration', CURRENT_RULES_VERSION);
  const events: WorldEvent[] = [];
  const timeline: (string | number)[][] = [];
  const act = (command: Command, viewer = false) => {
    const result = applyCommand(
      state,
      command,
      {
        id: viewer ? 'example-viewer' : 'example-captain',
        role: viewer ? 'viewer' : 'host',
        community: 'Example community',
      },
      { commandId: `readme-${state.version + 1}`, at: '2026-10-28T10:00:00.000Z' },
    );
    state = result.state;
    events.push(result.event);
    timeline.push([
      state.version,
      state.chapter,
      command.type,
      viewer ? 'viewer' : 'captain',
      result.event.summary,
      ...(['passengers', 'hull', 'power', 'oxygen', 'navigation', 'supplies'] as const).map(
        (id) => state.resources[id],
      ),
      state.outcome ?? 'ongoing',
    ]);
  };
  let chapterOne;
  for (const option of [
    'burn-navigation',
    'manual-flight',
    'seal-cabins',
    'jettison',
    'emergency-burn',
  ]) {
    act({ type: 'start' });
    if (state.outcome) break;
    if (viewerPatch && state.chapter === 3) {
      act({ type: 'scan', node: 'A' }, true);
      act({ type: 'patch', node: 'A' }, true);
    }
    act({ type: 'close-challenge' });
    act({ type: 'commit', option });
    if (state.chapter === 1) chapterOne = structuredClone(state);
    if (state.outcome) break;
  }
  if (!isDeepStrictEqual(state, replayEvents(state.id, events, CURRENT_RULES_VERSION)))
    throw new Error('README witness did not replay.');
  return { state, chapterOne, timeline, replayVerified: true };
}
const without = journey(false),
  withPatch = journey(true);
let seal = createWorld('readme-opening', CURRENT_RULES_VERSION);
for (const command of [
  { type: 'start' },
  { type: 'close-challenge' },
  { type: 'commit', option: 'seal-habitat' },
] as Command[])
  seal = applyCommand(
    seal,
    command,
    { id: 'example-captain', role: 'host', community: 'Example community' },
    { commandId: `opening-${seal.version + 1}`, at: '2026-10-28T10:00:00.000Z' },
  ).state;
if (without.state.outcome !== 'wreck' || withPatch.state.outcome !== 'partial')
  throw new Error('README counterfactual changed; review the copy before publishing.');

// The README's "captain's chair": both chapter-one commitments and both chapter-two answers to
// the crisis each one leaves behind, with no viewer repairs, exactly as the engine computes them.
let step = 0;
const captain = (state: WorldState, command: Command) =>
  applyCommand(
    state,
    command,
    { id: 'example-captain', role: 'host', community: 'Example community' },
    { commandId: `chair-${++step}`, at: '2026-10-28T10:00:00.000Z' },
  ).state;
const snapshot = (state: WorldState) => ({
  crisis: state.crisis,
  resources: state.resources,
  lost: Object.entries(state.systems)
    .filter(([, system]) => ['destroyed', 'sealed'].includes(system.condition))
    .map(([id, system]) => `${id} ${system.condition}`),
  debts: state.obligations
    .filter((debt) => debt.status === 'pending')
    .map((debt) => `${debt.kind} due chapter ${debt.dueChapter}`),
});
const storm = captain(
  captain(createWorld('readme-chair', CURRENT_RULES_VERSION), { type: 'start' }),
  {
    type: 'close-challenge',
  },
);
const captainChair = previewChoices(storm).map((first) => {
  const committed = captain(storm, { type: 'commit', option: first.id });
  const next = captain(committed, { type: 'start' });
  const decision = captain(next, { type: 'close-challenge' });
  return {
    option: first.id,
    label: first.label,
    after: snapshot(committed),
    next: {
      ...snapshot(next),
      options: previewChoices(decision).map((second) => ({
        option: second.id,
        label: second.label,
        after: snapshot(captain(decision, { type: 'commit', option: second.id })),
      })),
    },
  };
});
const summarize = (result: ReturnType<typeof journey>) => ({
  outcome: result.state.outcome,
  chapter: result.state.chapter,
  resources: result.state.resources,
  reason: result.state.endingReason,
  replayVerified: result.replayVerified,
});
await mkdir('assets/readme', { recursive: true });
await writeFile(
  'assets/readme/proof.json',
  JSON.stringify(
    {
      source: 'Deterministic engine execution, not a live Twitch session',
      rulesVersion: CURRENT_RULES_VERSION,
      policy:
        'No allocation or route rewards; same planned captain route. Without the repair the Ark ends on chapter-5 arrival before its final burn. One viewer adds scan A and patch A in chapter 3.',
      captainChoices: [
        'burn-navigation',
        'manual-flight',
        'seal-cabins',
        'jettison',
        'emergency-burn',
      ],
      withoutViewerRepair: summarize(without),
      withViewerRepair: summarize(withPatch),
      firstChoice: {
        burnNavigation: {
          resources: without.chapterOne!.resources,
          condition: without.chapterOne!.systems.navigation.condition,
        },
        sealHabitat: { resources: seal.resources, condition: seal.systems.habitat.condition },
      },
      captainChair,
    },
    null,
    2,
  ) + '\n',
);
const rows: (string | number)[][] = [
  [
    'sequence',
    'chapter',
    'action',
    'role',
    'event',
    'passengers',
    'hull',
    'power',
    'oxygen',
    'navigation',
    'supplies',
    'outcome',
  ],
  ...withPatch.timeline,
];
await writeFile(
  'assets/readme/flight-log.csv',
  rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n') + '\n',
);
console.log(
  JSON.stringify(
    {
      withoutRepair: summarize(without),
      withRepair: summarize(withPatch),
      firstChoice: { burn: without.chapterOne!.resources, seal: seal.resources },
    },
    null,
    2,
  ),
);
