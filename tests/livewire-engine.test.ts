import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { applyCommand, createWorld, replayEvents, livewireOptions } from '@torchline/engine';
import type { Command, WorldEvent, WorldState } from '@torchline/contracts';
import { CommandRequestSchema } from '@torchline/contracts';
import { host, viewer } from './helpers.ts';
import * as historical from '../packages/engine/src/ark-v3.ts';
const at = '2026-10-30T10:00:00.000Z';
function step(s: WorldState, command: Command, time = at) {
  return applyCommand(s, command, host, { commandId: `cmd-${s.version}`, at: time });
}
function open(s = createWorld('world', 'ark-v3')) {
  return step(s, {
    type: 'livewire-open',
    stakeId: randomUUID(),
    preset: 'boss',
    game: 'A normal game',
    label: 'One boss attempt',
  });
}
function lock(s: WorldState) {
  return step(s, {
    type: 'livewire-lock',
    stakeId: s.livewire!.stake.id,
    tallies: [0, 0, 0],
    solo: 'oxygen',
    evidence: 'simulation',
  });
}

describe('livewire-v0 pinned engine extension', () => {
  it('excludes server-derived mission commands from the public Ark request schema', () => {
    expect(
      CommandRequestSchema.safeParse({
        command: {
          type: 'livewire-lock',
          stakeId: randomUUID(),
          tallies: [0, 9999, 0],
          evidence: 'twitch_signed',
        },
        expectedVersion: 0,
        commandId: randomUUID(),
      }).success,
    ).toBe(false);
  });
  it('records the real resource, physical mark and causal effect once, and replays mixed Ark history', () => {
    let state = createWorld('world', 'ark-v3');
    const events: WorldEvent[] = [];
    for (const cmd of [
      {
        type: 'livewire-open',
        stakeId: randomUUID(),
        preset: 'match',
        game: 'Rocket League',
        label: 'Ranked match',
      },
      { type: 'livewire-lock', tallies: [0, 2, 1], evidence: 'simulation' },
      { type: 'livewire-resolve', outcome: 'failure' },
      { type: 'start' },
    ] as Command[]) {
      const command =
        cmd.type.startsWith('livewire-') && cmd.type !== 'livewire-open'
          ? ({ ...cmd, stakeId: state.livewire!.stake.id } as Command)
          : cmd;
      const next = step(state, command);
      state = next.state;
      events.push(next.event);
    }
    expect(events[2].resourceDelta).toEqual({ hull: -6 });
    expect(events[2].evidence).toBe('streamer_attested');
    expect(events[2].causes).toEqual([events[1].id]);
    expect(
      state.systems.hull.marks.some(
        (mark) => mark.eventId === events[2].id && mark.kind === 'damage',
      ),
    ).toBe(true);
    expect(replayEvents(state.id, events)).toEqual(state);
    expect(() =>
      step(state, {
        type: 'livewire-resolve',
        stakeId: state.livewire!.stake.id,
        outcome: 'success',
      }),
    ).toThrow();
    expect(() =>
      replayEvents(
        state.id,
        events.map((e, i) => (i === 2 ? { ...e, resourceDelta: { hull: 6 } } : e)),
      ),
    ).toThrow('Stored effects');
  });
  it('keeps old v3 events byte-equivalent and v2 ineligible', () => {
    const s = createWorld('world', 'ark-v3');
    expect(step(s, { type: 'start' })).toEqual(
      historical.applyCommand(s, { type: 'start' }, host, { commandId: 'cmd-0', at }),
    );
    expect(() => open(createWorld('legacy', 'ark-v2'))).toThrow('historical worlds');
  });
  it('requires a declared solo target, resolves ties in published order, rejects viewer authority', () => {
    const s = open().state,
      stakeId = s.livewire!.stake.id;
    expect(() =>
      step(s, { type: 'livewire-lock', stakeId, tallies: [0, 0, 0], evidence: 'simulation' }),
    ).toThrow('explicitly choose');
    const next = step(s, {
      type: 'livewire-lock',
      stakeId,
      tallies: [2, 2, 2],
      evidence: 'twitch_signed',
    });
    expect(next.state.livewire!.stake.target).toBe('navigation');
    expect(next.state.livewire!.stake.selection).toBe('crew');
    expect(() =>
      applyCommand(s, { type: 'livewire-cancel', stakeId }, viewer, { commandId: 'viewer', at }),
    ).toThrow('captain');
    expect(() => step(s, { type: 'start' })).toThrow('Resolve or cancel');
  });
  it.each(['cancel', 'expire', 'success', 'failure'] as const)(
    'consumes allowance on %s and prevents replacing the attempt',
    (kind) => {
      let s = open().state;
      const stakeId = s.livewire!.stake.id;
      if (kind === 'success' || kind === 'failure')
        s = step(lock(s).state, { type: 'livewire-resolve', stakeId, outcome: kind }).state;
      else
        s = step(
          s,
          { type: kind === 'cancel' ? 'livewire-cancel' : 'livewire-expire', stakeId },
          kind === 'expire' ? '2026-10-30T10:01:00.000Z' : at,
        ).state;
      expect(s.resources.supplies).toBe(createWorld('world', 'ark-v3').resources.supplies - 1);
      expect(() => open(s)).toThrow('already used');
      expect(() => step(s, { type: 'livewire-cancel', stakeId })).toThrow('already final');
    },
  );
  it('uses persisted cutoffs and preserves remaining time on explicit recovery', () => {
    let s = open().state;
    const stakeId = s.livewire!.stake.id;
    expect(() =>
      step(
        s,
        { type: 'livewire-lock', stakeId, tallies: [1, 0, 0], evidence: 'simulation' },
        '2026-10-30T10:00:45.000Z',
      ),
    ).toThrow('window has closed');
    s = step(
      s,
      { type: 'livewire-pause', stakeId, reason: 'restart' },
      '2026-10-30T10:00:10.000Z',
    ).state;
    expect(s.livewire!.stake.remainingMs).toBe(35000);
    s = step(s, { type: 'livewire-resume', stakeId }, '2026-10-31T10:00:00.000Z').state;
    expect(s.livewire!.stake.deadlineAt).toBe('2026-10-31T10:00:35.000Z');
    expect(s.livewire!.stake.windowOpenedAt).toBe('2026-10-31T10:00:00.000Z');
  });
  it('never revives lost systems, exceeds bounds, changes passengers or invents obligations', () => {
    const s = createWorld('world', 'ark-v3');
    s.resources.oxygen = 1;
    s.resources.hull = 99;
    s.resources.navigation = 0;
    s.systems.navigation.condition = 'destroyed';
    s.systems.navigation.integrity = 0;
    expect(livewireOptions(s)).toEqual([
      { target: 'hull', success: 1, failure: -6 },
      { target: 'oxygen', success: 3, failure: -0 },
    ]);
    const locked = lock(open(s).state).state;
    const result = step(locked, {
      type: 'livewire-resolve',
      stakeId: locked.livewire!.stake.id,
      outcome: 'failure',
    }).state;
    expect(result.resources.oxygen).toBe(1);
    expect(result.resources.passengers).toBe(216);
    expect(result.obligations).toEqual([]);
  });
});
