import { expect, it } from 'vitest';
import { createWorld } from '@torchline/engine';
import { conditionColor } from '../apps/web/src/final/condition.ts';

it('never presents a repaired but critically damaged system as healthy', () => {
  const system = createWorld('visual-condition').systems.hull;
  expect(conditionColor({ ...system, condition: 'repaired', integrity: 20 })).toBe('#d5533e');
  expect(conditionColor({ ...system, condition: 'jury-rigged', integrity: 45 })).toBe('#df9d47');
  expect(conditionColor({ ...system, condition: 'repaired', integrity: 80 })).toBe('#76c6c5');
});
