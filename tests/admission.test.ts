import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Store, configureEpisode, inputPolicy } from '@torchline/storage';
import type { Creator, InputPolicy } from '@torchline/storage';
import type { Command } from '@torchline/contracts';
import { database } from './helpers.ts';
import { createApp } from '../apps/server/src/app.ts';
import { liveConfig, providerFixture } from './twitch-provider.ts';

const policy: InputPolicy = {
  viewerBurst: 3,
  viewerPerSecond: 0.001,
  worldBurst: 100,
  worldPerSecond: 100,
  maxPending: 128,
};
async function command(store: Store, id: string, owner: Creator, command: Command) {
  return store.command(
    id,
    { id: owner.id, role: 'host', community: owner.id },
    'live',
    (await store.get(id, true)).revision,
    randomUUID(),
    command,
  );
}
async function setup(store: Store, channel = 'captain') {
  const owner = await store.ensureCreator(channel, channel, 'live'),
    id = await store.create(owner);
  await configureEpisode(store, owner, id, {
    investigation: null,
    challenge: null,
    allocation: null,
    decision: null,
  });
  await command(store, id, owner, { type: 'start' });
  return { owner, id };
}
async function input(
  store: Store,
  channel: string,
  actor: string,
  message: string,
  limits = policy,
  command: Command = { type: 'scan', node: 'A' },
) {
  const at = (await store.pool.query('SELECT clock_timestamp() AS at')).rows[0].at as Date;
  return store.enqueueChat(
    `delivery-${message}`,
    channel,
    actor,
    command,
    at.toISOString(),
    'private-fixture-key',
    `chat-${message}`,
    limits,
  );
}
async function worker(store: Store) {
  const provider = providerFixture();
  return createApp(store, liveConfig, { fetcher: provider.fetcher, workers: false });
}
it('shares persisted viewer limits across concurrent callbacks and Store instances; duplicate retries do not spend budgets', () =>
  database(async (store, url) => {
    const { owner, id } = await setup(store),
      before = (await store.get(id)).state;
    const second = new Store(url);
    try {
      await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          input(i % 2 ? store : second, owner.id, 'private-viewer', String(i)),
        ),
      );
      const counts = (
        await store.pool.query(
          "SELECT count(*) FILTER(WHERE processed_at IS NULL)::integer AS pending,count(*) FILTER(WHERE error='INPUT_RATE_LIMITED')::integer AS limited FROM eventsub_inbox",
        )
      ).rows[0];
      expect(counts).toEqual({ pending: 3, limited: 17 });
      const budgets = (await store.pool.query('SELECT * FROM input_limits ORDER BY subject')).rows;
      await Promise.all(
        Array.from({ length: 10 }, () => input(store, owner.id, 'private-viewer', '0')),
      );
      expect((await store.pool.query('SELECT * FROM input_limits ORDER BY subject')).rows).toEqual(
        budgets,
      );
      expect(
        (await store.pool.query('SELECT sum(dropped)::integer AS count FROM input_rejections'))
          .rows[0].count,
      ).toBe(17);
      expect(
        JSON.stringify((await store.pool.query('SELECT payload FROM eventsub_inbox')).rows),
      ).not.toContain('private-viewer');
      expect((await store.get(id)).state).toEqual(before);
    } finally {
      await second.close();
    }
  }));
