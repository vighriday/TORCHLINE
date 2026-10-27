import { expect, it } from 'vitest';

import { randomUUID } from 'node:crypto';
import type { Command } from '@torchline/contracts';
import { database } from './helpers.ts';
import { createApp } from '../apps/server/src/app.ts';
import { twitchLifecycle } from '../apps/server/src/twitch-lifecycle.ts';
import { authorize, browserHeader, liveConfig, providerFixture, tick } from './twitch-provider.ts';

it('renders an escaped, non-mutating browser recovery page for a creator with world history in the bot flow', () =>
  database(async (store) => {
    const creator = await store.ensureCreator('99', 'Accidental creator', 'live');
    await store.create(creator);
    const provider = providerFixture();
    const fetcher: typeof provider.fetcher = async (input, init) => {
      const response = await provider.fetcher(input, init);
      if (String(input).endsWith('/validate'))
        return Response.json({ ...(await response.json()), login: '<img src=x onerror=alert(1)>' });
      return response;
    };
    const app = await createApp(store, liveConfig, { fetcher, workers: false });
    provider.attach(app);
    try {
      const start = await app.inject({
        method: 'POST',
        url: '/api/operator/bot-authorization',
        headers: { ...browserHeader, authorization: `Bearer ${liveConfig.botSetupSecret}` },
        payload: {},
      });
      const state = new URL(start.json().url).searchParams.get('state');
      const response = await app.inject({
        url: `/auth/twitch/callback?code=99&state=${state}`,
        headers: {
          accept: 'text/html',
          cookie: `torchline_oauth=${start.cookies.find((cookie) => cookie.name === 'torchline_oauth')!.value}`,
        },
      });
      expect(response.statusCode).toBe(403);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toContain('&lt;img');
      expect(response.body).not.toContain('<img');
      expect(response.body).toContain('Return to TORCHLINE');
      expect((await store.creator('99'))?.connected).toBe(true);
      expect((await store.pool.query('SELECT 1 FROM oauth_grants')).rowCount).toBe(0);
    } finally {
      await app.close();
    }
  }));

