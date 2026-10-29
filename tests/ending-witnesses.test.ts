import { expect, it } from 'vitest';
import { replayEvents } from '@torchline/engine';
import { CURRENT_RULES_VERSION } from '@torchline/contracts';
import { endingWitnesses } from '../scripts/ending-witnesses.ts';

it('reaches and exactly replays colony, partial survival and catastrophic failure under current rules', () => {
  for (const [ending, { state, events }] of Object.entries(endingWitnesses())) {
    expect(state.rulesVersion).toBe(CURRENT_RULES_VERSION);
    expect(state.outcome).toBe(ending);
    expect(replayEvents(state.id, events, CURRENT_RULES_VERSION)).toEqual(state);
    expect(events.some((e) => e.command.type === 'commit')).toBe(true);
  }
});
