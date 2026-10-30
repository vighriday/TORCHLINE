import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { LivewireRequest } from '@torchline/contracts';
import { replayEvents } from '@torchline/engine';
import { createApp } from '../apps/server/src/app.ts';
import { database } from './helpers.ts';
import { authorize, liveConfig, providerFixture, tick } from './twitch-provider.ts';

it('keeps the feature off by default and rejects markup or client-supplied effects without spending an allowance', () =>
  database(async (store) => {
    const config = {
      mode: 'simulation' as const,
      baseUrl: 'http://localhost:3000',
      sessionSecret: 'ab'.repeat(32),
      tokenKey: 'cd'.repeat(32),
      botSetupSecret: 'fixture',
    };
    let app = await createApp(store, config, { workers: false });
    const header = { 'x-torchline-request': '1', origin: config.baseUrl };
    try {
      const login = await app.inject({
        method: 'POST',
        url: '/api/simulator/login',
        headers: header,
        payload: { channel: 'alpha' },
      });
      const headers = {
        ...header,
        cookie: `torchline_sim_session=${login.cookies.find((c) => c.name === 'torchline_sim_session')!.value}`,
      };
      const id = (
        await app.inject({ method: 'POST', url: '/api/worlds', headers, payload: {} })
      ).json().id;
      const post = (action: unknown) =>
        app.inject({
          method: 'POST',
          url: `/api/worlds/${id}/livewire`,
          headers,
          payload: { expectedVersion: 0, commandId: randomUUID(), action },
        });
      expect(
        (await post({ type: 'open', preset: 'boss', game: 'Game', label: 'Attempt' })).json().error,
      ).toBe('FEATURE_DISABLED');
      await app.close();
      app = await createApp(store, { ...config, livewireEnabled: true }, { workers: false });
      expect(
        (await post({ type: 'open', preset: 'boss', game: '<script>', label: 'Attempt' }))
          .statusCode,
      ).toBe(400);
      expect(
        (await post({ type: 'open', preset: 'boss', game: 'Game', label: 'Attempt', success: 100 }))
          .statusCode,
      ).toBe(400);
      expect((await store.get(id)).state.livewire).toBeUndefined();
      expect((await store.get(id)).revision).toBe(0);
    } finally {
      await app.close();
    }
  }));

