import { expect, it } from 'vitest';
import { CURRENT_RULES_VERSION } from '@torchline/contracts';
import { analyzeCurrentRules } from '../scripts/balance-v3.ts';

it('reaches every ending under current rules without a dead end, a stall or an unreplayable witness', () => {
  const report = analyzeCurrentRules({ seasons: 1200, seed: 20261030 });
  expect(report.rulesVersion).toBe(CURRENT_RULES_VERSION);
  // No reachable state may lack a legal action, and no boundary may refuse every legal action.
  expect(report.deadEnds).toEqual([]);
  expect(report.abandoned).toBe(0);
  expect(report.stalled).toBe(0);
  expect(report.completed).toBe(report.seasons);
  // Catastrophic failure, partial survival and a viable colony are all reachable, and each
  // recorded witness replays exactly under the pinned rules.
  for (const ending of ['colony', 'partial', 'wreck'] as const) {
    expect(report.endings[ending]).toBeGreaterThan(0);
    expect(report.witnesses[ending]?.replayed).toBe(true);
  }
  // A refusal must be a rule the game enforces, never an internal failure.
  expect(Object.keys(report.refused).sort()).toEqual(['ALREADY_DISCOVERED', 'UNAFFORDABLE']);
  // The sweep really did attempt every legal action at every boundary it reached.
  expect(report.boundaryActions).toBeGreaterThan(report.seasons * 10);
  expect(report.distinctStates).toBeGreaterThan(5000);
}, 180_000);
