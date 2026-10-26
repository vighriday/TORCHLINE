import { describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import type { Fetcher } from '@torchline/twitch';
import type { Command } from '@torchline/contracts';
import { encryptSecret } from '@torchline/twitch';
import { createApp } from '../apps/server/src/app.ts';
import type { AppConfig } from '../apps/server/src/app.ts';
import { database } from './helpers.ts';
const header = { 'x-torchline-request': '1' };
const baseConfig: AppConfig = {
  mode: 'simulation',
  baseUrl: 'http://localhost:3000',
  sessionSecret: 'ab'.repeat(32),
  tokenKey: 'cd'.repeat(32),
  botSetupSecret: 'operator-secret',
  eventsubSecret: 'eventsub-test-secret-adequate-length',
};
describe('HTTP authorization, projections and Twitch integration contracts', () => {
  it('isolates simulation background work from live inbox, publication and handoff expiry', () =>
    database(async (store) => {
      const source = await store.ensureCreator('live-source', 'Live source', 'live');
      const target = await store.ensureCreator('live-target', 'Live target', 'live');
      await store.optIn(target.id, true);
      const id = await store.create(source);
      const host = { id: source.id, community: source.id, role: 'host' as const };
      await store.command(id, host, 'live', 0, randomUUID(), { type: 'start' });
      await store.enqueueChat(
        'live-inbox',
        source.id,
        'viewer',
        { type: 'scan', node: 'A' },
        new Date().toISOString(),
      );
      const simulation = await createApp(store, baseConfig, { workers: false });
      const live = await createApp(store, { ...baseConfig, mode: 'live' }, { workers: false });
      const tick = (app: typeof live) => (app as unknown as { tick: () => Promise<void> }).tick();
      try {
        await tick(simulation);
        expect((await store.get(id)).state.challenge.scanned).toEqual([]);
        expect(
          (await store.pool.query('SELECT processed_at FROM eventsub_inbox')).rows[0].processed_at,
        ).toBeNull();
        expect(
          (await store.pool.query('SELECT delivered_at FROM outbox')).rows.every(
            (row) => row.delivered_at === null,
          ),
        ).toBe(true);
        await tick(live);
        expect((await store.get(id)).state.challenge.scanned).toEqual(['A']);
        for (const command of [
          { type: 'close-challenge' },
          { type: 'commit', option: 'burn-navigation' },
        ] as Command[]) {
          await store.command(
            id,
            host,
            'live',
            (await store.get(id)).revision,
            randomUUID(),
            command,
          );
        }
        const intent = await store.prepare(
          id,
          source,
          target.id,
          (await store.get(id)).revision,
          -1,
        );
        await tick(simulation);
        expect((await store.get(id)).frozen_by).toBe(intent.id);
        expect((await store.handoffs(source.id))[0].status).toBe('prepared');
        await tick(live);
        expect((await store.get(id)).frozen_by).toBeNull();
        expect((await store.handoffs(source.id))[0].status).toBe('expired');
      } finally {
        await simulation.close();
        await live.close();
      }
    }));
  it('keeps controls private, rejects cross-origin input and projects a mutable simulation safely', () =>
    database(async (store) => {
      const app = await createApp(store, baseConfig, { workers: false });
      try {
        expect(
          (await app.inject({ method: 'POST', url: '/api/worlds', payload: {}, headers: header }))
            .statusCode,
        ).toBe(401);
        expect(
          (
            await app.inject({
              method: 'POST',
              url: '/api/simulator/login',
              payload: { channel: 'alpha' },
              headers: { ...header, origin: 'https://attacker.example' },
            })
          ).statusCode,
        ).toBe(403);
        const login = await app.inject({
          method: 'POST',
          url: '/api/simulator/login',
          payload: { channel: 'alpha' },
          headers: header,
        });
        expect(login.statusCode).toBe(200);
        const cookie = `torchline_session=${login.cookies.find((c) => c.name === 'torchline_session')!.value}`;
        const auth = { ...header, cookie };
        const created = (
          await app.inject({ method: 'POST', url: '/api/worlds', payload: {}, headers: auth })
        ).json();
        const world = await store.get(created.id);
        const started = await app.inject({
          method: 'POST',
          url: `/api/worlds/${world.id}/commands`,
          payload: { command: { type: 'start' }, expectedVersion: 0, commandId: randomUUID() },
          headers: auth,
        });
        expect(started.statusCode).toBe(200);
        expect(started.json().world.resources.hull).toBe(70);
        expect(started.json().world.schemaVersion).toBe('2026-10-26.1');
        expect(started.json().world.events[0]).not.toHaveProperty('actor');
        expect(started.json().world).not.toHaveProperty('state');
        const malformed = await app.inject({
          method: 'POST',
          url: `/api/worlds/${world.id}/commands`,
          payload: {
            command: { type: 'start' },
            expectedVersion: 1,
            commandId: randomUUID(),
            actor: { role: 'host' },
          },
          headers: auth,
        });
        expect(malformed.statusCode).toBe(400);
        const overlay = await app.inject({
          method: 'POST',
          url: '/api/overlay-grant',
          payload: {},
          headers: auth,
        });
        const token = new URL(overlay.json().url).hash.slice(1);
        const exchange = await app.inject({
          method: 'POST',
          url: '/overlay/sim-alpha/session',
          payload: { token },
          headers: header,
        });
        const overlayCookie = exchange.cookies.find((c) => c.name === 'torchline_overlay')!;
        expect(overlayCookie.path).toBe('/overlay/sim-alpha/');
        expect(
          (
            await app.inject({
              method: 'POST',
              url: '/api/worlds',
              payload: {},
              headers: { ...header, cookie: `torchline_overlay=${overlayCookie.value}` },
            })
          ).statusCode,
        ).toBe(401);
        expect(JSON.stringify(started.json())).not.toContain(baseConfig.sessionSecret);
      } finally {
        await app.close();
      }
    }));
  it('exchanges a provider contract response once and stores tokens encrypted', () =>
    database(async (store) => {
      const calls: string[] = [];
      const fetcher: Fetcher = async (input, init) => {
        calls.push(String(input));
        if (String(input).endsWith('/token')) {
          expect(new URLSearchParams(String(init?.body)).get('redirect_uri')).toBe(
            'http://localhost:3000/auth/twitch/callback',
          );
          return Response.json({
            access_token: 'fixture-token',
            refresh_token: 'fixture-refresh',
            expires_in: 3600,
            scope: ['channel:bot'],
          });
        }
        return Response.json({
          client_id: 'fixture-client',
          user_id: '42',
          login: 'creator',
          scopes: ['channel:bot'],
          expires_in: 3600,
        });
      };
      const app = await createApp(
        store,
        {
          ...baseConfig,
          mode: 'live',
          twitchClientId: 'fixture-client',
          twitchClientSecret: 'fixture-secret',
        },
        { workers: false, fetcher },
      );
      try {
        const start = await app.inject('/auth/twitch');
        expect(start.statusCode).toBe(302);
        const url = new URL(start.headers.location!);
        const state = url.searchParams.get('state')!;
        const cookie = `torchline_oauth=${start.cookies.find((c) => c.name === 'torchline_oauth')!.value}`;
        expect(url.searchParams.get('scope')).toBe('channel:bot');
        const callback = await app.inject({
          url: `/auth/twitch/callback?code=fixture-code&state=${state}`,
          headers: { cookie },
        });
        expect(callback.statusCode).toBe(302);
        expect(calls).toHaveLength(2);
        const grant = (await store.pool.query('SELECT * FROM oauth_grants')).rows[0];
        expect(JSON.stringify(grant.encrypted)).not.toContain('fixture-token');
        expect(grant.id).toBe('42');
        const replay = await app.inject({
          url: `/auth/twitch/callback?code=fixture-code&state=${state}`,
          headers: { cookie },
        });
        expect(replay.statusCode).toBe(403);
        expect(calls).toHaveLength(2);
        expect(
          (
            await app.inject({
              method: 'POST',
              url: '/api/simulator/login',
              payload: { channel: 'alpha' },
              headers: header,
            })
          ).statusCode,
        ).toBe(403);
      } finally {
        await app.close();
      }
    }));
  it('durably ingests signed chat, applies once, filters mirrors and handles challenge/revocation', () =>
    database(async (store) => {
      const owner = await store.ensureCreator('42', 'Creator', 'live');
      await store.pool.query(
        "INSERT INTO oauth_grants(id,role,scopes,encrypted) VALUES('42','creator',$1,$2)",
        [['channel:bot'], encryptSecret({ access_token: 'creator-fixture' }, baseConfig.tokenKey)],
      );
      const worldId = await store.create(owner);
      await store.command(
        worldId,
        { id: '42', community: '42', role: 'host' },
        'live',
        0,
        randomUUID(),
        { type: 'start' },
      );
      await store.pool.query(
        "INSERT INTO oauth_grants(id,role,scopes,encrypted) VALUES('99','bot',$1,$2)",
        [
          ['user:bot', 'user:read:chat', 'user:write:chat'],
          encryptSecret({ access_token: 'fixture' }, baseConfig.tokenKey),
        ],
      );
      const app = await createApp(store, { ...baseConfig, mode: 'live' }, { workers: false });
      const subscription = {
        id: 'chat-sub',
        type: 'channel.chat.message',
        version: '1',
        status: 'enabled',
        condition: { broadcaster_user_id: '42', user_id: '99' },
        transport: {
          method: 'webhook',
          callback: `${baseConfig.baseUrl}/integrations/twitch/eventsub`,
        },
      };
      const event = {
        broadcaster_user_id: '42',
        chatter_user_id: '77',
        message_id: 'chat-message',
        message: { text: '!scan A' },
      };
      const deliver = async (body: unknown, id: string, kind = 'notification', corrupt = false) => {
        const raw = Buffer.from(JSON.stringify(body));
        const timestamp = new Date().toISOString();
        return app.inject({
          method: 'POST',
          url: '/integrations/twitch/eventsub',
          payload: raw,
          headers: {
            'content-type': 'application/json',
            'twitch-eventsub-message-id': id,
            'twitch-eventsub-message-timestamp': timestamp,
            'twitch-eventsub-message-type': kind,
            'twitch-eventsub-message-signature':
              'sha256=' +
              createHmac('sha256', baseConfig.eventsubSecret!)
                .update(id + timestamp)
                .update(corrupt ? Buffer.from('tamper') : raw)
                .digest('hex'),
          },
        });
      };
      try {
        const challenge = await deliver(
          { subscription, challenge: 'plain-challenge' },
          'challenge',
          'webhook_callback_verification',
        );
        expect(challenge.statusCode).toBe(200);
        expect(challenge.body).toBe('plain-challenge');
        await store.pool.query("UPDATE subscriptions SET confirmed_at=now() WHERE id='chat-sub'");
        expect((await deliver({ subscription, event }, 'delivery-1')).statusCode).toBe(204);
        const inbox = (
          await store.pool.query('SELECT payload FROM eventsub_inbox WHERE message_id=$1', [
            'delivery-1',
          ])
        ).rows[0];
        expect(inbox.payload.actorId).not.toBe('77');
        expect(JSON.stringify(inbox.payload)).not.toContain('!scan A');
        await (app as unknown as { tick: () => Promise<void> }).tick();
        await deliver({ subscription, event }, 'delivery-1');
        await (app as unknown as { tick: () => Promise<void> }).tick();
        await deliver({ subscription, event }, 'different-delivery-same-chat');
        await (app as unknown as { tick: () => Promise<void> }).tick();
        expect((await store.get(worldId)).state.challenge.scanned).toEqual(['A']);
        expect((await store.get(worldId)).events).toHaveLength(2);
        await deliver(
          { subscription, event: { ...event, source_broadcaster_user_id: 'remote' } },
          'mirror',
        );
        expect(
          (await store.pool.query('SELECT 1 FROM eventsub_inbox WHERE message_id=$1', ['mirror']))
            .rowCount,
        ).toBe(0);
        expect(
          (await deliver({ subscription, event }, 'tamper', 'notification', true)).statusCode,
        ).toBe(403);
        expect(
          (
            await deliver(
              { subscription: { ...subscription, status: 'authorization_revoked' } },
              'revoke',
              'revocation',
            )
          ).statusCode,
        ).toBe(204);
        expect((await deliver({ subscription, event }, 'after-revoke')).statusCode).toBe(403);
      } finally {
        await app.close();
      }
    }));
});
