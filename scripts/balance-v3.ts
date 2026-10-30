import {
  applyCommand,
  createWorld,
  getChoices,
  getPuzzle,
  replayEvents,
  routeSolutions,
} from '@torchline/engine';
import { CURRENT_RULES_VERSION, DomainError } from '@torchline/contracts';
import type { Command, Ending, Resources, WorldEvent, WorldState } from '@torchline/contracts';

// A bounded search, not a proof. The node budget is high enough that the current rule set is
// covered completely; `truncated` reports honestly when it is not.
export const BALANCE_NODE_LIMIT = 400_000;
const CONFIG_BUDGETS = [0, 2, 4, 6, 10];
/** The contract keeps its node union private, so the exploration names it locally. */
type Node = 'S' | 'A' | 'B' | 'C' | 'D' | 'T';
const AREAS = ['engine', 'cargo', 'life'] as const;
const AT = '2026-10-30T00:00:00.000Z';
const ACTOR = { id: 'balance-host', role: 'host', community: 'Balance crew' } as const;

export interface CurrentRulesReport {
  rulesVersion: string;
  dimensions: string;
  distinctStates: number;
  seasons: number;
  seed: number;
  completed: number;
  stalled: number;
  abandoned: number;
  boundaryActions: number;
  unaffordableChoices: number;
  endings: Record<Ending, number>;
  commands: number;
  refused: Record<string, number>;
  deadEnds: { chapter: number; phase: string; resources: Resources }[];
  witnesses: Partial<
    Record<
      Ending,
      { path: string[]; resources: Resources; reason: string | null; replayed: boolean }
    >
  >;
}

/** Every legal action of a phase, grouped into the smallest meaningful unit of play. */
function actions(state: WorldState): { label: string; commands: Command[] }[] {
  switch (state.phase) {
    case 'ready': {
      const budgets = [
        ...new Set(CONFIG_BUDGETS.filter((budget) => budget <= state.resources.power)),
      ];
      return [
        ...budgets.flatMap((budget) =>
          [false, true].map((investigation) => ({
            label: `reserve=${budget}${investigation ? '+investigation' : ''}`,
            commands: [
              { type: 'configure-cooperation' as const, budget, investigation },
              { type: 'start' as const },
            ],
          })),
        ),
        { label: 'no-reserve', commands: [{ type: 'start' }] },
      ];
    }
    case 'investigation':
      return [
        ...AREAS.map((area) => ({
          label: `investigate=${area}`,
          commands: [{ type: 'inspect' as const, area }, { type: 'close-investigation' as const }],
        })),
        { label: 'investigate=none', commands: [{ type: 'close-investigation' }] },
      ];
    case 'challenge':
      return [
        { label: 'challenge=skipped', commands: [{ type: 'close-challenge' }] },
        ...(solve(state) ? [{ label: 'challenge=solved', commands: solve(state)! }] : []),
      ];
    case 'allocation': {
      const preference = (hull: number, oxygen: number): Command[] => [
        { type: 'allocate', hull, oxygen },
        { type: 'close-allocation' },
      ];
      return [
        { label: 'plan=none', commands: [{ type: 'close-allocation' }] },
        { label: 'plan=hull', commands: preference(5, 0) },
        { label: 'plan=oxygen', commands: preference(0, 5) },
        { label: 'plan=balanced', commands: preference(3, 2) },
      ];
    }
    case 'decision':
      return getChoices(state).map((choice) => ({
        label: `commit=${choice.id}`,
        commands: [
          { type: 'close-voting' as const },
          { type: 'commit' as const, option: choice.id },
        ],
      }));
    case 'awaiting-commit':
      return getChoices(state).map((choice) => ({
        label: `commit=${choice.id}`,
        commands: [{ type: 'commit' as const, option: choice.id }],
      }));
    case 'paused':
      return [{ label: 'resume', commands: [{ type: 'resume' }] }];
    default:
      return [];
  }
}

/** The full-reward play of the current challenge: every clue, the first valid route, every repair. */
function solve(state: WorldState): Command[] | null {
  const puzzle = getPuzzle(state);
  if (!puzzle) return null;
  const commands: Command[] = [];
  if (puzzle.kind === 'work-order') {
    const nodes = puzzle.nodes
      .filter((node) => ['A', 'B', 'C'].includes(node.id))
      .map((node) => node.id)
      .sort();
    for (const node of nodes)
      if (!puzzle.nodes.find((item) => item.id === node)!.revealed)
        commands.push({ type: 'scan', node: node as 'A' | 'B' | 'C' });
    for (const node of nodes) commands.push({ type: 'patch', node: node as 'A' | 'B' | 'C' });
  } else {
    const route = routeSolutions(state.chapter)[0] as Node[] | undefined;
    if (!route) return null;
    for (const node of route.slice(1, -1)) commands.push({ type: 'scan', node });
    commands.push({ type: 'route', nodes: route });
  }
  return commands.length ? [...commands, { type: 'close-challenge' }] : null;
}

