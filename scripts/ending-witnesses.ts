import { applyCommand, createWorld } from '@torchline/engine';
import { CURRENT_RULES_VERSION } from '@torchline/contracts';
import type { Command, Ending, WorldEvent } from '@torchline/contracts';
import { analyzeBalance } from './balance-analysis.ts';

/** Current-rule, zero-reserve campaigns derived from the exhaustive legacy paths.
 * This proves these three campaigns, not every cooperation/timing configuration. */
export function endingWitnesses() {
  const paths = analyzeBalance().witnesses;
  return Object.fromEntries(
    (['colony', 'partial', 'wreck'] as Ending[]).map((ending) => {
      let state = createWorld(`ending-witness-${ending}`, CURRENT_RULES_VERSION);
      const events: WorldEvent[] = [];
      const act = (command: Command) => {
        const participant = ['scan', 'route', 'patch'].includes(command.type);
        const result = applyCommand(
          state,
          command,
          {
            id: participant ? 'witness-viewer' : 'witness-host',
            role: participant ? 'viewer' : 'host',
            community: 'Witness community',
          },
          { commandId: `witness-${state.version + 1}`, at: '2026-10-29T00:00:00.000Z' },
        );
        state = result.state;
        events.push(result.event);
      };
      for (const entry of paths[ending]!.path) {
        act({ type: 'start' });
        if (state.outcome) break;
        const [, option, profile] = entry.match(/^chapter-\d+:([^;]+);challenge=(.+)$/) ?? [];
        if (!option || !profile) throw new Error('Invalid authored witness path.');
        if (profile !== 'skipped') {
          const nodes = profile.split('-') as Extract<Command, { type: 'route' }>['nodes'];
          if (state.chapter === 3)
            for (const node of nodes) {
              act({ type: 'scan', node: node as 'A' | 'B' | 'C' });
              act({ type: 'patch', node: node as 'A' | 'B' | 'C' });
            }
          else {
            for (const node of nodes.slice(1, -1))
              act({ type: 'scan', node: node as 'A' | 'B' | 'C' | 'D' });
            act({ type: 'route', nodes });
          }
        }
        act({ type: 'close-challenge' });
        if (state.phase === 'allocation') act({ type: 'close-allocation' });
        if (state.phase === 'decision') act({ type: 'close-voting' });
        act({ type: 'commit', option });
      }
      if (state.outcome !== ending)
        throw new Error(`Current rules no longer reach ${ending} through the authored witness.`);
      return [ending, { state, events }];
    }),
  ) as Record<Ending, { state: ReturnType<typeof createWorld>; events: WorldEvent[] }>;
}
