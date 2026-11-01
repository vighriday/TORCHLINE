import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Command } from '@torchline/contracts';
import type { Creator, Store } from '@torchline/storage';
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
async function command(store: Store, id: string, creator: Creator, input: Command) {
  return store.command(
    id,
    { id: 'host', role: 'host', community: creator.id },
    creator.mode,
    (await store.get(id)).revision,
    randomUUID(),
    input,
  );
}
async function relayed(store: Store) {
  const source = await store.ensureCreator('sim-alpha', 'First community', 'simulation');
  const target = await store.ensureCreator('sim-beta', 'Next community', 'simulation');
  await store.optIn(target.id, true);
  const id = await store.create(source);
  for (const input of [
    { type: 'start' },
    { type: 'close-challenge' },
    { type: 'commit', option: 'burn-navigation' },
  ] as Command[])
    await command(store, id, source, input);
  const intent = await store.prepare(id, source, target.id, (await store.get(id)).revision);
  await store.observeRaid({
    messageId: randomUUID(),
    sourceId: source.id,
    targetId: target.id,
    mode: 'simulation',
    subscriptionId: 'simulation',
    notificationAt: new Date(intent.prepared_at.getTime() + 10).toISOString(),
  });
  await store.accept(intent.id, target);
  return { source, target, id };
}

describe('public Chronicle links', () => {
  it('let anyone with the link read an Ark across custodians until the creator withdraws it', () =>
    database(async (store) => {
      const { id, target } = await relayed(store);
      const app = await createApp(store, config, { workers: false });
      const session = async (channel: string) => {
        const login = await app.inject({
          method: 'POST',
          url: '/api/simulator/login',
          payload: { channel },
          headers: header,
        });
        return {
          ...header,
          cookie: login.cookies.map((item) => `${item.name}=${item.value}`).join('; '),
        };
      };
      const read = (token: string) =>
        app.inject({ method: 'POST', url: '/api/chronicle', payload: { token }, headers: header });
      try {
        // Only the current custodian publishes; the sending community no longer commands it.
        const previous = await session('alpha');
        expect(
          (
            await app.inject({
              method: 'POST',
              url: `/api/worlds/${id}/share`,
              payload: {},
              headers: previous,
            })
          ).statusCode,
        ).toBe(403);
        const receiver = await session('beta');
        const shared = await app.inject({
          method: 'POST',
          url: `/api/worlds/${id}/share`,
          payload: {},
          headers: receiver,
        });
        expect(shared.statusCode).toBe(200);
        const url = new URL(shared.json().url);
        expect(url.pathname).toBe('/chronicle/');
        const token = url.hash.slice(1);
        expect(token).toMatch(/^[a-f\d]{64}$/);
        // Only the hash is stored.
        expect(
          (await store.pool.query('SELECT hash FROM world_shares WHERE world_id=$1', [id])).rows[0]
            .hash,
        ).not.toBe(token);

        // No session: the public record names communities and keeps custody, with no controls.
        const page = await read(token);
        expect(page.statusCode).toBe(200);
        const body = page.json();
        expect(body.world.worldId).toBe(id);
        expect(Object.values(body.world.capabilities).every((value) => value === false)).toBe(true);
        expect(body.history.custody).toHaveLength(1);
        // Labels are current creator names; the practice login above renamed alpha.
        expect(body.history.custody[0].source.label).toBe('Simulation alpha');
        expect(
          body.history.events.some((event: { summary: string }) =>
            event.summary.includes('committed by Simulation alpha.'),
          ),
        ).toBe(true);
        expect(JSON.stringify(body)).not.toContain('"sim-alpha.');

        // Rotating replaces only this creator's link.
        const rotated = new URL(
          (
            await app.inject({
              method: 'POST',
              url: `/api/worlds/${id}/share`,
              payload: {},
              headers: receiver,
            })
          ).json().url,
        ).hash.slice(1);
        expect((await read(token)).statusCode).toBe(404);
        expect((await read(rotated)).statusCode).toBe(200);
        expect((await read('0'.repeat(64))).statusCode).toBe(404);
        expect((await read('not-a-token')).statusCode).toBe(400);

        // Disconnecting withdraws the creator's published links.
        await store.disconnectCreator(target.id);
        expect((await read(rotated)).statusCode).toBe(404);
      } finally {
        await app.close();
      }
    }));
});