it.each([false, true])(
  'preserves manual disconnect recovery and blocks bot conversion with world history (world=%s)',
  (hasWorld) =>
    database(async (store) => {
      const provider = providerFixture();
      const fetcher: typeof provider.fetcher = async (input, init) => {
        const response = await provider.fetcher(input, init);
        if (String(input).endsWith('/validate')) {
          const identity = await response.json();
          return Response.json({ ...identity, scopes: [...identity.scopes, 'channel:bot'] });
        }
        return response;
      };
      const app = await createApp(store, liveConfig, { fetcher, workers: false });
      provider.attach(app);
      try {
        const creator = await authorize(app, '99');
        expect(creator.response.statusCode).toBe(302);
        const connected = (await authorize(app, '99', true)).response;
        expect(connected.statusCode).toBe(302);
        expect(
          connected.cookies.find((cookie) => cookie.name === 'torchline_bot_setup')?.httpOnly,
        ).toBe(true);
        if (hasWorld)
          expect(
            (
              await app.inject({
                method: 'POST',
                url: '/api/worlds',
                headers: creator.headers,
                payload: {},
              })
            ).statusCode,
          ).toBe(200);
        expect(
          (
            await app.inject({
              method: 'POST',
              url: '/api/twitch/disconnect',
              headers: creator.headers,
              payload: {},
            })
          ).statusCode,
        ).toBe(200);
        const bot = await authorize(app, '99', true);
        expect(bot.response.statusCode).toBe(hasWorld ? 403 : 302);
        if (hasWorld) expect(bot.response.json()).toMatchObject({ error: 'BOT_CREATOR_HISTORY' });
        expect((await store.creator('99'))?.connected).toBe(false);
        expect(
          (await store.pool.query("SELECT 1 FROM oauth_grants WHERE role='bot'")).rowCount,
        ).toBe(hasWorld ? 0 : 1);
        expect((await store.pool.query('SELECT 1 FROM worlds')).rowCount).toBe(hasWorld ? 1 : 0);
        if (!hasWorld) expect((await authorize(app, '99')).response.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    }),
);

it('carries OAuth-authorized broadcaster, bot, signed chat and native-raid contract delivery through one persistent world', () =>
  database(async (store) => {
    const provider = providerFixture();
    const app = await createApp(store, liveConfig, { fetcher: provider.fetcher, workers: false });
    provider.attach(app);
    try {
      const source = await authorize(app, '42'),
        target = await authorize(app, '43');
      expect(source.response.statusCode).toBe(302);
      expect(target.response.statusCode).toBe(302);
      expect((await authorize(app, '99', true)).response.statusCode).toBe(302);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/operator/bot-authorization',
            headers: source.headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/receive-opt-in',
            headers: target.headers,
            payload: { enabled: true },
          })
        ).statusCode,
      ).toBe(200);
      for (const creator of [source, target])
        expect(
          (
            await app.inject({
              method: 'POST',
              url: '/api/twitch/reconcile',
              headers: creator.headers,
              payload: {},
            })
          ).statusCode,
        ).toBe(200);
      const id = (
        await app.inject({
          method: 'POST',
          url: '/api/worlds',
          headers: source.headers,
          payload: {},
        })
      ).json().id;
      const command = async (value: Command) =>
        app.inject({
          method: 'POST',
          url: `/api/worlds/${id}/commands`,
          headers: source.headers,
          payload: {
            command: value,
            expectedVersion: (await store.get(id)).revision,
            commandId: randomUUID(),
          },
        });
      expect((await command({ type: 'start' })).statusCode).toBe(200);
      const chat = provider.subscriptions.find(
        (sub) => sub.type === 'channel.chat.message' && sub.condition.broadcaster_user_id === '42',
      )!;
      for (const text of ['!scan A', '!scan C', '!route S A C T']) {
        expect(
          (
            await provider.deliver(chat, {
              broadcaster_user_id: '42',
              chatter_user_id: '77',
              message_id: randomUUID(),
              message: { text },
            })
          ).statusCode,
        ).toBe(204);
        await tick(app);
      }
      expect((await store.get(id)).state.resources.hull).toBe(85);
      expect((await command({ type: 'close-challenge' })).statusCode).toBe(200);
      expect((await command({ type: 'vote', option: '1' })).statusCode).toBe(200);
      expect(
        (
          await provider.deliver(chat, {
            broadcaster_user_id: '42',
            chatter_user_id: '42',
            message_id: randomUUID(),
            message: { text: '!vote 2' },
          })
        ).statusCode,
      ).toBe(204);
      await tick(app);
      expect(Object.values((await store.get(id)).state.votes)).toEqual(['seal-habitat']);
      expect((await command({ type: 'vote', option: '1' })).statusCode).toBe(200);
      expect(Object.values((await store.get(id)).state.votes)).toEqual(['burn-navigation']);
      expect((await command({ type: 'commit', option: 'burn-navigation' })).statusCode).toBe(200);
      const before = (await store.get(id)).state;
      const prepare = await app.inject({
        method: 'POST',
        url: '/api/handoffs',
        headers: source.headers,
        payload: { worldId: id, targetId: '43', expectedVersion: (await store.get(id)).revision },
      });
      expect(prepare.statusCode).toBe(200);
      const intent = prepare.json();
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/handoffs/${intent.id}/accept`,
            headers: source.headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/handoffs/${intent.id}/simulate-raid`,
            headers: source.headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/handoffs/${intent.id}/accept`,
            headers: target.headers,
            payload: {},
          })
        ).json().error,
      ).toBe('PROOF_REQUIRED');
      const raid = provider.subscriptions.find(
        (sub) => sub.type === 'channel.raid' && sub.condition.to_broadcaster_user_id === '43',
      )!;
      const deliveryId = randomUUID();
      const payload = { from_broadcaster_user_id: '42', to_broadcaster_user_id: '43', viewers: 17 };
      expect((await provider.deliver(raid, payload, deliveryId)).statusCode).toBe(204);
      await tick(app);
      provider.streams.splice(0, 1); // Source may stop broadcasting after its native raid.
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/handoffs/${intent.id}/accept`,
            headers: target.headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(200);
      expect((await provider.deliver(raid, payload, deliveryId)).statusCode).toBe(204);
      await tick(app);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/handoffs/${intent.id}/accept`,
            headers: target.headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(200);
      expect((await store.get(id)).state).toEqual(before);
      expect((await store.get(id)).custodian_id).toBe('43');
      expect((await store.pool.query('SELECT * FROM custody_events')).rowCount).toBe(1);
    } finally {
      await app.close();
    }
  }));

it('keeps revoked IDs terminal across challenge replay, API response races and subsequent reconciliation', () =>
  database(async (store) => {
    const provider = providerFixture();
    const app = await createApp(store, liveConfig, { fetcher: provider.fetcher, workers: false });
    provider.attach(app);
    try {
      const creator = await authorize(app, '42');
      await authorize(app, '99', true);
      provider.beforeReturn(async (sub) => {
        if (sub.type === 'channel.chat.message')
          expect(
            (
              await provider.deliver(
                { ...sub, status: 'authorization_revoked' },
                undefined,
                randomUUID(),
                'revocation',
              )
            ).statusCode,
          ).toBe(204);
      });
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/twitch/reconcile',
            headers: creator.headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(200);
      const original = provider.subscriptions.find((sub) => sub.type === 'channel.chat.message')!;
      expect(
        (await store.pool.query('SELECT status FROM subscriptions WHERE id=$1', [original.id]))
          .rows[0].status,
      ).toBe('authorization_revoked');
      expect(
        (
          await provider.deliver(
            original,
            undefined,
            'replayed-challenge',
            'webhook_callback_verification',
          )
        ).statusCode,
      ).toBe(200);
      expect(
        (await store.pool.query('SELECT status FROM subscriptions WHERE id=$1', [original.id]))
          .rows[0].status,
      ).toBe('authorization_revoked');
      expect(
        (
          await provider.deliver(original, {
            broadcaster_user_id: '42',
            chatter_user_id: '77',
            message_id: 'blocked',
            message: { text: '!scan A' },
          })
        ).statusCode,
      ).toBe(403);
      provider.beforeReturn(async () => {});
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/twitch/reconcile',
            headers: creator.headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(200);
      expect(provider.deleted).toContain(original.id);
      expect(
        provider.subscriptions.find((sub) => sub.type === 'channel.chat.message')!.id,
      ).not.toBe(original.id);
      expect(
        (await store.pool.query('SELECT status FROM subscriptions WHERE id=$1', [original.id]))
          .rows[0].status,
      ).toBe('authorization_revoked');
    } finally {
      await app.close();
    }
  }));

it('invalidates replaced-bot subscriptions, paginates provider records and requires matching callback readiness', () =>
  database(async (store) => {
    const provider = providerFixture();
    provider.setPageSize(2);
    const app = await createApp(store, liveConfig, { fetcher: provider.fetcher, workers: false });
    provider.attach(app);
    try {
      const a = await authorize(app, '42'),
        b = await authorize(app, '43');
      await authorize(app, '99', true);
      await app.inject({
        method: 'POST',
        url: '/api/receive-opt-in',
        headers: b.headers,
        payload: { enabled: true },
      });
      for (const headers of [a.headers, b.headers])
        expect(
          (await app.inject({ method: 'POST', url: '/api/twitch/reconcile', headers, payload: {} }))
            .statusCode,
        ).toBe(200);
      const lifecycle = twitchLifecycle(store, liveConfig, provider.fetcher);
      await expect(lifecycle.readyForTransfer('42', '43')).resolves.toBeUndefined();
      const oldChat = provider.subscriptions.filter((sub) => sub.type === 'channel.chat.message');
      expect((await authorize(app, '100', true)).response.statusCode).toBe(302);
      await expect(lifecycle.readyForTransfer('42', '43')).rejects.toMatchObject({
        code: 'SUBSCRIPTION_UNREADY',
      });
      for (const headers of [a.headers, b.headers])
        expect(
          (await app.inject({ method: 'POST', url: '/api/twitch/reconcile', headers, payload: {} }))
            .statusCode,
        ).toBe(200);
      expect(provider.deleted).toEqual(expect.arrayContaining(oldChat.map((sub) => sub.id)));
      expect(
        provider.subscriptions
          .filter((sub) => sub.type === 'channel.chat.message')
          .every((sub) => sub.condition.user_id === '100'),
      ).toBe(true);
      await expect(lifecycle.readyForTransfer('42', '43')).resolves.toBeUndefined();
      await expect(
        twitchLifecycle(
          store,
          { ...liveConfig, baseUrl: 'https://changed.fixture.invalid' },
          provider.fetcher,
        ).readyForTransfer('42', '43'),
      ).rejects.toMatchObject({ code: 'SUBSCRIPTION_UNREADY' });
    } finally {
      await app.close();
    }
  }));

it('rejects wrong chat conditions, forged host input and unauthenticated/admin authority escalation', () =>
  database(async (store) => {
    const provider = providerFixture();
    const app = await createApp(store, liveConfig, { fetcher: provider.fetcher, workers: false });
    provider.attach(app);
    try {
      const a = await authorize(app, '42');
      await authorize(app, '99', true);
      await app.inject({
        method: 'POST',
        url: '/api/twitch/reconcile',
        headers: a.headers,
        payload: {},
      });
      const chat = provider.subscriptions.find((sub) => sub.type === 'channel.chat.message')!;
      expect(
        (
          await provider.deliver(
            { ...chat, condition: { ...chat.condition, user_id: 'another-bot' } },
            undefined,
            randomUUID(),
            'webhook_callback_verification',
          )
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/worlds',
            headers: { ...browserHeader, authorization: `Bearer ${liveConfig.botSetupSecret}` },
            payload: {},
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/operator/bot-authorization',
            headers: a.headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(403);
      const id = (
        await app.inject({ method: 'POST', url: '/api/worlds', headers: a.headers, payload: {} })
      ).json().id;
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/worlds/${id}/commands`,
            headers: a.headers,
            payload: {
              command: { type: 'start' },
              expectedVersion: 0,
              commandId: randomUUID(),
              actor: { role: 'admin' },
            },
          })
        ).statusCode,
      ).toBe(400);
      expect((await store.get(id)).state.version).toBe(0);
    } finally {
      await app.close();
    }
  }));