it('applies signed provider fixtures to real SQL ballots, one attested effect, history and the scoped overlay without any bot send', () =>
  database(async (store) => {
    const config = { ...liveConfig, livewireEnabled: true, botRepliesEnabled: false };
    const provider = providerFixture(config);
    const app = await createApp(store, config, { fetcher: provider.fetcher, workers: false });
    provider.attach(app);
    try {
      const owner = await authorize(app, '42'),
        other = await authorize(app, '43');
      await authorize(app, '99', true);
      const post = (url: string, payload: unknown, headers = owner.headers) =>
        app.inject({ method: 'POST', url, payload: payload as Record<string, unknown>, headers });
      await post('/api/twitch/reconcile', {});
      const id = (await post('/api/worlds', {})).json().id;
      const action = async (action: LivewireRequest['action']) =>
        post(`/api/worlds/${id}/livewire`, {
          action,
          expectedVersion: (await store.get(id)).revision,
          commandId: randomUUID(),
        });
      const opened = await action({
        type: 'open',
        preset: 'match',
        game: 'Rocket League',
        label: 'Win this match',
      });
      expect(opened.statusCode).toBe(200);
      const stakeId = (await store.get(id)).state.livewire!.stake.id;
      expect(opened.json().world.livewire.stake.author).toBeUndefined();
      expect(opened.json().world.livewire.stake.channel).toBeUndefined();
      const chat = provider.subscriptions.find((s) => s.type === 'channel.chat.message')!;
      const messageId = randomUUID(),
        deliveryId = randomUUID();
      const message = (text: string, chatter = '77') => ({
        broadcaster_user_id: '42',
        chatter_user_id: chatter,
        message_id: messageId,
        message: { text },
      });
      expect((await provider.deliver(chat, message('!stake hull'), deliveryId)).statusCode).toBe(
        204,
      );
      expect((await provider.deliver(chat, message('!stake 3'), deliveryId)).statusCode).toBe(204);
      expect((await provider.deliver(chat, message('!vote 3'))).statusCode).toBe(204);
      expect(
        (await provider.deliver(chat, { ...message('!stake 3', '99'), message_id: randomUUID() }))
          .statusCode,
      ).toBe(204);
      expect(
        (
          await provider.deliver(chat, {
            ...message('!stake 3'),
            message_id: randomUUID(),
            source_broadcaster_user_id: 'elsewhere',
          })
        ).statusCode,
      ).toBe(204);
      const state = (await app.inject({ url: '/api/state', headers: owner.headers })).json();
      expect(state.world.livewire.tallies).toEqual([0, 1, 0]);
      expect(state.world.livewire.participants).toBe(1);
      const before = (await store.get(id)).state.resources.hull;
      expect((await action({ type: 'lock', stakeId })).statusCode).toBe(200);
      expect((await action({ type: 'resolve', stakeId, outcome: 'failure' })).statusCode).toBe(200);
      const after = await store.get(id);
      expect(after.state.resources.hull).toBe(before - 6);
      expect(replayEvents(id, after.events)).toEqual(after.state);
      expect(
        (await app.inject({ url: `/api/worlds/${id}/history`, headers: owner.headers }))
          .json()
          .events.some((e: { summary: string }) => e.summary.includes('Streamer-attested failure')),
      ).toBe(true);
      const url = (await post('/api/overlay-grant', {})).json().url;
      const token = new URL(url).hash.slice(1);
      const session = await post('/overlay/42/session', { token });
      expect(session.statusCode).toBe(200);
      const overlayCookie = `torchline_overlay=${session.cookies.find((c) => c.name === 'torchline_overlay')!.value}`;
      const overlay = (
        await app.inject({ url: '/overlay/42/state', headers: { cookie: overlayCookie } })
      ).json();
      expect(overlay.world.resources.hull).toBe(before - 6);
      expect(overlay.world.livewire.canControl).toBe(false);
      expect(overlay.world.capabilities.canStart).toBe(false);
      const request = {
        expectedVersion: after.revision,
        commandId: randomUUID(),
        action: { type: 'cancel', stakeId },
      };
      expect((await post(`/api/worlds/${id}/livewire`, request, other.headers)).statusCode).toBe(
        403,
      );
      expect(
        (
          await post(`/api/worlds/${id}/livewire`, request, {
            'x-torchline-request': '1',
            origin: config.baseUrl,
            cookie: overlayCookie,
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await post(`/api/worlds/${id}/livewire`, request, {
            'x-torchline-request': '1',
            origin: 'https://evil.invalid',
            cookie: owner.headers.cookie,
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await post(`/api/worlds/${id}/commands`, {
            command: {
              type: 'livewire-lock',
              stakeId,
              tallies: [999, 0, 0],
              evidence: 'twitch_signed',
            },
            expectedVersion: after.revision,
            commandId: randomUUID(),
          })
        ).statusCode,
      ).toBe(400);
      await tick(app);
      expect(provider.messages).toEqual([]);
      expect(
        (
          await store.pool.query(
            "SELECT count(*)::integer AS n FROM eventsub_inbox WHERE payload->>'kind'='livewire_ballot' AND payload->>'evidence'='twitch_signed' AND payload->>'accepted'='true'",
          )
        ).rows[0].n,
      ).toBe(1);
    } finally {
      await app.close();
    }
  }));

it('pauses a live selection on revoked chat authority and keeps cancellation available', () =>
  database(async (store) => {
    const config = { ...liveConfig, livewireEnabled: true, botRepliesEnabled: false };
    const provider = providerFixture(config);
    const app = await createApp(store, config, { fetcher: provider.fetcher, workers: false });
    provider.attach(app);
    try {
      const owner = await authorize(app, '42');
      await authorize(app, '99', true);
      const post = (url: string, payload: unknown) =>
        app.inject({
          method: 'POST',
          url,
          headers: owner.headers,
          payload: payload as Record<string, unknown>,
        });
      await post('/api/twitch/reconcile', {});
      const id = (await post('/api/worlds', {})).json().id;
      await post(`/api/worlds/${id}/livewire`, {
        expectedVersion: 0,
        commandId: randomUUID(),
        action: { type: 'open', preset: 'boss', game: 'Game', label: 'Boss' },
      });
      const chat = provider.subscriptions.find((s) => s.type === 'channel.chat.message')!;
      await provider.deliver(
        { ...chat, status: 'authorization_revoked' },
        undefined,
        randomUUID(),
        'revocation',
      );
      await tick(app);
      const paused = await store.get(id);
      expect(paused.state.livewire!.stake.status).toBe('paused');
      const stakeId = paused.state.livewire!.stake.id;
      expect(
        (
          await post(`/api/worlds/${id}/livewire`, {
            expectedVersion: paused.revision,
            commandId: randomUUID(),
            action: { type: 'resume', stakeId },
          })
        ).json().error,
      ).toBe('SUBSCRIPTION_UNREADY');
      expect(
        (
          await post(`/api/worlds/${id}/livewire`, {
            expectedVersion: paused.revision,
            commandId: randomUUID(),
            action: { type: 'cancel', stakeId },
          })
        ).statusCode,
      ).toBe(200);
      const after = await store.get(id);
      expect(replayEvents(id, after.events)).toEqual(after.state);
    } finally {
      await app.close();
    }
  }));
