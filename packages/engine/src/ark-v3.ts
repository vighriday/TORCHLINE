import {
  CommandSchema,
  DomainError,
  CURRENT_RULES_VERSION as RULES_VERSION,
  SYSTEM_IDS,
} from '@torchline/contracts';
import type {
  Actor,
  ChallengeState,
  ChoicePresentation,
  Command,
  Ending,
  PhysicalMark,
  PuzzleGraph,
  ResourceId,
  Resources,
  ShipSystem,
  SystemCondition,
  SystemId,
  WorldEvent,
  WorldState,
} from '@torchline/contracts';

export const INITIAL_RESOURCES: Resources = {
  passengers: 216,
  hull: 80,
  power: 60,
  oxygen: 65,
  navigation: 70,
  supplies: 50,
};
export const TITLES = [
  'The Ark Protocol',
  'Radiation Storm',
  'The Blind Jump',
  'Life Support Rupture',
  'The Colony Debt',
  'Atmospheric Entry',
];
/** Largest-remainder apportionment. Audience size never increases the declared budget. */
export function normalizeAllocation(
  preferences: Record<string, { hull: number; oxygen: number }>,
  budget: number,
) {
  const total = Object.values(preferences).reduce(
    (sum, item) => ({ hull: sum.hull + item.hull, oxygen: sum.oxygen + item.oxygen }),
    { hull: 0, oxygen: 0 },
  );
  const weight = total.hull + total.oxygen;
  if (!weight || !budget) return { hull: 0, oxygen: 0 };
  const hull = Math.floor((budget * total.hull) / weight);
  const oxygen = Math.floor((budget * total.oxygen) / weight);
  const remainder = budget - hull - oxygen;
  return remainder
    ? (budget * total.hull) % weight >= (budget * total.oxygen) % weight
      ? { hull: hull + remainder, oxygen }
      : { hull, oxygen: oxygen + remainder }
    : { hull, oxygen };
}
const freshChallenge = (): ChallengeState => ({
  scanned: [],
  solved: false,
  tasks: [],
  contributions: {},
  rewardEventId: null,
});
const fail = (code: string, message: string): never => {
  throw new DomainError(code, message);
};
const clamp = (value: number, max = 100) => Math.max(0, Math.min(max, value));
const terminal = (s: WorldState): string | null =>
  s.resources.hull === 0
    ? 'The hull broke apart.'
    : s.resources.oxygen === 0
      ? 'Life support exhausted its oxygen reserve.'
      : s.resources.passengers === 0
        ? 'No passengers survived.'
        : null;

export function createWorld(id: string): WorldState {
  return {
    id,
    rulesVersion: RULES_VERSION,
    version: 0,
    chapter: 0,
    phase: 'ready',
    resumePhase: null,
    window: 0,
    windowOpenedAt: null,
    crisis: '',
    resources: { ...INITIAL_RESOURCES },
    systems: Object.fromEntries(
      SYSTEM_IDS.map((system) => [
        system,
        {
          id: system,
          integrity: system === 'hull' ? 80 : system === 'navigation' ? 70 : 100,
          condition: 'operational',
          marks: [],
          lastEventId: null,
        },
      ]),
    ) as unknown as Record<SystemId, ShipSystem>,
    obligations: [],
    challenge: freshChallenge(),
    votes: {},
    outcome: null,
    endingReason: null,
    cooperation: {
      budget: 0,
      investigation: false,
      inspections: {},
      preferences: {},
      plan: { hull: 0, oxygen: 0 },
      closedByEventId: null,
    },
  };
}

