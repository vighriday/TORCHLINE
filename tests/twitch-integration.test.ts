import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Command } from '@torchline/contracts';
import { database } from './helpers.ts';
import { createApp } from '../apps/server/src/app.ts';
import { twitchLifecycle } from '../apps/server/src/twitch-lifecycle.ts';
import { authorize, browserHeader, liveConfig, providerFixture, tick } from './twitch-provider.ts';

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
