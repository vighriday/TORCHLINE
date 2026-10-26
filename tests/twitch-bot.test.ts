import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { database } from './helpers.ts';
import { createApp } from '../apps/server/src/app.ts';
import { twitchBot } from '../apps/server/src/twitch-bot.ts';
import { authorize, browserHeader, liveConfig, providerFixture, tick } from './twitch-provider.ts';
const send = (app: Awaited<ReturnType<typeof createApp>>) =>
  (app as unknown as { botTick: () => Promise<void> }).botTick();

it('coalesces channel queries, deduplicates messages and sends only through the authorized bot in the source channel', () =>
  database(async (store) => {
    const provider = providerFixture();
    const app = await createApp(store, liveConfig, { workers: false, fetcher: provider.fetcher });
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
      const sub = provider.subscriptions.find((sub) => sub.type === 'channel.chat.message')!;
      const event = {
        broadcaster_user_id: '42',
        chatter_user_id: '77',
        message_id: 'same-message',
        message: { text: '!status' },
      };
      expect((await provider.deliver(sub, event, 'first')).statusCode).toBe(204);
      await provider.deliver(sub, event, 'retry-different-id');
      await provider.deliver(
        sub,
        { ...event, message_id: 'coalesced', message: { text: '!history' } },
        'another',
      );
      await provider.deliver(
        sub,
        { ...event, message_id: 'bot-self', chatter_user_id: '99' },
        'self',
      );
      await provider.deliver(
        sub,
        { ...event, message_id: 'mirror', source_broadcaster_user_id: 'other' },
        'mirror',
      );
      await send(app);
      await send(app);
      expect(provider.messages).toHaveLength(1);
      expect(provider.messages[0]).toMatchObject({
        broadcaster_id: '42',
        sender_id: '99',
        for_source_only: true,
      });
      expect(provider.messages[0].message).toContain('No active Ark');
      expect(provider.messages[0].message.length).toBeLessThanOrEqual(500);
      expect((await store.pool.query('SELECT * FROM worlds')).rowCount).toBe(0);
      expect(
        (await store.pool.query('SELECT status FROM bot_replies')).rows.map((row) => row.status),
      ).toEqual(['sent']);
      const status = await app.inject({ url: '/api/twitch/status', headers: creator.headers });
      expect(status.json().botReplies).toEqual({ pending: 0, sent: 1, failed: 0, uncertain: 0 });
      expect(
        (await app.inject({ url: '/api/twitch/status', headers: browserHeader })).statusCode,
      ).toBe(401);
    } finally {
      await app.close();
    }
  }));

it('processes gameplay while a slow bot request is in flight and records an uncertain send without automatic duplicate retry', () =>
  database(async (store) => {
    const provider = providerFixture();
    const app = await createApp(store, liveConfig, { workers: false, fetcher: provider.fetcher });
    provider.attach(app);
    let unblock: () => void = () => {};
    try {
      const creator = await authorize(app, '42');
      await authorize(app, '99', true);
      await app.inject({
        method: 'POST',
        url: '/api/twitch/reconcile',
        headers: creator.headers,
        payload: {},
      });
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
      const sub = provider.subscriptions.find((sub) => sub.type === 'channel.chat.message')!;
      let started: () => void = () => {};
      const began = new Promise<void>((resolve) => {
        started = resolve;
      });
      const blocked = new Promise<void>((resolve) => {
        unblock = resolve;
      });
      provider.setChatResponse(async () => {
        started();
        await blocked;
        throw new TypeError('fixture ambiguous connection close');
      });
      await provider.deliver(sub, {
        broadcaster_user_id: '42',
        chatter_user_id: '77',
        message_id: 'query',
        message: { text: '!status' },
      });
      const sending = send(app);
      await began;
      await provider.deliver(sub, {
        broadcaster_user_id: '42',
        chatter_user_id: '78',
        message_id: 'action',
        message: { text: '!scan A' },
      });
      await tick(app);
      expect((await store.get(id)).state.challenge.scanned).toEqual(['A']);
      unblock();
      await sending;
      await send(app);
      expect(provider.messages).toHaveLength(1);
      expect((await store.pool.query('SELECT status FROM bot_replies')).rows[0].status).toBe(
        'uncertain',
      );
    } finally {
      unblock();
      await app.close();
    }
  }));

it('enforces global bot pacing across channels and marks provider-dropped messages as failed', () =>
  database(async (store) => {
    const provider = providerFixture();
    const app = await createApp(store, liveConfig, { workers: false, fetcher: provider.fetcher });
    provider.attach(app);
    try {
      const a = await authorize(app, '42'),
        b = await authorize(app, '43');
      await authorize(app, '99', true);
      for (const headers of [a.headers, b.headers])
        await app.inject({ method: 'POST', url: '/api/twitch/reconcile', headers, payload: {} });
      for (const channel of ['42', '43']) {
        const sub = provider.subscriptions.find(
          (sub) =>
            sub.type === 'channel.chat.message' && sub.condition.broadcaster_user_id === channel,
        )!;
        await provider.deliver(sub, {
          broadcaster_user_id: channel,
          chatter_user_id: '77',
          message_id: randomUUID(),
          message: { text: '!status' },
        });
      }
      await send(app);
      await send(app);
      expect(provider.messages).toHaveLength(1);
      await store.pool.query("UPDATE bot_send_limits SET next_send_at=now()-interval '1 second'");
      provider.setChatResponse(async () =>
        Response.json({
          data: [
            {
              message_id: '',
              is_sent: false,
              drop_reason: { code: 'automod_held', message: 'fixture' },
            },
          ],
        }),
      );
      await send(app);
      expect(provider.messages).toHaveLength(2);
      expect(
        (await store.pool.query("SELECT outcome_code FROM bot_replies WHERE status='failed'"))
          .rows[0].outcome_code,
      ).toBe('automod_held');
    } finally {
      await app.close();
    }
  }));

it('does not send queued replies after consent ends and quarantines interrupted sends on restart', () =>
  database(async (store) => {
    const provider = providerFixture();
    const app = await createApp(store, liveConfig, { workers: false, fetcher: provider.fetcher });
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
      const sub = provider.subscriptions.find((sub) => sub.type === 'channel.chat.message')!;
      await provider.deliver(sub, {
        broadcaster_user_id: '42',
        chatter_user_id: '77',
        message_id: 'pending-query',
        message: { text: '!status' },
      });
      await store.pool.query("DELETE FROM oauth_grants WHERE id='42' AND role='creator'");
      await send(app);
      expect(provider.messages).toHaveLength(0);
      expect((await store.pool.query('SELECT status FROM bot_replies')).rows[0].status).toBe(
        'failed',
      );
      await store.pool.query(
        "INSERT INTO bot_replies(id,channel_id,body,status) VALUES('interrupted','42','fixture','sending')",
      );
      await twitchBot(store, liveConfig, provider.fetcher, async () => 'fixture').recover();
      expect(
        (await store.pool.query("SELECT status FROM bot_replies WHERE id='interrupted'")).rows[0]
          .status,
      ).toBe('uncertain');
    } finally {
      await app.close();
    }
  }));