interface Choice {
  id: string;
  label: string;
  description: string;
  cost?: Partial<Resources>;
}
export function getChoices(s: WorldState): Choice[] {
  switch (s.chapter) {
    case 1:
      return [
        {
          id: 'burn-navigation',
          label: 'Sacrifice navigation',
          description:
            'Save every passenger. Lose navigation, ten power and five hull; the next chapter inherits a blind jump.',
          cost: { power: 10 },
        },
        {
          id: 'seal-habitat',
          label: 'Seal the rear habitat',
          description:
            'Preserve navigation. Lose 48 passengers, ten hull and five oxygen; the sealed habitat remains visible.',
        },
      ];
    case 2:
      return s.crisis === 'blind-jump'
        ? [
            {
              id: 'chart-route',
              label: 'Rebuild navigation',
              description: `Restore navigation to sixty. Spend ${s.challenge.solved ? 20 : 25} supplies and fifteen power.`,
              cost: { supplies: s.challenge.solved ? 20 : 25, power: 15 },
            },
            {
              id: 'manual-flight',
              label: 'Fly the debris field manually',
              description: `Keep repair supplies; lose ${s.challenge.solved ? 10 : 25} hull and ten oxygen.`,
            },
          ]
        : [
            {
              id: 'derelict-salvage',
              label: 'Search the derelict',
              description: 'Gain fifteen supplies at a cost of fifteen hull and five power.',
              cost: { power: 5 },
            },
            {
              id: 'bypass',
              label: 'Take the safe corridor',
              description: 'Spend five power to avoid the derelict.',
              cost: { power: 5 },
            },
          ];
    case 3:
      return [
        {
          id: 'repair-life',
          label: 'Restore life support',
          description: `Gain 25 oxygen and stop future leaks. Spend ${s.challenge.solved ? 10 : 20} power.`,
          cost: { power: s.challenge.solved ? 10 : 20 },
        },
        {
          id: 'seal-cabins',
          label: 'Abandon the leaking cabins',
          description:
            'Lose sixty passengers and recover five oxygen. Unrepaired machinery will leak again in chapter four.',
        },
      ];
    case 4:
      return [
        {
          id: 'salvage',
          label: s.challenge.solved ? 'Precision salvage' : 'Risk the cargo station',
          description: s.challenge.solved
            ? 'Gain thirty supplies; lose five hull, with no oxygen loss.'
            : 'Gain thirty supplies; lose fifteen hull and ten oxygen.',
        },
        {
          id: 'jettison',
          label: 'Use cargo to brace the hull',
          description:
            'Spend fifteen supplies, gain fifteen hull and lose five oxygen. Cargo damage persists.',
          cost: { supplies: 15 },
        },
      ];
    case 5:
      return [
        {
          id: 'land',
          label: 'Standard atmospheric entry',
          description: `Lose ${s.resources.navigation >= 40 ? 10 : 25} hull and use up to ten supplies. Navigation below forty makes landing dangerous.`,
        },
        {
          id: 'emergency-burn',
          label: 'Emergency braking burn',
          description: `Spend fifteen power, lose ${s.resources.navigation >= 40 ? 3 : 10} hull and use up to fifteen supplies.`,
          cost: { power: 15 },
        },
      ];
    default:
      return [];
  }
}

const EDGES = [
  { from: 'S', to: 'A', cost: 1 },
  { from: 'S', to: 'B', cost: 2 },
  { from: 'A', to: 'C', cost: 2 },
  { from: 'A', to: 'D', cost: 3 },
  { from: 'B', to: 'C', cost: 1 },
  { from: 'B', to: 'D', cost: 2 },
  { from: 'C', to: 'T', cost: 2 },
  { from: 'D', to: 'T', cost: 1 },
  { from: 'C', to: 'D', cost: 1 },
];
export function puzzleRules(chapter: number) {
  return {
    required: chapter === 2 || chapter === 5 ? 'D' : chapter === 4 ? 'B' : 'C',
    blocked: chapter === 4 ? 'D' : 'B',
    budget: 6,
  };
}
export function routeError(chapter: number, nodes: string[]): string | null {
  const { required, blocked, budget } = puzzleRules(chapter);
  if (nodes.length < 2 || nodes.length > 6 || nodes[0] !== 'S' || nodes.at(-1) !== 'T')
    return 'Connect S to T using at most six distinct nodes.';
  if (new Set(nodes).size !== nodes.length) return 'A route cannot revisit a relay.';
  if (nodes.includes(blocked)) return `Relay ${blocked} is unsafe.`;
  if (!nodes.includes(required)) return `The route must include relay ${required}.`;
  let cost = 0;
  for (let i = 1; i < nodes.length; i++) {
    const edge = EDGES.find(
      (e) =>
        (e.from === nodes[i - 1] && e.to === nodes[i]) ||
        (e.to === nodes[i - 1] && e.from === nodes[i]),
    );
    if (!edge) return 'Those relays are not connected.';
    cost += edge.cost;
  }
  return cost > budget ? `Route cost ${cost} exceeds the ${budget}-unit signal budget.` : null;
}
export function routeSolutions(chapter: number): string[][] {
  const found: string[][] = [];
  const walk = (path: string[]) => {
    if (path.at(-1) === 'T') {
      if (!routeError(chapter, path)) found.push(path);
      return;
    }
    for (const edge of EDGES) {
      const next = edge.from === path.at(-1) ? edge.to : edge.to === path.at(-1) ? edge.from : null;
      if (next && !path.includes(next)) walk([...path, next]);
    }
  };
  walk(['S']);
  return found;
}

