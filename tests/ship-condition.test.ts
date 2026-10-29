import { expect, it } from 'vitest';
import { createWorld } from '@torchline/engine';
import { conditionColor } from '../apps/web/src/visual-state.ts';

it('never presents a repaired but critically damaged system as healthy', () => {
  const system = createWorld('visual-condition').systems.hull;
  expect(conditionColor({ ...system, condition: 'repaired', integrity: 20 })).toBe('#f57865');
  expect(conditionColor({ ...system, condition: 'jury-rigged', integrity: 45 })).toBe('#ffc873');
  expect(conditionColor({ ...system, condition: 'repaired', integrity: 80 })).toBe('#8fdce4');
});
