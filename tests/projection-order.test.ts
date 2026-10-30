import { expect, it } from 'vitest';
import { database } from './helpers.ts';
import { createApp } from '../apps/server/src/app.ts';

it('persists channel assignment epochs atomically and retries a projection that crosses reassignment', () =>
  database(async (store) => {
    const creator = await store.ensureCreator('sim-alpha', 'Captain', 'simulation');
    const first = await store.create(creator);
    const epoch = (await store.creator(creator.id))!.assignment_revision;
    await expect(
      store.transaction(async (c) => {
        await c.query('DELETE FROM channel_slots WHERE channel_id=$1', [creator.id]);
        throw Error('fixture rollback');
      }),
    ).rejects.toThrow('fixture rollback');
    expect((await store.creator(creator.id))!.assignment_revision).toBe(epoch);
    const app = await createApp(
      store,
      {
        mode: 'simulation',
        baseUrl: 'http://localhost:3100',
        sessionSecret: 'ab'.repeat(32),
        tokenKey: 'cd'.repeat(32),
        botSetupSecret: 'fixture',
      },
      { workers: false },
    );
    const login = await app.inject({
      method: 'POST',
      url: '/api/simulator/login',
      headers: { 'x-torchline-request': '1' },
      payload: { channel: 'alpha' },
    });
    const headers = { cookie: login.cookies.map((c) => `${c.name}=${c.value}`).join('; ') };
    const original = store.active.bind(store);
    let entered!: () => void,
      release!: () => void,
      hold = true;
    const reading = new Promise<void>((r) => (entered = r)),
      gate = new Promise<void>((r) => (release = r));
    store.active = async (...args) => {
      const result = await original(...args);
      if (hold) {
        hold = false;
        entered();
        await gate;
      }
      return result;
    };
    try {
      const pending = app.inject({ url: '/api/state', headers }).then((r) => r);
      await reading;
      await store.park(creator.id, first, false);
      const second = await store.create(creator);
      release();
      const result = await pending;
      expect(result.statusCode).toBe(200);
      expect(result.json().world.worldId).toBe(second);
      expect(BigInt(result.json().channelEpoch)).toBeGreaterThan(BigInt(epoch));
      expect((await store.get(first)).state.version).toBe(0);
    } finally {
      release();
      store.active = original;
      await app.close();
    }
  }));

it('rechecks a revoked session after a slow authenticated projection', () =>
  database(async (store) => {
    const app = await createApp(
      store,
      {
        mode: 'simulation',
        baseUrl: 'http://localhost:3100',
        sessionSecret: 'ab'.repeat(32),
        tokenKey: 'cd'.repeat(32),
        botSetupSecret: 'fixture',
      },
      { workers: false },
    );
    const login = await app.inject({
      method: 'POST',
      url: '/api/simulator/login',
      headers: { 'x-torchline-request': '1' },
      payload: { channel: 'alpha' },
    });
    const headers = { cookie: login.cookies.map((c) => `${c.name}=${c.value}`).join('; ') };
    const creator = (await store.creator('sim-alpha'))!;
    await store.create(creator);
    const original = store.active.bind(store);
    let entered!: () => void, release!: () => void;
    const reading = new Promise<void>((r) => (entered = r)),
      gate = new Promise<void>((r) => (release = r));
    store.active = async (...args) => {
      const result = await original(...args);
      entered();
      await gate;
      return result;
    };
    try {
      const pending = app.inject({ url: '/api/state', headers }).then((r) => r);
      await reading;
      await store.pool.query('DELETE FROM sessions WHERE channel_id=$1', [creator.id]);
      release();
      const result = await pending;
      expect(result.statusCode).toBe(401);
      expect(result.json().world).toBeUndefined();
    } finally {
      release();
      store.active = original;
      await app.close();
    }
  }));
