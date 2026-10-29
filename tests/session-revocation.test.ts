import { expect, it } from 'vitest';
import { createApp } from '../apps/server/src/app.ts';
import { database } from './helpers.ts';
import { authorize, browserHeader, liveConfig, providerFixture } from './twitch-provider.ts';

it('permits self-revocation with stale provider validation while all gameplay still requires fresh consent', () =>
  database(async (store) => {
    const provider = providerFixture();
    const app = await createApp(store, liveConfig, {
      workers: false,
      fetcher: async (url, init) =>
        String(url).includes('/oauth2/revoke')
          ? new Response(null, { status: 503 })
          : provider.fetcher(url, init),
    });
    provider.attach(app);
    try {
      const owner = await authorize(app, '42');
      const other = await authorize(app, '43');
      const world = await store.create((await store.creator('42'))!);
      const before = await store.get(world);
      await store.pool.query(
        "UPDATE oauth_grants SET validated_at=now()-interval '2 hours' WHERE id='42'",
      );
      expect((await app.inject({ url: '/api/state', headers: owner.headers })).statusCode).toBe(
        401,
      );
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/worlds',
            headers: owner.headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/twitch/disconnect',
            headers: browserHeader,
            payload: {},
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/twitch/disconnect',
            headers: { ...owner.headers, origin: 'https://evil.invalid' },
            payload: {},
          })
        ).statusCode,
      ).toBe(403);
      expect((await store.creator('42'))?.connected).toBe(true);
      const revoked = await app.inject({
        method: 'POST',
        url: '/api/twitch/disconnect',
        headers: owner.headers,
        payload: {},
      });
      expect(revoked.statusCode).toBe(200);
      expect(revoked.json()).toEqual({ disconnected: true, providerRevoked: false });
      expect((await store.creator('42'))?.connected).toBe(false);
      expect((await store.pool.query("SELECT 1 FROM oauth_grants WHERE id='42'")).rowCount).toBe(0);
      expect(
        (await store.pool.query("SELECT 1 FROM sessions WHERE channel_id='42'")).rowCount,
      ).toBe(0);
      expect((await store.get(world)).state).toEqual(before.state);
      expect((await store.creator('43'))?.connected).toBe(true);
      expect((await app.inject({ url: '/api/state', headers: other.headers })).statusCode).toBe(
        200,
      );
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/twitch/disconnect',
            headers: owner.headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(401);
    } finally {
      await app.close();
    }
  }));
