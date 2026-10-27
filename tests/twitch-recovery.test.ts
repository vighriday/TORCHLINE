import { expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Command } from '@torchline/contracts';
import { database } from './helpers.ts';
import { createApp } from '../apps/server/src/app.ts';
import { authorize, liveConfig, providerFixture, tick } from './twitch-provider.ts';

it('applies signed cooperation inputs, pauses on genuine-shaped offline delivery and guards recovery authority', () =>
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
      const id = (
        await app.inject({
          method: 'POST',
          url: '/api/worlds',
          headers: creator.headers,
          payload: {},
        })
      ).json().id;
      const command = async (value: Command) => {
        const response = await app.inject({
          method: 'POST',
          url: `/api/worlds/${id}/commands`,
          headers: creator.headers,
          payload: {
            command: value,
            expectedVersion: (await store.get(id)).revision,
            commandId: randomUUID(),
          },
        });
        expect(response.statusCode).toBe(200);
      };
      const chat = provider.subscriptions.find((s) => s.type === 'channel.chat.message')!;
      const send = async (text: string) => {
        const timestamp = (
          await store.pool.query('SELECT clock_timestamp() AS at')
        ).rows[0].at.toISOString();
        const response = await provider.deliver(
          chat,
          {
            broadcaster_user_id: '42',
            chatter_user_id: '77',
            message_id: randomUUID(),
            message: { text },
          },
          randomUUID(),
          'notification',
          timestamp,
        );
        expect(response.statusCode).toBe(204);
      };
      await command({ type: 'configure-cooperation', budget: 5, investigation: true });
      await command({ type: 'start' });
      await send('!inspect engine');
      await tick(app);
      await command({ type: 'close-investigation' });
      expect((await store.get(id)).state.challenge.scanned).toEqual(['C']);
      await command({ type: 'close-challenge' });
      await send('!allocate 3 2');
      await tick(app);
      expect((await store.get(id)).state.cooperation!.plan).toEqual({ hull: 3, oxygen: 2 });
      await command({ type: 'close-allocation' });
      await send('!vote 1');
      const offline = provider.subscriptions.find((s) => s.type === 'stream.offline')!;
      const offlineId = randomUUID();
      const timestamp = (
        await store.pool.query('SELECT clock_timestamp() AS at')
      ).rows[0].at.toISOString();
      expect(
        (
          await provider.deliver(
            offline,
            { broadcaster_user_id: '42' },
            offlineId,
            'notification',
            timestamp,
          )
        ).statusCode,
      ).toBe(204);
      await tick(app);
      const paused = await store.get(id);
      expect(paused.state.phase).toBe('paused');
      expect(Object.keys(paused.state.votes)).toHaveLength(1);
      expect(paused.clock?.remaining_ms).toBeGreaterThan(0);
      await provider.deliver(
        offline,
        { broadcaster_user_id: '42' },
        offlineId,
        'notification',
        timestamp,
      );
      await tick(app);
      expect((await store.get(id)).state.version).toBe(paused.state.version);
      await command({ type: 'resume' });
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/twitch/retry-inputs',
            headers: { 'x-torchline-request': '1' },
            payload: {},
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/twitch/retry-inputs',
            headers: { ...creator.headers, origin: 'https://evil.invalid' },
            payload: {},
          })
        ).statusCode,
      ).toBe(403);
      const publicState = (await app.inject({ url: '/api/state', headers: creator.headers })).body;
      expect(publicState).not.toContain(Object.keys(paused.state.votes)[0]);
    } finally {
      await app.close();
    }
  }));

it('backs off transient failures, quarantines exhausted input, and retries only current-window creator-owned chat', () =>
  database(async (store) => {
    const provider = providerFixture();
    const app = await createApp(store, liveConfig, { fetcher: provider.fetcher, workers: false });
    provider.attach(app);
    try {
      const creator = await authorize(app, '42');
      const owner = (await store.creator('42'))!;
      const id = await store.create(owner);
      await store.command(
        id,
        { id: owner.id, role: 'host', community: owner.id },
        'live',
        0,
        randomUUID(),
        { type: 'start' },
      );
      const timestamp = (
        await store.pool.query('SELECT clock_timestamp() AS at')
      ).rows[0].at.toISOString();
      await store.enqueueChat(
        'retry-fixture',
        owner.id,
        'viewer',
        { type: 'scan', node: 'A' },
        timestamp,
      );
      const fault = vi
        .spyOn(store, 'command')
        .mockRejectedValueOnce(new Error('temporary fixture dependency'));
      await tick(app);
      let item = (
        await store.pool.query("SELECT * FROM eventsub_inbox WHERE message_id='retry-fixture'")
      ).rows[0];
      expect(item.attempts).toBe(1);
      expect(item.processed_at).toBeNull();
      expect(item.next_attempt_at.getTime()).toBeGreaterThan(item.received_at.getTime());
      await tick(app);
      expect(fault).toHaveBeenCalledTimes(1);
      await store.pool.query(
        "UPDATE eventsub_inbox SET attempts=7,next_attempt_at=now() WHERE message_id='retry-fixture'",
      );
      fault.mockRejectedValueOnce(new Error('persistent fixture failure'));
      await tick(app);
      fault.mockRestore();
      item = (
        await store.pool.query("SELECT * FROM eventsub_inbox WHERE message_id='retry-fixture'")
      ).rows[0];
      expect(item.error).toBe('RETRY_EXHAUSTED');
      expect(item.processed_at).not.toBeNull();
      const other = await authorize(app, '43');
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/twitch/retry-inputs',
            headers: other.headers,
            payload: {},
          })
        ).json().retried,
      ).toBe(0);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/twitch/retry-inputs',
            headers: creator.headers,
            payload: {},
          })
        ).json().retried,
      ).toBe(1);
      await tick(app);
      expect((await store.get(id)).state.challenge.scanned).toEqual(['A']);
      item = (
        await store.pool.query("SELECT * FROM eventsub_inbox WHERE message_id='retry-fixture'")
      ).rows[0];
      expect(item.error).toBeNull();
      expect(item.processed_at).not.toBeNull();
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/twitch/retry-inputs',
            headers: creator.headers,
            payload: {},
          })
        ).json().retried,
      ).toBe(0);
    } finally {
      vi.restoreAllMocks();
      await app.close();
    }
  }));
