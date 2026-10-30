import { expect, it } from 'vitest';
import {
  applyCommand,
  createWorld,
  getPuzzle,
  livewireOptions,
  previewChoices,
  replayEvents,
  routeSolutions,
} from '@torchline/engine';
import type { Command, LivewireTarget, WorldEvent, WorldState } from '@torchline/contracts';
import { host } from './helpers.ts';

it('keeps all three endings reachable across full-season mission policies and bounds every repeated-win route', () => {
  const endings = new Set<string>();
  let journeys = 0,
    gainMaximum = 0;
  const witnesses: Record<string, { state: WorldState; events: WorldEvent[] }> = {};
  for (const target of [null, 'navigation', 'hull', 'oxygen'] as (LivewireTarget | null)[])
    for (const outcome of target ? (['success', 'failure'] as const) : (['success'] as const))
      for (const solved of [false, true]) {
        function walk(state: WorldState, events: WorldEvent[]) {
          function send(command: Command) {
            const next = applyCommand(state, command, host, {
              commandId: `proof-${state.version}`,
              at: '2026-10-30T10:00:00.000Z',
            });
            state = next.state;
            events = [...events, next.event];
          }
          if (state.outcome) {
            journeys++;
            endings.add(state.outcome);
            witnesses[state.outcome] ??= { state, events };
            const gain = events
              .filter((e) => e.command.type === 'livewire-resolve')
              .reduce(
                (sum, e) =>
                  sum + Object.values(e.resourceDelta).reduce((a, n) => a + Math.max(0, n ?? 0), 0),
                0,
              );
            gainMaximum = Math.max(gainMaximum, gain);
            expect(state.livewire?.spentChapters.length ?? 0).toBeLessThanOrEqual(5);
            expect(gain).toBeLessThanOrEqual(15);
            for (const resource of ['hull', 'oxygen', 'power', 'navigation'] as const)
              expect(state.resources[resource]).toBeGreaterThanOrEqual(0);
            return;
          }
          if (
            target &&
            livewireOptions(state).some((o) => o.target === target) &&
            state.resources.supplies >= 1
          ) {
            const stakeId = `00000000-0000-4000-8000-${String(state.chapter).padStart(12, '0')}`;
            send({
              type: 'livewire-open',
              stakeId,
              preset: 'challenge',
              game: 'A normal game',
              label: 'One attempt',
            });
            send({
              type: 'livewire-lock',
              stakeId,
              tallies: [0, 0, 0],
              solo: target,
              evidence: 'simulation',
            });
            send({ type: 'livewire-resolve', stakeId, outcome });
          }
          send({ type: 'start' });
          if (state.outcome) {
            walk(state, events);
            return;
          }
          if (solved) {
            for (const node of ['A', 'B', 'C', 'D'] as const) send({ type: 'scan', node });
            if (getPuzzle(state)?.kind === 'work-order')
              for (const node of ['A', 'B', 'C'] as const) send({ type: 'patch', node });
            else
              send({
                type: 'route',
                nodes: routeSolutions(state.chapter)[0] as ('S' | 'A' | 'B' | 'C' | 'D' | 'T')[],
              });
          }
          send({ type: 'close-challenge' });
          send({ type: 'close-voting' });
          for (const choice of previewChoices(state).filter((c) => c.available)) {
            const next = applyCommand(state, { type: 'commit', option: choice.id }, host, {
              commandId: `proof-${state.version}`,
              at: '2026-10-30T10:00:00.000Z',
            });
            walk(next.state, [...events, next.event]);
          }
        }
        walk(createWorld('economy-proof', 'ark-v3'), []);
      }
  expect(journeys).toBeGreaterThan(100);
  expect([...endings].sort()).toEqual(['colony', 'partial', 'wreck']);
  expect(gainMaximum).toBeGreaterThan(0);
  for (const witness of Object.values(witnesses))
    expect(replayEvents(witness.state.id, witness.events)).toEqual(witness.state);
});

it('can change survival through a real authored future cost without removing the scarcity of the same route', () => {
  function journey(withMissions: boolean) {
    let state = createWorld('survival-proof', 'ark-v3');
    const events: WorldEvent[] = [];
    const send = (command: Command) => {
      const n = applyCommand(state, command, host, {
        commandId: `survival-${state.version}`,
        at: '2026-10-30T10:00:00.000Z',
      });
      state = n.state;
      events.push(n.event);
    };
    for (const option of [
      'burn-navigation',
      'manual-flight',
      'seal-cabins',
      'jettison',
      'emergency-burn',
    ]) {
      if (state.outcome) break;
      if (withMissions) {
        const stakeId = `00000000-0000-4000-8000-${String(state.chapter).padStart(12, '0')}`;
        send({ type: 'livewire-open', stakeId, preset: 'match', game: 'Game', label: 'One match' });
        send({ type: 'livewire-lock', stakeId, tallies: [0, 0, 1], evidence: 'simulation' });
        send({ type: 'livewire-resolve', stakeId, outcome: 'success' });
      }
      send({ type: 'start' });
      if (state.outcome) break;
      send({ type: 'close-challenge' });
      send({ type: 'close-voting' });
      send({ type: 'commit', option });
    }
    expect(replayEvents(state.id, events)).toEqual(state);
    return state;
  }
  expect(journey(false).outcome).toBe('wreck');
  const repaired = journey(true);
  expect(repaired.outcome).toBe('partial');
  expect(repaired.resources.passengers).toBeLessThan(216);
  expect(repaired.resources.supplies).toBeLessThan(30);
});
