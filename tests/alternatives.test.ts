import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Command, LivewireRequest } from '@torchline/contracts';
import {
  mutateLivewire,
  readAlternatives,
  readSharedAlternatives,
  shareWorld,
} from '@torchline/storage';
import type { Creator, Store } from '@torchline/storage';
import { database } from './helpers.ts';

async function command(store: Store, id: string, creator: Creator, input: Command) {
  return store.command(
    id,
    { id: 'captain', role: 'host', community: creator.id },
    creator.mode,
    (await store.get(id)).revision,
    randomUUID(),
    input,
  );
}
async function mission(
  store: Store,
  id: string,
  creator: Creator,
  action: LivewireRequest['action'],
) {
  await mutateLivewire(
    store,
    creator,
    id,
    { expectedVersion: (await store.get(id)).revision, commandId: randomUUID(), action },
    true,
  );
}
const eventOf = async (store: Store, id: string, type: string) =>
  (await store.get(id)).events.filter((event) => event.command.type === type).at(-1)!;

describe('one-step decision alternatives', () => {
  it('replays every option of a saved decision from the pinned pre-decision state', () =>
    database(async (store) => {
      const creator = await store.ensureCreator('sim-alpha', 'Alpha crew', 'simulation');
      const id = await store.create(creator);
      for (const input of [
        { type: 'start' },
        { type: 'close-challenge' },
        { type: 'commit', option: 'burn-navigation' },
      ] as Command[])
        await command(store, id, creator, input);
      const saved = await store.get(id);
      const decision = await eventOf(store, id, 'commit');
      const result = await readAlternatives(store, creator, id, decision.id);
      expect(result).toMatchObject({
        kind: 'decision',
        chapter: 1,
        title: 'Sacrifice navigation',
        community: { id: 'sim-alpha', label: 'Alpha crew' },
        // The chosen branch is recomputed and must reproduce the saved event exactly.
        verified: true,
      });
      const [chosen, other] = result.branches;
      expect(chosen).toMatchObject({
        option: 'burn-navigation',
        chosen: true,
        lost: ['navigation'],
        debts: [{ kind: 'blind-jump', dueChapter: 2 }],
      });
      // The chosen branch lands exactly where the saved world did.
      expect(chosen.resources).toEqual(saved.state.resources);
      expect(other).toMatchObject({
        option: 'seal-habitat',
        chosen: false,
        available: true,
        debts: [],
        lost: [],
      });
      expect(other.resources!.passengers).toBe(saved.state.resources.passengers - 48);
      expect(other.resources!.navigation).toBeGreaterThan(0);
      // Reading alternatives never writes: same version, same history.
      const after = await store.get(id);
      expect(after.state).toEqual(saved.state);
      expect(after.events).toHaveLength(saved.events.length);
    }));

  it('replays the opposite attested LIVEWIRE result and refuses events without alternatives', () =>
    database(async (store) => {
      const creator = await store.ensureCreator('sim-alpha', 'Alpha crew', 'simulation');
      const id = await store.create(creator);
      await mission(store, id, creator, {
        type: 'open',
        preset: 'challenge',
        game: 'Minecraft',
        label: 'Lava gap jump',
      });
      const stakeId = (await store.get(id)).state.livewire!.stake.id;
      await mission(store, id, creator, { type: 'lock', stakeId, solo: 'hull' });
      await mission(store, id, creator, { type: 'resolve', stakeId, outcome: 'failure' });
      const resolved = await eventOf(store, id, 'livewire-resolve');
      const result = await readAlternatives(store, creator, id, resolved.id);
      expect(result).toMatchObject({
        kind: 'livewire',
        chapter: 0,
        title: 'Minecraft · Lava gap jump',
        verified: true,
      });
      const before = result.before.hull;
      expect(result.branches.map((branch) => [branch.option, branch.chosen])).toEqual([
        ['failure', true],
        ['success', false],
      ]);
      expect(result.branches[0].resources!.hull).toBe(before - 6);
      expect(result.branches[1].resources!.hull).toBe(before + 3);

      const opened = await eventOf(store, id, 'livewire-open');
      await expect(readAlternatives(store, creator, id, opened.id)).rejects.toMatchObject({
        code: 'NOT_A_DECISION',
      });
      await expect(readAlternatives(store, creator, id, 'missing')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    }));

  it('limits alternatives to the custodian or a public Chronicle link', () =>
    database(async (store) => {
      const creator = await store.ensureCreator('sim-alpha', 'Alpha crew', 'simulation');
      const stranger = await store.ensureCreator('sim-beta', 'Beta crew', 'simulation');
      const id = await store.create(creator);
      for (const input of [
        { type: 'start' },
        { type: 'close-challenge' },
        { type: 'commit', option: 'seal-habitat' },
      ] as Command[])
        await command(store, id, creator, input);
      const decision = await eventOf(store, id, 'commit');
      await expect(readAlternatives(store, stranger, id, decision.id)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      const token = 'ab'.repeat(32);
      await shareWorld(store, creator, id, token);
      const shared = await readSharedAlternatives(store, token, decision.id);
      expect(shared.mode).toBe('simulation');
      expect(shared.alternatives.branches[0]).toMatchObject({
        option: 'seal-habitat',
        chosen: true,
      });
      await expect(
        readSharedAlternatives(store, 'cd'.repeat(32), decision.id),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }));
});
