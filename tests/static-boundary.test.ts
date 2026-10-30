import { expect, it } from 'vitest';
import { database } from './helpers.ts';
import { createApp } from '../apps/server/src/app.ts';

it('does not turn private or repository paths into successful SPA routes', () =>
  database(async (store) => {
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
    try {
      for (const path of [
        '/.env',
        '/.env.live',
        '/.git/config',
        '/docs/internal/IDEA.txt',
        '/packages/storage/src/index.ts',
        '/README.md',
      ])
        expect((await app.inject(path)).statusCode, path).toBe(404);
      expect((await app.inject('/bridge')).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  }));
