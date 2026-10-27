import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Command, WorldHistoryPage } from '@torchline/contracts';
import { readHandoffPreview, readWorldHistory, readWorldRecord } from '@torchline/storage';
import type { Store, Creator } from '@torchline/storage';
import { createApp } from '../apps/server/src/app.ts';
import { database } from './helpers.ts';
const config = {
  mode: 'simulation' as const,
  baseUrl: 'http://localhost:3000',
  sessionSecret: 'ab'.repeat(32),
  tokenKey: 'cd'.repeat(32),
  botSetupSecret: 'fixture-only',
};
async function command(store: Store, id: string, creator: Creator, input: Command) {
  return store.command(
    id,
    { id: 'private-actor', role: 'host', community: creator.id },
    creator.mode,
    (await store.get(id)).revision,
    randomUUID(),
    input,
  );
}
async function offer(store: Store) {
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
  return { source, target, id, intent };
}
describe('scoped complete records and inheritance consent', () => {
  it('pages every recorded event without ballots or actor IDs and pins the event snapshot', () =>
    database(async (store) => {
      const source = await store.ensureCreator('sim-alpha', 'Community', 'simulation');
      const id = await store.create(source);
      await command(store, id, source, { type: 'start' });
      for (let i = 0; i < 30; i++) {
        await command(store, id, source, { type: 'pause' });
        await command(store, id, source, { type: 'resume' });
      }
      await command(store, id, source, { type: 'close-challenge' });
      await command(store, id, source, { type: 'vote', option: '1' });
      const first = await readWorldHistory(store, source, id, { limit: 7 });
      await command(store, id, source, { type: 'pause' });
      const ids = first.events.map((e) => e.id);
      let page = first;
      while (page.nextCursor !== null) {
        page = await readWorldHistory(store, source, id, {
          limit: 7,
          before: page.nextCursor,
          through: first.throughSequence,
        });
        ids.push(...page.events.map((e) => e.id));
      }
      const expected = (await store.get(id)).events
        .filter((e) => e.sequence <= first.throughSequence && e.command.type !== 'vote')
        .map((e) => e.id)
        .reverse();
      expect(ids).toEqual(expected);
      expect(new Set(ids).size).toBe(ids.length);
      expect(JSON.stringify(first)).not.toContain('private-actor');
      expect(JSON.stringify(first)).not.toContain('commandId');
      expect((await store.get(id, true)).events).toHaveLength(30);
    }));
  it('allows current-custodian parked/terminal records and rejects unrelated, disconnected and other-mode readers', () =>
    database(async (store) => {
      const owner = await store.ensureCreator('owner', 'Owner', 'simulation');
      const other = await store.ensureCreator('other', 'Other', 'simulation');
      const id = await store.create(owner);
      await store.park(owner.id, id, false);
      expect((await readWorldRecord(store, owner, id)).id).toBe(id);
      await expect(readWorldRecord(store, other, id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(readWorldRecord(store, { ...owner, mode: 'live' }, id)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await store.disconnectCreator(owner.id);
      await expect(readWorldHistory(store, owner, id, { limit: 20 })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    }));
  it('previews exact frozen state for only the parties without verifying proof or changing custody', () =>
    database(async (store) => {
      const { source, target, id, intent } = await offer(store);
      const before = await store.get(id);
      const preview = await readHandoffPreview(store, target, intent.id);
      expect(preview.world.state).toEqual(before.state);
      expect(preview.world.revision).toBe(intent.frozen_revision);
      expect(preview.status).toBe('prepared');
      await expect(store.accept(intent.id, target)).rejects.toMatchObject({
        code: 'PROOF_REQUIRED',
      });
      expect((await store.get(id)).custodian_id).toBe(source.id);
      const third = await store.ensureCreator('third', 'Third', 'simulation');
      await expect(readHandoffPreview(store, third, intent.id)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      expect((await store.get(id)).revision).toBe(before.revision);
      await store.cancel(intent.id, source.id, 'cancelled');
      await expect(readHandoffPreview(store, target, intent.id)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    }));
  it('revokes preview on opt-out, expiry, changed frozen revision and disconnected consent', () =>
    database(async (store) => {
      const { source, target, id, intent } = await offer(store);
      await store.optIn(target.id, false);
      await expect(readHandoffPreview(store, source, intent.id)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await store.optIn(target.id, true);
      await store.pool.query('UPDATE worlds SET revision=revision+1 WHERE id=$1', [id]);
      await expect(readHandoffPreview(store, target, intent.id)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await store.pool.query('UPDATE worlds SET revision=revision-1 WHERE id=$1', [id]);
      await store.pool.query(
        "UPDATE handoffs SET expires_at=now()-interval '1 second' WHERE id=$1",
        [intent.id],
      );
      await expect(readHandoffPreview(store, source, intent.id)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await store.pool.query(
        "UPDATE handoffs SET expires_at=now()+interval '1 minute' WHERE id=$1",
        [intent.id],
      );
      await store.disconnectCreator(target.id);
      await expect(readHandoffPreview(store, source, intent.id)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    }));
  it('preserves full history and lineage for the new custodian while ending old preview and history rights', () =>
    database(async (store) => {
      const { source, target, id, intent } = await offer(store);
      await store.observeRaid({
        messageId: randomUUID(),
        sourceId: source.id,
        targetId: target.id,
        mode: 'simulation',
        subscriptionId: 'simulation',
        notificationAt: new Date(intent.prepared_at.getTime() + 10).toISOString(),
      });
      await store.accept(intent.id, target);
      const record = await readWorldHistory(store, target, id, { limit: 100 });
      expect(record.events).toHaveLength(3);
      expect(record.custody).toHaveLength(1);
      expect(record.custody[0].source.label).toBe(source.label);
      await expect(readWorldHistory(store, source, id, { limit: 100 })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(readHandoffPreview(store, target, intent.id)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    }));
  it('enforces HTTP session/mode/readonly boundaries, validates query limits and omits mutation capabilities', () =>
    database(async (store) => {
      const { source, target, id, intent } = await offer(store);
      const app = await createApp(store, config, { workers: false });
      const login = async (channel: string) => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/simulator/login',
          headers: { 'x-torchline-request': '1' },
          payload: { channel },
        });
        return {
          cookie: `torchline_sim_session=${response.cookies.find((c) => c.name === 'torchline_sim_session')!.value}`,
        };
      };
      try {
        const owner = await login('alpha'),
          receiver = await login('beta');
        for (const url of [
          `/api/worlds/${id}/history`,
          `/api/worlds/${id}/view`,
          `/api/handoffs/${intent.id}/preview`,
        ])
          expect((await app.inject({ url })).statusCode).toBe(401);
        expect(
          (await app.inject({ url: `/api/worlds/${id}/history`, headers: receiver })).statusCode,
        ).toBe(403);
        const preview = (
          await app.inject({ url: `/api/handoffs/${intent.id}/preview`, headers: receiver })
        ).json();
        expect(Object.values(preview.world.capabilities)).toEqual([
          false,
          false,
          false,
          false,
          false,
        ]);
        expect(preview.world.resources).toEqual((await store.get(id)).state.resources);
        for (const suffix of ['limit=101', 'limit=-1', 'before=abc', 'through=-1', 'unknown=x'])
          expect(
            (await app.inject({ url: `/api/worlds/${id}/history?${suffix}`, headers: owner }))
              .statusCode,
          ).toBe(400);
        const response = await app.inject({ url: `/api/worlds/${id}/history`, headers: owner });
        expect(response.statusCode).toBe(200);
        expect(response.headers['cache-control']).toBe('no-store');
        expect((response.json() as WorldHistoryPage).events).toHaveLength(3);
        const grant = await app.inject({
          method: 'POST',
          url: '/api/overlay-grant',
          headers: { ...owner, 'x-torchline-request': '1' },
          payload: {},
        });
        const exchange = await app.inject({
          method: 'POST',
          url: `/overlay/${source.id}/session`,
          headers: { 'x-torchline-request': '1' },
          payload: { token: new URL(grant.json().url).hash.slice(1) },
        });
        const overlayCookie = exchange.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
        expect(
          (
            await app.inject({
              url: `/api/worlds/${id}/history`,
              headers: { cookie: overlayCookie },
            })
          ).statusCode,
        ).toBe(401);
        expect(target.id).not.toBe(source.id);
      } finally {
        await app.close();
      }
    }));
});
