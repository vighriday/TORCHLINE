import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mutateLivewire } from '@torchline/storage';
import { livewireAcceptance } from '../scripts/lib/livewire-acceptance.ts';
import { database } from './helpers.ts';
it('does not mistake simulation missions or an undeployed extension for a genuine-input backend path', () =>
  database(async (store) => {
    expect((await livewireAcceptance(store)).backendPathObserved).toBe(false);
    const owner = await store.ensureCreator('sim', 'Practice', 'simulation'),
      id = await store.create(owner);
    const action = async (a: Parameters<typeof mutateLivewire>[3]['action']) =>
      mutateLivewire(
        store,
        owner,
        id,
        { expectedVersion: (await store.get(id)).revision, commandId: randomUUID(), action: a },
        true,
      );
    await action({ type: 'open', game: 'Game', label: 'Attempt', preset: 'boss' });
    const stakeId = (await store.get(id)).state.livewire!.stake.id;
    await action({ type: 'lock', stakeId, solo: 'hull' });
    await action({ type: 'resolve', stakeId, outcome: 'success' });
    expect((await livewireAcceptance(store)).status).toBe('waiting_for_live_mission');
    await store.pool.query('DROP TABLE livewire_ballots; DROP TABLE livewire_stakes');
    expect((await livewireAcceptance(store)).status).toBe('not_deployed');
  }));