it('preserves client-error status and safe responses for malformed and oversized public input', () =>
  database(async (store) => {
    const app = await createApp(store, liveConfig, { workers: false });
    try {
      for (const [payload, status] of [
        ['{', 400],
        [JSON.stringify({ value: 'x'.repeat(70000) }), 413],
      ] as const) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/worlds',
          headers: { ...browserHeader, 'content-type': 'application/json' },
          payload,
        });
        expect(res.statusCode).toBe(status);
        expect(res.body).not.toContain('DEPENDENCY_FAILURE');
        expect(res.body).not.toContain('xxxx');
      }
      expect((await store.pool.query('SELECT * FROM worlds')).rowCount).toBe(0);
    } finally {
      await app.close();
    }
  }));

it('disconnects local authority, queued input and overlay access while preserving the Ark for reconnection', () =>
  database(async (store) => {
    const provider = providerFixture();
    const app = await createApp(store, liveConfig, { fetcher: provider.fetcher, workers: false });
    provider.attach(app);
    try {
      const creator = await authorize(app, '42');
      await authorize(app, '99', true);
      await app.inject({
        method: 'POST',
        url: '/api/twitch/reconcile',
        headers: creator.headers,
        payload: {},
      });
      expect(
        (await app.inject({ url: '/api/twitch/status', headers: creator.headers })).json()
          .chatReady,
      ).toBe(true);
      expect((await app.inject('/api/twitch/status')).statusCode).toBe(401);
      const id = (
        await app.inject({
          method: 'POST',
          url: '/api/worlds',
          headers: creator.headers,
          payload: {},
        })
      ).json().id;
      await app.inject({
        method: 'POST',
        url: `/api/worlds/${id}/commands`,
        headers: creator.headers,
        payload: { command: { type: 'start' }, expectedVersion: 0, commandId: randomUUID() },
      });
      const grant = (
        await app.inject({
          method: 'POST',
          url: '/api/overlay-grant',
          headers: creator.headers,
          payload: {},
        })
      ).json();
      const token = new URL(grant.url).hash.slice(1);
      const exchange = await app.inject({
        method: 'POST',
        url: '/overlay/42/session',
        headers: browserHeader,
        payload: { token },
      });
      const cookie = `torchline_overlay=${exchange.cookies.find((item) => item.name === 'torchline_overlay')!.value}`;
      const chat = provider.subscriptions.find((sub) => sub.type === 'channel.chat.message')!;
      await provider.deliver(chat, {
        broadcaster_user_id: '42',
        chatter_user_id: '77',
        message_id: 'pending-input',
        message: { text: '!scan A' },
      });
      const before = (await store.get(id)).state;
      const disconnected = await app.inject({
        method: 'POST',
        url: '/api/twitch/disconnect',
        headers: creator.headers,
        payload: {},
      });
      expect(disconnected.json()).toEqual({ disconnected: true, providerRevoked: true });
      await tick(app);
      expect((await store.get(id)).state).toMatchObject({
        phase: 'paused',
        resumePhase: before.phase,
        resources: before.resources,
        systems: before.systems,
      });
      expect((await app.inject({ url: '/api/state', headers: creator.headers })).statusCode).toBe(
        401,
      );
      expect(
        (await app.inject({ url: '/overlay/42/events', headers: { cookie } })).statusCode,
      ).toBe(403);
      expect(
        (await store.pool.query("SELECT * FROM eventsub_inbox WHERE error='AUTH_ENDED'")).rowCount,
      ).toBe(1);
      const reconnected = await authorize(app, '42');
      expect(
        (await app.inject({ url: '/api/state', headers: reconnected.headers })).json().world
          .worldId,
      ).toBe(id);
    } finally {
      await app.close();
    }
  }));

it('remembers a signed revocation that arrives before the first challenge or provider response', () =>
  database(async (store) => {
    const provider = providerFixture();
    const app = await createApp(store, liveConfig, { fetcher: provider.fetcher, workers: false });
    provider.attach(app);
    try {
      await authorize(app, '42');
      await authorize(app, '99', true);
      const sub = {
        id: 'early-revocation',
        type: 'channel.chat.message',
        version: '1',
        status: 'authorization_revoked',
        condition: { broadcaster_user_id: '42', user_id: '99' },
        transport: {
          method: 'webhook',
          callback: `${liveConfig.baseUrl}/integrations/twitch/eventsub`,
        },
      };
      expect(
        (await provider.deliver(sub, undefined, 'revoked-first', 'revocation')).statusCode,
      ).toBe(204);
      expect(
        (
          await provider.deliver(
            { ...sub, status: 'webhook_callback_verification_pending' },
            undefined,
            'late-challenge',
            'webhook_callback_verification',
          )
        ).statusCode,
      ).toBe(200);
      expect(
        (await store.pool.query('SELECT status FROM subscriptions WHERE id=$1', [sub.id])).rows[0]
          .status,
      ).toBe('authorization_revoked');
    } finally {
      await app.close();
    }
  }));
