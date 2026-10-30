import { expect, it } from 'vitest';
import { CURRENT_RULES_VERSION, RULES_VERSION } from '@torchline/contracts';
import { createWorld, getPuzzle, previewChoices, titles } from '@torchline/engine';
import * as v2 from '../packages/engine/src/ark-v2.ts';
import * as v3 from '../packages/engine/src/ark-v3.ts';

it('reads chapter titles and choices from the rules version of the world being presented', () => {
  const historical = createWorld('dispatch-v2', RULES_VERSION);
  const current = createWorld('dispatch-v3', CURRENT_RULES_VERSION);
  expect(historical.rulesVersion).toBe(RULES_VERSION);
  expect(current.rulesVersion).toBe(CURRENT_RULES_VERSION);
  expect(titles(RULES_VERSION)).toEqual(v2.TITLES);
  expect(titles(CURRENT_RULES_VERSION)).toEqual(v3.TITLES);
  expect(previewChoices(historical)).toEqual(v2.previewChoices(historical));
  expect(previewChoices(current)).toEqual(v3.previewChoices(current));
  expect(getPuzzle(historical)).toEqual(v2.getPuzzle(historical));
  expect(getPuzzle(current)).toEqual(v3.getPuzzle(current));
});

it('fails loudly when the two rules versions drift apart without a deliberate decision', () => {
  // Divergence between rules versions is allowed: it is how a fork happens. It must be a decision
  // recorded here, never a silent edit that retitles or rebalances the other version's worlds.
  expect(v3.TITLES).toEqual(v2.TITLES);
  expect(v3.INITIAL_RESOURCES).toEqual(v2.INITIAL_RESOURCES);
});
