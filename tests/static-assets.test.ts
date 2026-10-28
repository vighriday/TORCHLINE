import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { database } from './helpers.ts';
import { createApp } from '../apps/server/src/app.ts';

it('serves newly built assets without restarting and keeps missing assets/API mutations outside SPA fallback', () =>
  database(async (store) => {
    await mkdir('apps/web/dist/assets', { recursive: true });
    const name = `release-probe-${randomUUID()}.js`,
      path = `apps/web/dist/assets/${name}`;
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
      await app.ready();
      await writeFile(path, 'export const releaseProbe = true;');
      const response = await app.inject(`/assets/${name}`);
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('javascript');
      expect(response.body).toBe('export const releaseProbe = true;');
      expect((await app.inject('/assets/missing-release-probe.js')).statusCode).toBe(404);
      expect((await app.inject('/api/private-missing-route')).statusCode).toBe(404);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/worlds',
            headers: { 'x-torchline-request': '1' },
            payload: {},
          })
        ).statusCode,
      ).toBe(401);
    } finally {
      await app.close();
      await unlink(path).catch(() => {});
    }
  }));
