import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createWorld,
  getChoices,
  normalizeAllocation,
  previewChoices,
  replayEvents,
} from '@torchline/engine';
import { CURRENT_RULES_VERSION } from '@torchline/contracts';
import type { Command, WorldEvent, WorldState } from '@torchline/contracts';
import { act, host, viewer } from './helpers.ts';

const fresh = () => createWorld('cooperative', CURRENT_RULES_VERSION);
function allocated(hull = 1, oxygen = 1, budget = 5) {
  let s = fresh();
  for (const command of [
    { type: 'configure-cooperation', budget, investigation: false },
    { type: 'start' },
    { type: 'close-challenge' },
    { type: 'allocate', hull, oxygen },
    { type: 'close-allocation' },
  ] as Command[])
    s = act(s, command).state;
  return s;
}
describe('immutable ark-v3 cooperation', () => {
  it('preserves v2 rules and rejects v3 commands on historical worlds', () => {
    expect(createWorld('legacy').rulesVersion).toBe('ark-v2');
    expect(() => act(createWorld('legacy'), { type: 'allocate', hull: 1, oxygen: 0 })).toThrow(
      'ark-v3',
    );
    expect(() =>
      act(fresh(), { type: 'configure-cooperation', budget: 5, investigation: true }, viewer),
    ).toThrow('host');
  });
  it('exhaustively normalizes all two-resource aggregate weights up to 100 and budgets 0..10', () => {
    for (let h = 0; h <= 100; h++)
      for (let o = 0; o <= 100; o++)
        for (let b = 0; b <= 10; b++) {
          const plan = normalizeAllocation({ crew: { hull: h, oxygen: o } }, b);
          expect(plan.hull + plan.oxygen).toBe(h + o ? b : 0);
          expect(Number.isInteger(plan.hull)).toBe(true);
          expect(plan.hull).toBeGreaterThanOrEqual(0);
          expect(plan.oxygen).toBeGreaterThanOrEqual(0);
          expect(plan).toEqual(normalizeAllocation({ crew: { hull: h * 2, oxygen: o * 2 } }, b));
        }
  });
  it('uses latest account preference, closes once, spends bounded real power and records causality', () => {
    let s = allocated();
    expect(s.cooperation!.plan).toEqual({ hull: 3, oxygen: 2 });
    expect(() => act(s, { type: 'allocate', hull: 5, oxygen: 0 }, viewer)).toThrow('closed');
    expect(() => act(s, { type: 'close-allocation' })).toThrow('closed');
    const eventId = s.cooperation!.closedByEventId;
    const next = act(s, { type: 'commit', option: 'seal-habitat' });
    expect(next.state.resources).toMatchObject({
      hull: 63,
      oxygen: 64,
      power: 55,
      passengers: 168,
    });
    expect(next.event.causes).toContain(eventId);
    expect(next.event.summary).toContain('5/5 power');
    expect(next.state.systems.hull.marks.at(-1)?.kind).toBe('repair');
    expect(next.state.cooperation!.budget).toBe(0);
    s = act(
      act(fresh(), { type: 'configure-cooperation', budget: 7, investigation: false }).state,
      { type: 'start' },
    ).state;
    s = act(s, { type: 'close-challenge' }).state;
    s = act(s, { type: 'allocate', hull: 5, oxygen: 0 }, viewer).state;
    s = act(s, { type: 'allocate', hull: 0, oxygen: 1 }, viewer).state;
    expect(Object.keys(s.cooperation!.preferences)).toHaveLength(1);
    expect(s.cooperation!.plan).toEqual({ hull: 0, oxygen: 7 });
  });
  it('does not invent repairs without participation or charge capped benefits', () => {
    let s = allocated(1, 0, 10);
    s.resources.hull = 100;
    const next = act(s, { type: 'commit', option: 'burn-navigation' }).state;
    expect(next.resources.hull).toBe(100);
    expect(next.resources.power).toBe(45); // ten choice power + only five useful repair units
    s = allocated(1, 0, 5);
    s.cooperation!.plan = { hull: 0, oxygen: 0 };
    expect(act(s, { type: 'commit', option: 'seal-habitat' }).state.resources.power).toBe(60);
  });
  it('never resurrects lethal overkill; oxygen recovery does not repair machinery', () => {
    let s = allocated(1, 0, 1);
    s.resources.hull = 2;
    expect(act(s, { type: 'commit', option: 'seal-habitat' }).state.outcome).toBe('wreck');
    s = allocated(0, 1, 5);
    s.systems.lifeSupport.condition = 'damaged';
    s.systems.lifeSupport.integrity = 35;
    const next = act(s, { type: 'commit', option: 'seal-habitat' }).state;
    expect(next.systems.lifeSupport).toEqual(s.systems.lifeSupport);
  });
  it('turns investigation priority into an actual shared clue and freezes advisory votes', () => {
    let s = act(fresh(), { type: 'configure-cooperation', budget: 0, investigation: true }).state;
    s = act(s, { type: 'start' }).state;
    expect(s.phase).toBe('investigation');
    expect(() => act(s, { type: 'scan', node: 'A' }, viewer)).toThrow('closed');
    s = act(s, { type: 'inspect', area: 'life' }, viewer).state;
    s = act(s, { type: 'inspect', area: 'engine' }, viewer).state;
    s = act(s, { type: 'close-investigation' }).state;
    expect(s.challenge.scanned).toEqual(['C']);
    s = act(s, { type: 'close-challenge' }).state;
    s = act(s, { type: 'vote', option: '1' }, viewer).state;
    s = act(s, { type: 'close-voting' }).state;
    expect(s.phase).toBe('awaiting-commit');
    expect(() => act(s, { type: 'vote', option: '2' }, viewer)).toThrow('not open');
    expect(act(s, { type: 'commit', option: 'seal-habitat' }).event.summary).toContain('overrode');
  });
  it('reserves the full declared budget, forecasts combined outcomes and replays full events', () => {
    const events: WorldEvent[] = [];
    let s = fresh();
    for (const command of [
      { type: 'configure-cooperation', budget: 5, investigation: false },
      { type: 'start' },
      { type: 'close-challenge' },
      { type: 'allocate', hull: 3, oxygen: 2 },
      { type: 'close-allocation' },
      { type: 'vote', option: '1' },
      { type: 'close-voting' },
    ] as Command[]) {
      const next = act(s, command);
      s = next.state;
      events.push(next.event);
    }
    const preview = previewChoices(s)[0].preview;
    const next = act(s, { type: 'commit', option: 'burn-navigation' });
    s = next.state;
    events.push(next.event);
    expect(preview?.resources).toEqual(s.resources);
    expect(replayEvents(s.id, JSON.parse(JSON.stringify(events)))).toEqual(s);
    const poor = allocated();
    poor.resources.power = 14;
    expect(previewChoices(poor)[0].available).toBe(false);
    expect(() => act(poor, { type: 'commit', option: 'burn-navigation' })).toThrow('reserve');
  });
  it('retains all three endings across the complete authored tree without allocation', () => {
    const outcomes = new Set<string>();
    function walk(s: WorldState) {
      if (s.outcome) {
        outcomes.add(s.outcome);
        return;
      }
      s = act(s, { type: 'start' }).state;
      if (s.outcome) {
        outcomes.add(s.outcome);
        return;
      }
      s = act(s, { type: 'close-challenge' }).state;
      for (const choice of getChoices(s)) {
        try {
          walk(
            applyCommand(s, { type: 'commit', option: choice.id }, host, {
              commandId: `branch-${s.version}`,
              at: '2026-10-27T00:00:00Z',
            }).state,
          );
        } catch (e) {
          if (!(e instanceof Error && e.message.includes('Not enough'))) throw e;
        }
      }
    }
    walk(fresh());
    expect([...outcomes].sort()).toEqual(['colony', 'partial', 'wreck']);
  });
});