it('refills from persisted server time and resets the viewer allowance only on a new input window', () =>
  database(async (store) => {
    const { owner, id } = await setup(store),
      one = { ...policy, viewerBurst: 1, viewerPerSecond: 0.001 };
    await input(store, owner.id, 'viewer', 'a', one);
    await input(store, owner.id, 'viewer', 'b', one);
    expect(
      (await store.pool.query("SELECT error FROM eventsub_inbox WHERE message_id='delivery-b'"))
        .rows[0].error,
    ).toBe('INPUT_RATE_LIMITED');
    await store.pool.query(
      "UPDATE input_limits SET observed_at=observed_at-interval '2000 seconds'",
    );
    await input(store, owner.id, 'viewer', 'c', one);
    const app = await worker(store);
    try {
      await app.getDecorator<() => Promise<void>>('tick')();
      await command(store, id, owner, { type: 'close-challenge' });
      await input(store, owner.id, 'viewer', 'd', one, { type: 'vote', option: '1' });
      await app.getDecorator<() => Promise<void>>('tick')();
      const world = await store.get(id);
      expect(Object.values(world.state.votes)).toHaveLength(1);
      expect(
        (
          await store.pool.query(
            "SELECT error,processed_at FROM eventsub_inbox WHERE message_id='delivery-d'",
          )
        ).rows[0],
      ).toMatchObject({ error: null, processed_at: expect.any(Date) });
    } finally {
      await app.close();
    }
  }));
it('bounds pending work per world without consuming another viewer allowance on backlog denial', () =>
  database(async (store) => {
    const { owner } = await setup(store),
      limits = { ...policy, maxPending: 3 };
    for (let i = 0; i < 10; i++) await input(store, owner.id, `viewer-${i}`, String(i), limits);
    expect(
      (
        await store.pool.query(
          'SELECT count(*)::integer AS count FROM eventsub_inbox WHERE processed_at IS NULL',
        )
      ).rows[0].count,
    ).toBe(3);
    expect(
      (
        await store.pool.query(
          "SELECT count(*)::integer AS count FROM eventsub_inbox WHERE error='INPUT_BACKLOG'",
        )
      ).rows[0].count,
    ).toBe(7);
    expect(
      (
        await store.pool.query(
          "SELECT count(*)::integer AS count FROM input_limits WHERE subject LIKE 'viewer:%'",
        )
      ).rows[0].count,
    ).toBe(3);
  }));
it('isolates world budgets and processes a healthy channel during another channel flood', () =>
  database(async (store) => {
    const a = await setup(store, 'a'),
      b = await setup(store, 'b');
    for (let i = 0; i < 45; i++) await input(store, a.owner.id, `viewer-${i}`, `a-${i}`);
    await input(store, b.owner.id, 'healthy-viewer', 'healthy');
    const app = await worker(store);
    try {
      await app.getDecorator<() => Promise<void>>('tick')();
      expect(
        (
          await store.pool.query(
            "SELECT processed_at FROM eventsub_inbox WHERE message_id='delivery-healthy'",
          )
        ).rows[0].processed_at,
      ).toBeInstanceOf(Date);
      expect((await store.get(b.id)).state.challenge?.scanned).toContain('A');
      expect(
        (
          await store.pool.query(
            'SELECT count(*)::integer AS count FROM eventsub_inbox WHERE processed_at IS NULL',
          )
        ).rows[0].count,
      ).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  }));
it('does not admit stale/unsupported input or spend a current window budget for it', () =>
  database(async (store) => {
    const { owner } = await setup(store);
    await input(store, owner.id, 'viewer', 'vote', policy, { type: 'vote', option: '1' });
    await store.enqueueChat(
      'stale',
      owner.id,
      'viewer',
      { type: 'scan', node: 'A' },
      '2020-01-01T00:00:00Z',
      'private-fixture-key',
      'stale',
    );
    expect(
      (
        await store.pool.query(
          'SELECT count(*)::integer AS count FROM eventsub_inbox WHERE processed_at IS NULL',
        )
      ).rows[0].count,
    ).toBe(0);
    expect(
      (await store.pool.query('SELECT count(*)::integer AS count FROM input_limits')).rows[0].count,
    ).toBe(0);
  }));
it('validates operational overrides instead of silently disabling protection', () => {
  expect(inputPolicy({ INPUT_MAX_PENDING: '200' }).maxPending).toBe(200);
  for (const value of ['0', '-1', 'NaN', 'Infinity', '1000000', '1.5'])
    expect(() => inputPolicy({ INPUT_MAX_PENDING: value })).toThrow('INPUT_MAX_PENDING');
});
