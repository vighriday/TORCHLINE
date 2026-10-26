import { describe, expect, it } from 'vitest';
import {
  createWorld,
  getChoices,
  getPuzzle,
  previewChoices,
  replayEvents,
  routeError,
  routeSolutions,
} from '@torchline/engine';
import type { Command, WorldEvent } from '@torchline/contracts';
import { analyzeBalance } from '../scripts/balance-analysis.ts';
import { act, play, viewer } from './helpers.ts';

describe('authored balance and actual viewer agency', () => {
  it('exhaustively reaches all endings and keeps a reproducible witness for each', () => {
    const report = analyzeBalance();
    expect(report.endings).toEqual({ colony: 964, partial: 1304, wreck: 130 });
    expect(report.terminalPaths).toBe(2398);
    expect(Object.keys(report.wreckCauses)).toHaveLength(2);
    expect(report.endingChapters['wreck:chapter-4']).toBeGreaterThan(0);
    expect(report.witnesses.colony!.resources.hull).toBe(10);
  });
  it('has solvable authored routes and rejects loops, blocked nodes and shortcuts', () => {
    for (const chapter of [1, 2, 4, 5]) {
      expect(routeSolutions(chapter).length).toBeGreaterThan(0);
      for (const solution of routeSolutions(chapter))
        expect(routeError(chapter, solution)).toBeNull();
    }
    expect(routeError(1, ['S', 'B', 'C', 'T'])).toContain('unsafe');
    expect(routeError(1, ['S', 'A', 'D', 'T'])).toContain('must include');
    expect(routeError(1, ['S', 'A', 'C', 'A', 'C', 'T'])).toContain('revisit');
    expect(routeError(1, ['S', 'T'])).toContain('must include');
  });
  it('applies shield repairs once and prevents a later blind-jump loss', () => {
    const arrived = act(createWorld('shield-test'), { type: 'start' }).state;
    const solved = play(
      arrived,
      [
        { type: 'scan', node: 'A' },
        { type: 'scan', node: 'C' },
        { type: 'route', nodes: ['S', 'A', 'C', 'T'] },
      ],
      viewer,
    ).state;
    expect(solved.resources.hull - arrived.resources.hull).toBe(15);
    expect(solved.resources.power - arrived.resources.power).toBe(10);
    expect(solved.systems.shields.condition).toBe('repaired');
    expect(() => act(solved, { type: 'route', nodes: ['S', 'A', 'C', 'T'] }, viewer)).toThrow(
      'already applied',
    );
    const next = play(solved, [
      { type: 'close-challenge' },
      { type: 'commit', option: 'burn-navigation' },
      { type: 'start' },
    ]).state;
    expect(next.resources.hull).toBe(80);
    expect(next.systems.navigation.condition).toBe('destroyed');
    expect(next.systems.navigation.marks[0].kind).toBe('sacrifice');
  });
  it('lets distinct participants repair a dependency graph, stopping the future leak', () => {
    let state = play(createWorld('work-order'), [
      { type: 'start' },
      { type: 'close-challenge' },
      { type: 'commit', option: 'burn-navigation' },
      { type: 'start' },
      { type: 'close-challenge' },
      { type: 'commit', option: 'chart-route' },
      { type: 'start' },
    ]).state;
    const before = structuredClone(state);
    state = act(state, { type: 'scan', node: 'C' }, viewer).state;
    expect(() => act(state, { type: 'patch', node: 'C' }, viewer)).toThrow('Repair A and B');
    for (const node of ['A', 'B', 'C'] as const) {
      if (!state.challenge.scanned.includes(node))
        state = act(state, { type: 'scan', node }, { ...viewer, id: `crew-${node}` }).state;
      state = act(state, { type: 'patch', node }, { ...viewer, id: `crew-${node}` }).state;
    }
    expect(state.resources.oxygen).toBe(before.resources.oxygen + 14);
    expect(state.resources.hull).toBe(before.resources.hull + 4);
    expect(state.resources.power).toBe(before.resources.power + 5);
    expect(new Set(Object.values(state.challenge.contributions)).size).toBeGreaterThan(1);
    expect(state.systems.lifeSupport.condition).toBe('repaired');
    expect(getChoices(state)[0].cost?.power).toBe(10);
    expect(() => act(state, { type: 'patch', node: 'A' }, viewer)).toThrow('already');
    const beforeArrival = play(state, [
      { type: 'close-challenge' },
      { type: 'commit', option: 'seal-cabins' },
    ]).state;
    const after = act(beforeArrival, { type: 'start' }).state;
    expect(after.resources.oxygen).toBe(beforeArrival.resources.oxygen);
    expect(after.obligations.find((o) => o.kind === 'leak')?.status).toBe('avoided');
    expect(after.systems.lifeSupport.marks.map((m) => m.kind)).toContain('damage');
    expect(after.systems.lifeSupport.marks.map((m) => m.kind)).toContain('repair');
  });
  it('shows exact lethal previews and cannot revive or mutate a wreck', () => {
    let state = play(createWorld('danger'), [
      { type: 'start' },
      { type: 'close-challenge' },
      { type: 'commit', option: 'burn-navigation' },
      { type: 'start' },
      { type: 'close-challenge' },
      { type: 'commit', option: 'manual-flight' },
      { type: 'start' },
      { type: 'close-challenge' },
      { type: 'commit', option: 'repair-life' },
      { type: 'start' },
      { type: 'close-challenge' },
    ]).state;
    const preview = previewChoices(state).find((c) => c.id === 'salvage')!;
    expect(preview.preview?.outcome).toBe('wreck');
    expect(preview.preview?.warnings).toContain('This choice will destroy the Ark.');
    const original = structuredClone(state);
    state = act(state, { type: 'commit', option: 'salvage' }).state;
    expect(state.resources).toEqual(preview.preview?.resources);
    expect(state.outcome).toBe('wreck');
    expect(original.outcome).toBeNull();
    expect(() => act(state, { type: 'start' })).toThrow('has ended');
  });
  it('preserves canonical replay through JSONB-style property reordering and rejects tampering', () => {
    const commands: Command[] = [
      { type: 'start' },
      { type: 'scan', node: 'A' },
      { type: 'scan', node: 'C' },
      { type: 'route', nodes: ['S', 'A', 'C', 'T'] },
      { type: 'close-challenge' },
      { type: 'vote', option: '1' },
      { type: 'commit', option: 'burn-navigation' },
    ];
    const { state, events } = play(createWorld('replay'), commands);
    const reorder = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(reorder)
        : v && typeof v === 'object'
          ? Object.fromEntries(
              Object.entries(v)
                .reverse()
                .map(([k, val]) => [k, reorder(val)]),
            )
          : v;
    expect(replayEvents('replay', reorder(events) as WorldEvent[])).toEqual(state);
    const corrupted = structuredClone(events);
    corrupted[0].resourceDelta.hull = 10;
    expect(() => replayEvents('replay', corrupted)).toThrow('do not match');
    expect(() => replayEvents('replay', events.slice(1))).toThrow('gap');
  });
  it('keeps votes advisory and unique, pause immutable, viewer authority bounded', () => {
    let state = play(createWorld('authority'), [
      { type: 'start' },
      { type: 'close-challenge' },
    ]).state;
    state = act(state, { type: 'vote', option: '1' }, viewer).state;
    state = act(state, { type: 'vote', option: '2' }, viewer).state;
    expect(Object.values(state.votes)).toEqual(['seal-habitat']);
    expect(state.resources.navigation).toBe(70);
    expect(() => act(state, { type: 'commit', option: 'seal-habitat' }, viewer)).toThrow(
      'Only the current host',
    );
    const paused = act(state, { type: 'pause' }).state;
    expect(() => act(paused, { type: 'vote', option: '1' }, viewer)).toThrow('paused');
    const resumed = act(paused, { type: 'resume' }).state;
    expect(resumed.window).toBeGreaterThan(state.window);
    expect(resumed.resources).toEqual(state.resources);
    expect(getPuzzle(resumed)).not.toBeNull();
  });
  it('a single viewer repair can change the same host decisions from oxygen catastrophe to survival', () => {
    function journey(patch: boolean) {
      let state = createWorld(patch ? 'with-patch' : 'without-patch');
      for (const option of [
        'burn-navigation',
        'manual-flight',
        'seal-cabins',
        'jettison',
        'emergency-burn',
      ]) {
        state = act(state, { type: 'start' }).state;
        if (state.outcome) break;
        if (state.chapter === 3 && patch)
          state = play(
            state,
            [
              { type: 'scan', node: 'A' },
              { type: 'patch', node: 'A' },
            ],
            viewer,
          ).state;
        state = play(state, [{ type: 'close-challenge' }, { type: 'commit', option }]).state;
      }
      return state;
    }
    expect(journey(false).endingReason).toContain('oxygen');
    expect(journey(false).resources.hull).toBeGreaterThan(0);
    expect(journey(true).outcome).toBe('partial');
    expect(journey(true).resources.oxygen).toBe(4);
    expect(journey(true).systems.lifeSupport.marks.some((m) => m.kind === 'repair')).toBe(true);
  });
});
