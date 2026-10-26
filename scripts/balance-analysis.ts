import { applyCommand, createWorld, getChoices, routeSolutions } from '@torchline/engine';
import { DomainError } from '@torchline/contracts';
import type { Command, Ending, Resources, WorldState } from '@torchline/contracts';

export function analyzeBalance() {
  const endings: Record<Ending, number> = { colony: 0, partial: 0, wreck: 0 };
  const witnesses: Partial<
    Record<Ending, { path: string[]; resources: Resources; reason: string | null }>
  > = {};
  const endingChapters: Record<string, number> = {};
  const wreckCauses: Record<string, number> = {};
  let decisions = 0;
  let unaffordableChoices = 0;
  const act = (s: WorldState, command: Command) =>
    applyCommand(
      s,
      command,
      { id: 'audit-host', role: 'host', community: 'Audit crew' },
      { commandId: `audit-${s.version + 1}`, at: '2026-10-26T00:00:00.000Z' },
    ).state;
  function visit(s: WorldState, path: string[]) {
    if (s.outcome) {
      endings[s.outcome]++;
      endingChapters[`${s.outcome}:chapter-${s.chapter}`] =
        (endingChapters[`${s.outcome}:chapter-${s.chapter}`] ?? 0) + 1;
      if (s.outcome === 'wreck')
        wreckCauses[s.endingReason ?? 'unknown'] =
          (wreckCauses[s.endingReason ?? 'unknown'] ?? 0) + 1;
      witnesses[s.outcome] ??= { path, resources: s.resources, reason: s.endingReason };
      return;
    }
    const arrived = act(s, { type: 'start' });
    if (arrived.outcome) {
      visit(arrived, [...path, `chapter-${arrived.chapter}:arrival`]);
      return;
    }
    const profiles =
      arrived.chapter === 3
        ? [[], ['A'], ['B'], ['A', 'B'], ['A', 'B', 'C']]
        : [[], routeSolutions(arrived.chapter)[0]];
    for (const profile of profiles) {
      let challenge = arrived;
      if (arrived.chapter === 3) {
        for (const node of profile) {
          challenge = act(challenge, { type: 'scan', node: node as 'A' | 'B' | 'C' });
          challenge = act(challenge, { type: 'patch', node: node as 'A' | 'B' | 'C' });
        }
      } else if (profile.length) {
        for (const node of profile.slice(1, -1))
          challenge = act(challenge, { type: 'scan', node: node as 'A' | 'B' | 'C' | 'D' });
        challenge = act(challenge, {
          type: 'route',
          nodes: profile as ('S' | 'A' | 'B' | 'C' | 'D' | 'T')[],
        });
      }
      const decision = act(challenge, { type: 'close-challenge' });
      for (const choice of getChoices(decision)) {
        try {
          const next = act(decision, { type: 'commit', option: choice.id });
          decisions++;
          visit(next, [
            ...path,
            `chapter-${arrived.chapter}:${choice.id};challenge=${profile.join('-') || 'skipped'}`,
          ]);
        } catch (error) {
          if (error instanceof DomainError && error.code === 'UNAFFORDABLE') unaffordableChoices++;
          else throw error;
        }
      }
    }
  }
  visit(createWorld('audit-v2'), []);
  return {
    rulesVersion: 'ark-v2',
    dimensions:
      'All authored choices × route solved/skipped × five valid repair subsets; scan ordering and equivalent valid routes collapsed. Timed phases and allocation are not implemented.',
    terminalPaths: Object.values(endings).reduce((a, b) => a + b, 0),
    endings,
    endingChapters,
    wreckCauses,
    decisions,
    unaffordableChoices,
    witnesses,
  };
}
