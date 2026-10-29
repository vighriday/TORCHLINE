import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { advanceEpisodes } from '@torchline/storage';
import { replayEvents } from '@torchline/engine';
import { createApp } from '../apps/server/src/app.ts';
import { database } from './helpers.ts';
import { authorize, liveConfig, providerFixture, tick } from './twitch-provider.ts';

it('freezes chat-loss time, drains accepted input, pauses once across restart and resumes only deliberately', () =>
  database(async (store) => {
    const provider = providerFixture();
    let app = await createApp(store, liveConfig, { fetcher: provider.fetcher, workers: false });
    provider.attach(app);
    try {
      await authorize(app, '99', true);
      const { headers } = await authorize(app, '42');
      await app.inject({ method: 'POST', url: '/api/twitch/reconcile', payload: {}, headers });
      const id = await store.create((await store.creator('42'))!);
      const command = async (value: { type: 'start' | 'resume' | 'close-challenge' }) =>
        app.inject({
          method: 'POST',
          url: `/api/worlds/${id}/commands`,
          headers,
          payload: {
            command: value,
            expectedVersion: (await store.get(id)).revision,
            commandId: randomUUID(),
          },
        });
      expect((await command({ type: 'start' })).statusCode).toBe(200);
      await store.pool.query(
        "UPDATE episode_clocks SET deadline_at=clock_timestamp()+interval '65 seconds' WHERE world_id=$1",
        [id],
      );
      const chat = provider.subscriptions.find((s) => s.type === 'channel.chat.message')!;
      expect(
        (
          await provider.deliver(chat, {
            broadcaster_user_id: '42',
            chatter_user_id: '77',
            message_id: 'before-loss',
            message: { text: '!scan A' },
          })
        ).statusCode,
      ).toBe(204);
      chat.status = 'authorization_revoked';
      expect((await provider.deliver(chat, undefined, randomUUID(), 'revocation')).statusCode).toBe(
        204,
      );
      const frozen = await store.get(id);
      expect(frozen.input_suspended).toBe(true);
      expect(
        (await app.inject({ url: '/api/state', headers })).json().world.capabilities
          .canCloseChallenge,
      ).toBe(false);
      expect(frozen.clock?.deadline_at).toBeNull();
      expect(frozen.clock?.remaining_ms).toBeGreaterThan(63000);
      await store.enqueueChat(
        'after-loss',
        '42',
        '88',
        { type: 'scan', node: 'B' },
        new Date().toISOString(),
        'fixture',
        'after-loss',
      );
      expect(
        (
          await store.pool.query(
            "SELECT payload->>'kind' AS kind FROM eventsub_inbox WHERE message_id='after-loss'",
          )
        ).rows[0].kind,
      ).toBe('ignored');
      expect((await command({ type: 'close-challenge' })).statusCode).toBe(409);
      // Waiting for admitted work is not a dependency failure and cannot exhaust the pause job.
      await store.pool.query(
        "UPDATE eventsub_inbox SET attempts=7 WHERE payload->>'kind'='interruption'",
      );
      await store.pool.query(
        "UPDATE eventsub_inbox SET next_attempt_at=now()+interval '1 minute' WHERE payload->>'kind'='chat'",
      );
      await tick(app);
      const waiting = (
        await store.pool.query(
          "SELECT attempts,processed_at FROM eventsub_inbox WHERE payload->>'kind'='interruption'",
        )
      ).rows[0];
      expect(waiting.attempts).toBe(7);
      expect(waiting.processed_at).toBeNull();
      await store.pool.query(
        'UPDATE eventsub_inbox SET next_attempt_at=now() WHERE processed_at IS NULL',
      );
      await advanceEpisodes(store, 'live');
      expect((await store.get(id)).state.phase).toBe('challenge');
      await app.close();
      app = await createApp(store, liveConfig, { fetcher: provider.fetcher, workers: false });
      provider.attach(app);
      await tick(app);
      let paused = await store.get(id);
      expect(paused.state.phase).toBe('paused');
      expect(paused.input_suspended).toBe(false);
      expect(paused.state.challenge.scanned).toEqual(['A']);
      expect(paused.clock?.remaining_ms).toBe(frozen.clock?.remaining_ms);
      expect(paused.clock?.recovery_reason).toContain('Twitch chat');
      expect(replayEvents(id, paused.events, paused.state.rulesVersion)).toEqual(paused.state);
      expect((await command({ type: 'resume' })).json().error).toBe('SUBSCRIPTION_UNREADY');
      await tick(app);
      expect((await store.get(id)).revision).toBe(paused.revision);
      await app.inject({ method: 'POST', url: '/api/twitch/reconcile', payload: {}, headers });
      await tick(app);
      expect((await store.get(id)).state.phase).toBe('paused');
      expect((await command({ type: 'resume' })).statusCode).toBe(200);
      paused = await store.get(id);
      expect(paused.state.phase).toBe('challenge');
      expect(paused.clock?.deadline_at?.getTime()).toBeGreaterThan(Date.now() + 62000);
      expect(paused.events.filter((e) => e.actor.id === 'episode-interruption')).toHaveLength(1);
    } finally {
      await app.close();
    }
  }));

it.each(['subscription', 'bot', 'creator'] as const)(
  'supervises known %s loss without relying on another webhook or connected authority',
  (kind) =>
    database(async (store) => {
      const provider = providerFixture();
      const app = await createApp(store, liveConfig, { fetcher: provider.fetcher, workers: false });
      provider.attach(app);
      try {
        await authorize(app, '99', true);
        const { headers } = await authorize(app, '42');
        await app.inject({ method: 'POST', url: '/api/twitch/reconcile', payload: {}, headers });
        const id = await store.create((await store.creator('42'))!);
        await store.command(
          id,
          { id: '42', role: 'host', community: '42' },
          'live',
          (await store.get(id)).revision,
          randomUUID(),
          { type: 'start' },
        );
        const before = (await store.get(id)).state;
        if (kind === 'subscription')
          await store.pool.query(
            "UPDATE subscriptions SET status='notification_failures_exceeded' WHERE type='channel.chat.message'",
          );
        if (kind === 'bot') await store.pool.query("DELETE FROM oauth_grants WHERE role='bot'");
        if (kind === 'creator') {
          await store.pool.query("DELETE FROM oauth_grants WHERE role='creator'");
          await store.pool.query("UPDATE creators SET connected=false WHERE id='42'");
        }
        await tick(app);
        const after = await store.get(id);
        expect(after.state.phase).toBe('paused');
        expect(after.state.resources).toEqual(before.resources);
        expect(after.state.systems).toEqual(before.systems);
        expect(
          (
            await store.pool.query(
              "SELECT count(*)::integer AS n FROM integration_deliveries WHERE kind='raid'",
            )
          ).rows[0].n,
        ).toBe(0);
      } finally {
        await app.close();
      }
    }),
);