export function getPuzzle(s: WorldState): PuzzleGraph | null {
  if (s.chapter < 1 || !['challenge', 'decision', 'paused'].includes(s.phase)) return null;
  const { required, blocked, budget } = puzzleRules(s.chapter);
  const rewards = [
    '',
    'Restore shields: +15 hull, +10 recovered power. Protect later jumps and debris encounters.',
    'Jury-rig navigation: +20 navigation. Unlock cheaper charting and a safer manual route.',
    'Repair A and B, then C. Each task changes resources; all three stop the future leak and halve repair power cost.',
    'Unlock precision salvage: ten less hull damage and no oxygen loss.',
    'Align landing beacons: +15 navigation and +5 hull.',
  ];
  return {
    kind: s.chapter === 3 ? 'work-order' : 'route',
    title: s.chapter === 3 ? 'Cooperative life-support work order' : 'Cooperative relay routing',
    prompt:
      s.chapter === 3
        ? 'Scan faults. Patch A and B in either order, then patch C.'
        : 'Scan relays to reveal clues. Connect S to T within the budget, including the required relay and avoiding the unsafe one.',
    nodes: ['S', 'A', 'B', 'C', 'D', 'T'].map((id) => ({
      id,
      label: id === 'S' ? 'Source' : id === 'T' ? 'Destination' : `Relay ${id}`,
      revealed: ['S', 'T'].includes(id) || s.challenge.scanned.includes(id),
      clue: !s.challenge.scanned.includes(id)
        ? null
        : s.chapter === 3
          ? id === 'A'
            ? 'Valve patch: +4 oxygen.'
            : id === 'B'
              ? 'Structural brace: +4 hull.'
              : id === 'C'
                ? 'Requires A and B. +5 power, +10 oxygen; stop the leak.'
                : 'No fault here.'
          : id === blocked
            ? 'Unsafe: exclude this relay.'
            : id === required
              ? 'Required safety waypoint.'
              : 'Relay available.',
      patched: s.challenge.tasks.includes(id),
    })),
    edges: EDGES,
    budget,
    requiredNode: s.challenge.scanned.includes(required) ? required : null,
    blockedNode: s.challenge.scanned.includes(blocked) ? blocked : null,
    scanned: s.challenge.scanned,
    solved: s.challenge.solved,
    tasks: s.challenge.tasks,
    reward: rewards[s.chapter],
  };
}