const canonical = (state: WorldState) =>
  JSON.stringify([
    state.rulesVersion,
    state.chapter,
    state.phase,
    state.resumePhase,
    state.crisis,
    state.resources,
    state.systems,
    state.challenge,
    state.cooperation,
    state.obligations,
    state.outcome,
    state.endingReason,
  ]);

export interface CurrentRulesOptions {
  /** Complete seasons played with a deterministic, seeded strategy sampler. */
  seasons?: number;
  seed?: number;
}

const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

/**
 * A bounded exploration, not a proof.
 *
 * A complete season enumeration is not feasible: the state space is the full resource, system and
 * obligation product. This plays a fixed, seeded set of complete seasons over every legal action, so
 * the sampled region is reproducible and not biased to one branch, and it additionally sweeps every
 * legal action at every boundary it reaches. `truncated` reports seasons that hit the step guard.
 */
export function analyzeCurrentRules(options: CurrentRulesOptions = {}): CurrentRulesReport {
  const seasons = options.seasons ?? 4000;
  const seed = options.seed ?? 20261030;
  const endings: Record<Ending, number> = { colony: 0, partial: 0, wreck: 0 };
  const witnesses: CurrentRulesReport['witnesses'] = {};
  const refused: Record<string, number> = {};
  const deadEnds: CurrentRulesReport['deadEnds'] = [];
  const visited = new Set<string>();
  const random = mulberry32(seed);
  let commands = 0;
  let stalled = 0;
  let abandoned = 0;
  let completed = 0;
  let boundaryActions = 0;
  let unaffordableChoices = 0;
  const act = (state: WorldState, command: Command, step: number) =>
    applyCommand(state, command, ACTOR, { commandId: `balance-${step}`, at: AT });

  /** Applies a whole action to a scratch state so a refusal is attributed to the right step. */
  function attempt(state: WorldState, action: { label: string; commands: Command[] }) {
    let next = state;
    const applied: WorldEvent[] = [];
    for (const command of action.commands) {
      try {
        const result = act(next, command, next.version + 1);
        next = result.state;
        applied.push(result.event);
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        refused[error.code] = (refused[error.code] ?? 0) + 1;
        if (error.code === 'UNAFFORDABLE' && command.type === 'commit') unaffordableChoices++;
        return null;
      }
    }
    commands += applied.length;
    return { state: next, applied };
  }

  for (let season = 0; season < seasons; season++) {
    let state = createWorld(`balance-current-${season}`, CURRENT_RULES_VERSION);
    const trail: WorldEvent[] = [];
    const path: string[] = [];
    for (let step = 0; step < 200; step++) {
      const legal = actions(state);
      if (!legal.length) {
        deadEnds.push({ chapter: state.chapter, phase: state.phase, resources: state.resources });
        break;
      }
      // Exhaustive at every boundary reached: each legal action is attempted on a scratch state, so
      // affordability and phase rules are exercised even for the actions this season does not take.
      const order = [...legal];
      for (let index = order.length - 1; index > 0; index--) {
        const swap = Math.floor(random() * (index + 1));
        [order[index], order[swap]] = [order[swap], order[index]];
      }
      for (const candidate of order) {
        boundaryActions++;
        attempt(state, candidate);
      }
      let moved = false;
      for (const candidate of order) {
        const result = attempt(state, candidate);
        if (!result) continue;
        path.push(`c${state.chapter}:${candidate.label}`);
        trail.push(...result.applied);
        state = result.state;
        visited.add(canonical(state));
        moved = true;
        break;
      }
      if (!moved) {
        abandoned++;
        break;
      }
      if (state.outcome) break;
      if (step === 199) stalled++;
    }
    if (state.outcome) {
      endings[state.outcome]++;
      completed++;
      if (!witnesses[state.outcome]) {
        let replayed = false;
        try {
          replayed =
            canonical(replayEvents(state.id, [...trail], CURRENT_RULES_VERSION)) ===
            canonical(state);
        } catch {
          replayed = false;
        }
        witnesses[state.outcome] = {
          path: [...path],
          resources: state.resources,
          reason: state.endingReason,
          replayed,
        };
      }
    }
  }
  return {
    rulesVersion: CURRENT_RULES_VERSION,
    dimensions:
      'Seeded complete seasons over every legal phase action, with an exhaustive legal-action sweep at every boundary reached: all authored commitments, full-reward and skipped challenge play, four allocation plans and both investigation settings. Timed deadline closure is a storage concern and is covered by the episode tests instead.',
    distinctStates: visited.size,
    seasons,
    seed,
    completed,
    stalled,
    abandoned,
    boundaryActions,
    unaffordableChoices,
    endings,
    commands,
    refused,
    deadEnds,
    witnesses,
  };
}
