import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Command } from '@torchline/contracts';
import { Store, configureEpisode } from '@torchline/storage';
import type { Creator } from '@torchline/storage';
import { createApp } from '../apps/server/src/app.ts';
import type { AppConfig } from '../apps/server/src/app.ts';
import { database } from './helpers.ts';

const config: AppConfig = {
  mode: 'simulation',
  baseUrl: 'http://localhost:3000',
  sessionSecret: 'ab'.repeat(32),
  tokenKey: 'cd'.repeat(32),
  botSetupSecret: 'fixture',
};
const header = { 'x-torchline-request': '1' };
async function command(
  store: Store,
  id: string,
  creator: Creator,
  input: Command,
  mode = 'simulation',
) {
  return store.command(
    id,
    { id: creator.id, role: 'host', community: creator.id },
    mode as Creator['mode'],
    (await store.get(id, true)).revision,
    randomUUID(),
    input,
  );
}
async function chat(store: Store, channel: string, actor: string, text: Command, message: string) {
  const at = (await store.pool.query('SELECT clock_timestamp() AS at')).rows[0].at as Date;
  await store.enqueueChat(
    `delivery-${message}`,
    channel,
    actor,
    text,
    at.toISOString(),
    'fixture-key',
    `chat-${message}`,
  );
}

it('records why audience input did not apply, in the phase where it was typed', () =>
  database(async (store) => {
    const owner = await store.ensureCreator('captain', 'Captain', 'live');
    const id = await store.create(owner);
    await configureEpisode(store, owner, id, {
      investigation: null,
      challenge: null,
      allocation: null,
      decision: null,
    });
    await command(store, id, owner, { type: 'start' }, 'live');
    const world = (await store.get(id, true)).state;
    expect(world.phase).toBe('challenge');
    // A ballot is not a challenge input, so it cannot apply here and the reason must be recorded.
    await chat(store, owner.id, 'viewer-one', { type: 'vote', option: '1' }, 'wrong-phase');
    await chat(store, owner.id, 'viewer-one', { type: 'scan', node: 'A' }, 'right-phase');
    // The worker would apply the accepted scan; this fixture drains it so the window can close.
    await store.pool.query(
      'UPDATE eventsub_inbox SET processed_at=now() WHERE processed_at IS NULL',
    );
    const recorded = (
      await store.pool.query(
        'SELECT reason,dropped::integer AS dropped FROM input_rejections ORDER BY reason',
      )
    ).rows;
    expect(recorded).toEqual([{ reason: 'INPUT_WRONG_PHASE', dropped: 1 }]);
    expect(await store.rejections(id, world.window)).toEqual([
      { reason: 'INPUT_WRONG_PHASE', dropped: 1 },
    ]);
    // Duplicate provider retries and messages from a later window are not the audience's mistake.
    await store.enqueueChat(
      'delivery-wrong-phase',
      owner.id,
      'viewer-one',
      { type: 'vote', option: '1' },
      new Date().toISOString(),
      'fixture-key',
      'chat-wrong-phase',
    );
    expect(
      (await store.pool.query('SELECT sum(dropped)::integer AS count FROM input_rejections'))
        .rows[0].count,
    ).toBe(1);
    // A new window starts with a clean report, and the old window keeps its own record.
    await command(store, id, owner, { type: 'close-challenge' }, 'live');
    const advanced = (await store.get(id, true)).state;
    expect(advanced.window).toBeGreaterThan(world.window);
    expect(await store.rejections(id, advanced.window)).toEqual([]);
    expect(await store.rejections(id, world.window)).toHaveLength(1);
  }));

it('publishes the bounded current-window report to the captain without exposing viewer identity', () =>
  database(async (store) => {
    const creator = await store.ensureCreator('sim-alpha', 'Captain', 'simulation');
    const id = await store.create(creator);
    await command(store, id, creator, { type: 'start' });
    const app = await createApp(store, config, { workers: false });
    try {
      const login = await app.inject({
        method: 'POST',
        url: '/api/simulator/login',
        payload: { channel: 'alpha' },
        headers: header,
      });
      const headers = {
        ...header,
        cookie: login.cookies.map((item) => `${item.name}=${item.value}`).join('; '),
      };
      const window = (await store.get(id, true)).state.window;
      expect(
        (await app.inject({ url: '/api/state', headers })).json().world.rejections,
      ).toBeUndefined();
      await store.pool.query(
        `INSERT INTO input_rejections(world_id,input_window,reason,dropped) VALUES($1,$2,'INPUT_RATE_LIMITED',9)`,
        [id, window],
      );
      await store.pool.query(
        `INSERT INTO input_rejections(world_id,input_window,reason,dropped) VALUES($1,$2,'INPUT_BACKLOG',2)`,
        [id, window],
      );
      const report = (await app.inject({ url: '/api/state', headers })).json().world.rejections;
      expect(report).toEqual([
        { reason: 'INPUT_RATE_LIMITED', dropped: 9 },
        { reason: 'INPUT_BACKLOG', dropped: 2 },
      ]);
      expect(JSON.stringify(report)).not.toContain('viewer');
    } finally {
      await app.close();
    }
  }));
