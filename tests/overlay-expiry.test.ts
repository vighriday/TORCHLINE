import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { database } from './helpers.ts';
import { createApp } from '../apps/server/src/app.ts';

it('expires temporary overlay grants without granting creator authority or revoking ordinary OBS links', () =>
  database(async (store) => {
    await store.ensureCreator('owner', 'Owner', 'simulation');
    const token = 'ab'.repeat(32),
      other = 'cd'.repeat(32),
      digest = (t: string) => createHash('sha256').update(t).digest('hex');
    await store.pool.query(
      "INSERT INTO overlay_grants(hash,channel_id,expires_at) VALUES($1,'owner',clock_timestamp()+interval '5 minutes'),($2,'owner',NULL)",
      [digest(token), digest(other)],
    );
    const app = await createApp(
      store,
      {
        mode: 'simulation',
        baseUrl: 'http://localhost:3000',
        sessionSecret: 'ab'.repeat(32),
        tokenKey: 'cd'.repeat(32),
        botSetupSecret: 'fixture',
      },
      { workers: false },
    );
    const headers = { origin: 'http://localhost:3000', 'x-torchline-request': '1' };
    try {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/overlay/owner/session',
            headers,
            payload: { token },
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/worlds',
            headers: { ...headers, cookie: `torchline_overlay=${token}` },
            payload: {},
          })
        ).statusCode,
      ).toBe(401);
      await store.pool.query(
        "UPDATE overlay_grants SET expires_at=clock_timestamp()-interval '1 second' WHERE hash=$1",
        [digest(token)],
      );
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/overlay/owner/session',
            headers,
            payload: { token },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            url: '/overlay/owner/events',
            headers: { cookie: `torchline_overlay=${token}` },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/overlay/owner/session',
            headers,
            payload: { token: other },
          })
        ).statusCode,
      ).toBe(200);
    } finally {
      await app.close();
    }
  }));