export function applyCommand(
  previous: WorldState,
  rawCommand: Command,
  actor: Actor,
  context: { commandId: string; at: string },
): { state: WorldState; event: WorldEvent } {
  if (previous.rulesVersion !== RULES_VERSION)
    fail('RULES_VERSION', 'Unsupported immutable world rules.');
  const command = CommandSchema.parse(rawCommand);
  if (!actor.id || !actor.community)
    fail('IDENTITY_REQUIRED', 'An identified participant and community are required.');
  if (
    !['inspect', 'allocate', 'scan', 'route', 'patch', 'vote'].includes(command.type) &&
    actor.role !== 'host'
  )
    fail('HOST_REQUIRED', 'Only the current host can do that.');
  if (previous.phase === 'ended')
    fail('WORLD_ENDED', 'This world has ended; its history remains available.');
  const s = structuredClone(previous);
  const co = s.cooperation!;
  const id = `${s.id}:${s.version + 1}`;
  const cues: WorldEvent['cues'] = [];
  const causes: string[] = [];
  let summary = '';
  const mark = (
    system: SystemId,
    kind: PhysicalMark['kind'],
    condition: SystemCondition,
    integrity: number,
  ) => {
    const part = s.systems[system];
    part.condition = condition;
    part.integrity = clamp(integrity);
    part.lastEventId = id;
    part.marks.push({ kind, eventId: id, chapter: s.chapter, community: actor.community });
    cues.push({
      kind:
        kind === 'repair'
          ? 'repair'
          : kind === 'sacrifice' || kind === 'seal' || kind === 'jettison'
            ? 'sacrifice'
            : 'damage',
      systemId: system,
      eventId: id,
    });
  };
  const change = (resource: ResourceId, delta: number) => {
    const cap = resource === 'passengers' ? 216 : resource === 'supplies' ? 999 : 100;
    // Critical damage remains signed until combined commit effects finish. Never revive a
    // clamped wreck by adding a small allocation after lethal overkill.
    s.resources[resource] =
      command.type === 'commit' && ['hull', 'oxygen'].includes(resource)
        ? Math.min(cap, s.resources[resource] + delta)
        : clamp(s.resources[resource] + delta, cap);
    if (resource === 'hull' && delta !== 0)
      mark(
        'hull',
        delta > 0 ? 'repair' : 'damage',
        s.resources.hull === 0 ? 'destroyed' : delta > 0 ? 'repaired' : 'damaged',
        s.resources.hull,
      );
  };
  const nav = (value: number, condition: SystemCondition) => {
    s.resources.navigation = clamp(value);
    mark('navigation', value === 0 ? 'sacrifice' : 'repair', condition, s.resources.navigation);
  };
  const checkTerminal = () => {
    const reason = terminal(s);
    if (reason) {
      s.outcome = 'wreck';
      s.endingReason = reason;
      s.phase = 'ended';
      cues.push({ kind: 'world-ended', eventId: id });
    }
  };
  const obligation = (kind: 'blind-jump' | 'leak' | 'supply-debt', dueChapter: number) =>
    s.obligations.push({
      id: `${id}:${kind}`,
      kind,
      dueChapter,
      originEventId: id,
      status: 'pending',
    });

  if (command.type === 'configure-cooperation') {
    if (!['ready', 'challenge'].includes(s.phase))
      fail('INVALID_PHASE', 'Configure cooperation before allocation opens.');
    if (command.budget > s.resources.power)
      fail('UNAFFORDABLE', 'The repair reserve exceeds available power.');
    co.budget = command.budget;
    co.investigation = command.investigation;
    summary = `The captain reserved up to ${co.budget} power for crew allocation.${co.investigation ? ' Investigation is enabled for the next chapter.' : ''}`;
  } else if (command.type === 'inspect') {
    if (s.phase !== 'investigation') fail('INVALID_PHASE', 'Investigation is closed.');
    co.inspections[actor.id] = command.area;
    summary = 'A crew member updated their investigation priority.';
  } else if (command.type === 'close-investigation') {
    if (s.phase !== 'investigation') fail('INVALID_PHASE', 'Investigation is closed.');
    const counts = { engine: 0, cargo: 0, life: 0 };
    for (const area of Object.values(co.inspections)) counts[area]++;
    const area = (['engine', 'cargo', 'life'] as const).reduce((best, item) =>
      counts[item] > counts[best] ? item : best,
    );
    const rules = puzzleRules(s.chapter);
    const node =
      s.chapter === 3
        ? { engine: 'B', cargo: 'A', life: 'C' }[area]
        : area === 'engine'
          ? rules.required
          : area === 'life'
            ? rules.blocked
            : 'A';
    if (Object.values(counts).some(Boolean)) {
      s.challenge.scanned.push(node);
      s.challenge.contributions[`inspection:${node}`] = Object.keys(co.inspections)
        .sort()
        .find((key) => co.inspections[key] === area)!;
      cues.push({ kind: 'discovery', eventId: id });
    }
    s.phase = 'challenge';
    s.window++;
    s.windowOpenedAt = context.at;
    summary = Object.values(counts).some(Boolean)
      ? `Crew investigation of ${area} revealed relay ${node}; its clue is available to everyone.`
      : 'Investigation ended without a crew priority. All clues remain discoverable.';
  } else if (command.type === 'allocate') {
    if (s.phase !== 'allocation') fail('INVALID_PHASE', 'Allocation is closed.');
    co.preferences[actor.id] = { hull: command.hull, oxygen: command.oxygen };
    co.plan = normalizeAllocation(co.preferences, co.budget);
    summary = 'A crew member updated their bounded repair preference.';
  } else if (command.type === 'close-allocation') {
    if (s.phase !== 'allocation') fail('INVALID_PHASE', 'Allocation is closed.');
    co.plan = normalizeAllocation(co.preferences, co.budget);
    co.closedByEventId = id;
    s.phase = 'decision';
    s.window++;
    s.windowOpenedAt = context.at;
    summary = `Crew repair plan locked: ${co.plan.hull} hull units and ${co.plan.oxygen} oxygen units, within ${co.budget} reserved power.`;
  } else if (command.type === 'close-voting') {
    if (s.phase !== 'decision') fail('INVALID_PHASE', 'Voting is closed.');
    s.phase = 'awaiting-commit';
    s.window++;
    s.windowOpenedAt = null;
    summary = 'Advisory votes are frozen. The captain must explicitly commit a choice.';
  } else if (command.type === 'pause') {
    if (s.phase === 'paused') fail('INVALID_PHASE', 'The episode is already paused.');
    s.resumePhase = s.phase;
    s.phase = 'paused';
    s.window++;
    s.windowOpenedAt = null;
    summary = 'The host paused this episode. No offline resources are consumed.';
  } else if (command.type === 'resume') {
    if (s.phase !== 'paused' || !s.resumePhase)
      fail('INVALID_PHASE', 'This episode is not paused.');
    s.phase = s.resumePhase!;
    s.resumePhase = null;
    s.window++;
    s.windowOpenedAt = context.at;
    summary = 'The host resumed the episode.';
  } else if (command.type === 'start') {
    if (s.phase !== 'ready' || s.chapter >= 5)
      fail('INVALID_PHASE', 'Finish the current chapter before starting another.');
    s.chapter++;
    s.phase = 'challenge';
    s.window++;
    s.windowOpenedAt = context.at;
    s.challenge = freshChallenge();
    s.votes = {};
    co.inspections = {};
    co.preferences = {};
    co.plan = { hull: 0, oxygen: 0 };
    co.closedByEventId = null;
    s.crisis =
      s.chapter === 2
        ? s.resources.navigation === 0
          ? 'blind-jump'
          : 'safe-corridor'
        : ['', 'storm', '', 'rupture', 'colony-debt', 'entry'][s.chapter];
    for (const debt of s.obligations.filter(
      (o) => o.status === 'pending' && o.dueChapter === s.chapter,
    )) {
      const active =
        debt.kind === 'blind-jump'
          ? s.resources.navigation === 0
          : debt.kind === 'leak'
            ? s.systems.lifeSupport.condition === 'damaged'
            : s.resources.supplies < 30;
      debt.status = active ? 'applied' : 'avoided';
      causes.push(debt.originEventId);
    }
    if (s.chapter === 1) change('hull', -10);
    if (s.chapter === 2 && s.crisis === 'blind-jump' && s.systems.shields.condition !== 'repaired')
      change('hull', -10);
    if (s.chapter === 3) {
      change('hull', -10);
      change('oxygen', -25);
      mark('lifeSupport', 'damage', 'damaged', 35);
      obligation('leak', 4);
    }
    if (s.chapter === 4) {
      change('hull', s.systems.shields.condition === 'repaired' ? -5 : -10);
      if (s.systems.lifeSupport.condition === 'damaged') change('oxygen', -15);
    }
    if (s.chapter === 5) change('oxygen', -15);
    if (
      [2, 4].includes(s.chapter) &&
      s.systems.shields.condition === 'repaired' &&
      s.systems.shields.lastEventId
    )
      causes.push(s.systems.shields.lastEventId);
    if (
      s.chapter === 4 &&
      s.systems.lifeSupport.condition === 'repaired' &&
      s.systems.lifeSupport.lastEventId
    )
      causes.push(s.systems.lifeSupport.lastEventId);
    checkTerminal();
    if (!s.outcome && co.investigation) s.phase = 'investigation';
    cues.push({ kind: 'chapter-arrived', eventId: id });
    summary = `${TITLES[s.chapter]}: inherited systems and due consequences applied.`;
  } else {
    if (s.phase === 'paused') fail('PAUSED', 'The host paused participation.');
    if (
      ['scan', 'route', 'patch', 'close-challenge'].includes(command.type) &&
      s.phase !== 'challenge'
    )
      fail('INVALID_PHASE', 'This challenge window is closed.');
    if (command.type === 'scan') {
      if (['S', 'T'].includes(command.node) || s.challenge.scanned.includes(command.node))
        fail('ALREADY_DISCOVERED', 'This relay is already known.');
      s.challenge.scanned.push(command.node);
      s.challenge.contributions[`scan:${command.node}`] = actor.id;
      cues.push({ kind: 'discovery', eventId: id });
      summary = `A crew member uncovered relay ${command.node}.`;
    } else if (command.type === 'route') {
      if (s.chapter === 3) fail('WORK_ORDER_REQUIRED', 'Patch the scanned faults in this chapter.');
      if (s.challenge.solved) fail('ALREADY_SOLVED', 'This challenge reward was already applied.');
      if (command.nodes.slice(1, -1).some((node) => !s.challenge.scanned.includes(node)))
        fail('SCAN_REQUIRED', 'Scan the intermediate relays before using them.');
      const error = routeError(s.chapter, command.nodes);
      if (error) fail('INVALID_ROUTE', error);
      s.challenge.solved = true;
      s.challenge.rewardEventId = id;
      s.challenge.contributions.solution = actor.id;
      if (s.chapter === 1) {
        change('hull', 15);
        change('power', 10);
        mark('shields', 'repair', 'repaired', 100);
      }
      if (s.chapter === 2)
        nav(s.resources.navigation + 20, s.resources.navigation < 40 ? 'jury-rigged' : 'repaired');
      if (s.chapter === 5) {
        nav(s.resources.navigation + 15, s.resources.navigation < 40 ? 'jury-rigged' : 'repaired');
        change('hull', 5);
      }
      cues.push({ kind: 'challenge-solved', eventId: id });
      summary =
        s.chapter === 4
          ? 'The crew plotted precision salvage: lower damage and no oxygen loss are now available.'
          : 'The crew solved the relay route. Canonical ship systems and resources improved.';
    } else if (command.type === 'patch') {
      if (s.chapter !== 3)
        fail('INVALID_CHALLENGE', 'There is no repair work order in this chapter.');
      if (!s.challenge.scanned.includes(command.node))
        fail('SCAN_REQUIRED', 'Scan the fault before repairing it.');
      if (s.challenge.tasks.includes(command.node))
        fail('ALREADY_REPAIRED', 'This repair has already been completed.');
      if (command.node === 'C' && !['A', 'B'].every((node) => s.challenge.tasks.includes(node)))
        fail('PREREQUISITES', 'Repair A and B before reconnecting C.');
      s.challenge.tasks.push(command.node);
      s.challenge.contributions[`patch:${command.node}`] = actor.id;
      if (command.node === 'A') {
        change('oxygen', 4);
        mark('lifeSupport', 'repair', 'damaged', 45);
      }
      if (command.node === 'B') change('hull', 4);
      if (command.node === 'C') {
        change('power', 5);
        change('oxygen', 10);
        mark('lifeSupport', 'repair', 'repaired', 90);
        s.challenge.solved = true;
        s.challenge.rewardEventId = id;
        cues.push({ kind: 'challenge-solved', eventId: id });
      }
      summary = `Crew repaired ${command.node}; ${command.node === 'C' ? 'life support is restored and the future leak is prevented.' : 'the ship gained a real repair, recorded once.'}`;
    } else if (command.type === 'close-challenge') {
      s.phase = co.budget > 0 ? 'allocation' : 'decision';
      s.window++;
      s.windowOpenedAt = context.at;
      summary =
        co.budget > 0
          ? `The crew can distribute up to ${co.budget} reserved power between hull repairs and oxygen recovery.`
          : 'The host opened the final decision. Completed viewer repairs persist.';
    } else if (command.type === 'vote') {
      if (s.phase !== 'decision') fail('INVALID_PHASE', 'Voting is not open.');
      const choices = getChoices(s);
      const choice =
        choices.find((c) => c.id === command.option) ?? choices[Number(command.option) - 1];
      if (!choice) fail('INVALID_OPTION', 'Choose one of the displayed options.');
      s.votes[actor.id] = choice!.id;
      summary = 'A crew member updated their advisory vote.';
    } else if (command.type === 'commit') {
      if (!['decision', 'awaiting-commit'].includes(s.phase))
        fail('INVALID_PHASE', 'Close the challenge before committing a decision.');
      const choice = getChoices(s).find((c) => c.id === command.option);
      if (!choice) fail('INVALID_OPTION', 'Unknown choice.');
      if (s.challenge.rewardEventId) causes.push(s.challenge.rewardEventId);
      if (co.closedByEventId) causes.push(co.closedByEventId);
      if (s.resources.power < (choice!.cost?.power ?? 0) + co.budget)
        fail(
          'UNAFFORDABLE',
          'This choice needs more power than remains after the declared crew reserve.',
        );
      for (const [key, cost] of Object.entries(choice!.cost ?? {}))
        if (s.resources[key as ResourceId] < cost) fail('UNAFFORDABLE', `Not enough ${key}.`);
      for (const [key, cost] of Object.entries(choice!.cost ?? {}))
        change(key as ResourceId, -cost);
      switch (command.option) {
        case 'burn-navigation':
          nav(0, 'destroyed');
          change('hull', -5);
          obligation('blind-jump', 2);
          break;
        case 'seal-habitat':
          change('passengers', -48);
          change('hull', -10);
          change('oxygen', -5);
          mark('habitat', 'seal', 'sealed', 50);
          break;
        case 'chart-route':
          nav(60, 'repaired');
          obligation('supply-debt', 4);
          break;
        case 'manual-flight':
          change('hull', s.challenge.solved ? -10 : -25);
          change('oxygen', -10);
          break;
        case 'derelict-salvage':
          change('supplies', 15);
          change('hull', -15);
          break;
        case 'bypass':
          break;
        case 'repair-life':
          change('oxygen', 25);
          mark('lifeSupport', 'repair', 'repaired', 100);
          break;
        case 'seal-cabins':
          change('passengers', -60);
          change('oxygen', 5);
          mark('habitat', 'seal', 'sealed', 20);
          break;
        case 'salvage':
          change('supplies', 30);
          change('hull', s.challenge.solved ? -5 : -15);
          if (!s.challenge.solved) change('oxygen', -10);
          break;
        case 'jettison':
          change('hull', 15);
          change('oxygen', -5);
          mark('cargo', 'jettison', 'damaged', 30);
          break;
        case 'land':
          change('hull', s.resources.navigation >= 40 ? -10 : -25);
          change('supplies', -Math.min(10, s.resources.supplies));
          break;
        case 'emergency-burn':
          change('hull', s.resources.navigation >= 40 ? -3 : -10);
          change('supplies', -Math.min(15, s.resources.supplies));
          break;
      }
      const hullUnits = Math.min(co.plan.hull, Math.max(0, 100 - s.resources.hull));
      const oxygenUnits = Math.min(
        co.plan.oxygen,
        Math.max(0, Math.ceil((100 - s.resources.oxygen) / 2)),
      );
      if (hullUnits) change('hull', hullUnits);
      if (oxygenUnits) change('oxygen', oxygenUnits * 2);
      change('power', -(hullUnits + oxygenUnits));
      s.resources.hull = clamp(s.resources.hull);
      s.resources.oxygen = clamp(s.resources.oxygen);
      s.systems.hull.integrity = s.resources.hull;
      if (s.resources.hull === 0) s.systems.hull.condition = 'destroyed';
      const tally: Record<string, number> = {};
      for (const option of Object.values(s.votes)) tally[option] = (tally[option] ?? 0) + 1;
      const leaders = Object.keys(tally).filter(
        (key) => tally[key] === Math.max(...Object.values(tally)),
      );
      const advice =
        leaders.length === 1
          ? leaders[0] === choice!.id
            ? 'Captain followed crew advice.'
            : 'Captain overrode crew advice.'
          : leaders.length
            ? 'Crew advice was tied.'
            : 'No advisory votes were cast.';
      const allocation =
        co.budget > 0
          ? ` Crew allocation spent ${hullUnits + oxygenUnits}/${co.budget} power: +${hullUnits} hull, +${oxygenUnits * 2} oxygen.`
          : '';
      co.budget = 0;
      co.preferences = {};
      co.plan = { hull: 0, oxygen: 0 };
      co.closedByEventId = null;
      s.phase = 'ready';
      checkTerminal();
      if (!s.outcome && s.chapter === 5) {
        s.outcome =
          s.resources.passengers >= 120 && s.resources.supplies >= 30 ? 'colony' : 'partial';
        s.phase = 'ended';
        s.endingReason =
          s.outcome === 'colony'
            ? 'A viable colony survived the journey.'
            : 'Survivors landed, but population or supplies cannot support a viable colony.';
        cues.push({ kind: 'world-ended', eventId: id });
      }
      summary = `${choice!.label}: committed by ${actor.community}. ${advice}${allocation}${s.endingReason ? ` ${s.endingReason}` : ''}`;
    }
  }
  s.version++;
  const resourceDelta = Object.fromEntries(
    (Object.keys(s.resources) as ResourceId[])
      .filter((key) => s.resources[key] !== previous.resources[key])
      .map((key) => [key, s.resources[key] - previous.resources[key]]),
  );
  return {
    state: s,
    event: {
      id,
      worldId: s.id,
      sequence: s.version,
      rulesVersion: RULES_VERSION,
      commandId: context.commandId,
      command,
      actor: structuredClone(actor),
      at: context.at,
      chapter: s.chapter,
      summary,
      resourceDelta,
      cues,
      causes,
    },
  };
}

