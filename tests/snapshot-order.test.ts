import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { WorldPresentation } from '@torchline/contracts';
import type { DashboardSnapshot } from '../apps/web/src/api.ts';
import { orderedSnapshot } from '../apps/web/src/snapshot-order.ts';

const world = JSON.parse(
  readFileSync('docs/design/fixtures/pristine.json', 'utf8'),
) as WorldPresentation;
function snapshot(epoch: string, id: string | null, version = 0): DashboardSnapshot {
  return {
    me: { id: 'alpha', label: 'Captain', receiveOptIn: false },
    mode: 'simulation',
    channelEpoch: epoch,
    world: id ? { ...world, worldId: id, worldVersion: version } : null,
    integration: {
      credentialsConfigured: false,
      botAuthorized: false,
      publicHttps: false,
      genuineRaidVerified: false,
    },
  };
}
it('never rolls back a world or restores a parked/reassigned world from a delayed response', () => {
  const current = snapshot('10', 'ark-a', 20);
  expect(orderedSnapshot(current, snapshot('10', 'ark-a', 19))).toBe(current);
  const parked = snapshot('11', null);
  expect(orderedSnapshot(current, parked)).toBe(parked);
  expect(orderedSnapshot(parked, current)).toBe(parked);
  const next = snapshot('12', 'ark-b', 0);
  expect(orderedSnapshot(current, next)).toBe(next);
  expect(orderedSnapshot(next, current)).toBe(next);
  expect(orderedSnapshot(next, snapshot('12', 'ark-a', 999))).toBe(next);
  expect(
    orderedSnapshot(snapshot('9007199254740992', 'ark-a'), snapshot('9007199254740993', 'ark-b'))
      ?.world?.worldId,
  ).toBe('ark-b');
});
it('orders mission ballots independently without comparing unrelated identities or game versions', () => {
  const older = snapshot('1', 'ark', 4),
    newer = snapshot('1', 'ark', 4);
  older.world!.livewire = { revision: 1 } as WorldPresentation['livewire'];
  newer.world!.livewire = { revision: 2 } as WorldPresentation['livewire'];
  expect(orderedSnapshot(newer, older)).toBe(newer);
  expect(orderedSnapshot(older, newer)).toBe(newer);
  const signedOut = { ...snapshot('0', null), me: null };
  expect(orderedSnapshot(newer, signedOut)).toBe(signedOut);
  expect(() => orderedSnapshot(newer, { ...older, channelEpoch: 'invalid' })).toThrow(
    'channel version',
  );
});
