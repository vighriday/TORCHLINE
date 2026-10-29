import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Command } from '@torchline/contracts';
import { database } from './helpers.ts';

async function playableWorld(store: import('@torchline/storage').Store) {
  const owner = await store.ensureCreator(`owner-${randomUUID()}`, 'Owner', 'simulation');
  const id = await store.create(owner);
  await store.command(
    id,
    { id: owner.id, role: 'host', community: owner.id },
    'simulation',
    0,
    randomUUID(),
    { type: 'start' },
  );
  return { owner, id };
}

it('allows exactly one winner when many callers mutate the same revision', () =>
  database(async (store) => {
    const { owner, id } = await playableWorld(store);
    const revision = (await store.get(id)).revision;
    const attempts = await Promise.allSettled(
      Array.from({ length: 64 }, () =>
        store.command(
          id,
          { id: owner.id, role: 'host', community: owner.id },
          'simulation',
          revision,
          randomUUID(),
          { type: 'close-challenge' } satisfies Command,
        ),
      ),
    );
    const fulfilled = attempts.filter((result) => result.status === 'fulfilled');
    const rejected = attempts.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(63);
    expect(
      rejected.every(
        (result) =>
          result.status === 'rejected' &&
          (result.reason as { code?: string }).code === 'STALE_VERSION',
      ),
    ).toBe(true);
    expect((await store.get(id)).state.phase).toBe('decision');
    expect(
      (
        await store.pool.query(
          'SELECT count(*)::integer AS count FROM world_events WHERE world_id=$1',
          [id],
        )
      ).rows[0].count,
    ).toBe(2);
  }));

it('commits one custody transfer under a burst of concurrent receiver accepts', () =>
  database(async (store) => {
    const source = await store.ensureCreator(`source-${randomUUID()}`, 'Source', 'simulation');
    const target = await store.ensureCreator(`target-${randomUUID()}`, 'Target', 'simulation');
    await store.optIn(target.id, true);
    const id = await store.create(source);
    for (const command of [
      { type: 'start' },
      { type: 'close-challenge' },
      { type: 'commit', option: 'burn-navigation' },
    ] as Command[])
      await store.command(
        id,
        { id: source.id, role: 'host', community: source.id },
        'simulation',
        (await store.get(id)).revision,
        randomUUID(),
        command,
      );
    const intent = await store.prepare(id, source, target.id, (await store.get(id)).revision);
    const notificationAt = new Date(intent.prepared_at.getTime() + 10).toISOString();
    await store.observeRaid({
      messageId: randomUUID(),
      sourceId: source.id,
      targetId: target.id,
      mode: 'simulation',
      subscriptionId: 'adversarial-fixture',
      notificationAt,
    });
    const attempts = await Promise.allSettled(
      Array.from({ length: 64 }, () => store.accept(intent.id, target)),
    );
    const fulfilled = attempts.filter((result) => result.status === 'fulfilled');
    const rejected = attempts.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(64);
    expect(rejected).toHaveLength(0);
    expect((await store.get(id)).custodian_id).toBe(target.id);
    expect(
      (
        await store.pool.query(
          'SELECT count(*)::integer AS count FROM custody_events WHERE world_id=$1',
          [id],
        )
      ).rows[0].count,
    ).toBe(1);
    expect(
      (
        await store.pool.query(
          "SELECT count(*)::integer AS count FROM handoffs WHERE id=$1 AND status='committed'",
          [intent.id],
        )
      ).rows[0].count,
    ).toBe(1);
  }));