export function previewChoices(s: WorldState): ChoicePresentation[] {
  return getChoices(s).map((choice) => {
    try {
      const previewState = { ...s, phase: 'decision' as const };
      const next = applyCommand(
        previewState,
        { type: 'commit', option: choice.id },
        { id: 'preview', role: 'host', community: 'Preview' },
        { commandId: 'preview', at: '2000-01-01T00:00:00.000Z' },
      ).state;
      const warnings = [
        next.outcome === 'wreck' ? 'This choice will destroy the Ark.' : '',
        next.resources.passengers < 120 ? 'Below the 120-passenger colony threshold.' : '',
        next.resources.supplies < 30 ? 'Below the thirty-crate colony threshold.' : '',
        next.resources.navigation < 40
          ? 'Blind atmospheric entry will cost 25 hull without emergency braking.'
          : '',
        next.systems.lifeSupport.condition === 'damaged' && s.chapter < 4
          ? 'Damaged life support will leak fifteen oxygen in chapter four.'
          : '',
        s.chapter === 4 && next.resources.oxygen <= 15
          ? 'Fatal future consequence: atmospheric entry consumes fifteen oxygen; this reserve will be exhausted on arrival.'
          : '',
      ].filter(Boolean);
      return {
        ...choice,
        available: true,
        unavailableReason: null,
        preview: { resources: next.resources, outcome: next.outcome, warnings },
      };
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      return { ...choice, available: false, unavailableReason: error.message, preview: null };
    }
  });
}

export function replayEvents(worldId: string, events: WorldEvent[]): WorldState {
  let state = createWorld(worldId);
  for (const event of events) {
    if (
      event.sequence !== state.version + 1 ||
      event.worldId !== worldId ||
      event.rulesVersion !== RULES_VERSION
    )
      fail('REPLAY_SEQUENCE', 'Event history has a gap or incompatible version.');
    const next = applyCommand(state, event.command, event.actor, {
      commandId: event.commandId,
      at: event.at,
    });
    if (canonical(next.event) !== canonical(event))
      fail('REPLAY_MISMATCH', 'Stored event effects do not match immutable rules.');
    state = next.state;
  }
  return state;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
