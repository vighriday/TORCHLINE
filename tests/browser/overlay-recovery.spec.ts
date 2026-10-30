import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { database } from '../helpers.ts';
import { createApp } from '../../apps/server/src/app.ts';
import { tick } from '../twitch-provider.ts';

test('overlay survives initial and mid-feed dependency failures, reads the saved state, and stops on genuine revocation', async ({
  page,
}) =>
  database(async (store) => {
    const baseUrl = 'http://localhost:3100';
    const app = await createApp(
      store,
      {
        mode: 'simulation',
        baseUrl,
        sessionSecret: 'ab'.repeat(32),
        tokenKey: 'cd'.repeat(32),
        botSetupSecret: 'fixture',
      },
      { workers: false },
    );
    const paths: string[] = [];
    let reads = 0,
      initialFailures = 2,
      feeds = 0;
    const original = store.active.bind(store);
    try {
      await app.listen({ port: 3100, host: '127.0.0.1' });
      const login = await app.inject({
        method: 'POST',
        url: '/api/simulator/login',
        payload: { channel: 'alpha' },
        headers: { 'x-torchline-request': '1' },
      });
      const creator = (await store.creator('sim-alpha'))!;
      const id = await store.create(creator);
      const grant = await app.inject({
        method: 'POST',
        url: '/api/overlay-grant',
        payload: {},
        headers: {
          'x-torchline-request': '1',
          cookie: `torchline_sim_session=${login.cookies.find((c) => c.name === 'torchline_sim_session')!.value}`,
        },
      });
      expect((await app.inject('/overlay/sim-alpha/state')).statusCode).toBe(403);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (request.method() === 'POST') paths.push(url.pathname);
        if (url.pathname.endsWith('/events')) feeds++;
      });
      await page.route('**/overlay/sim-alpha/state', async (route) => {
        reads++;
        if (initialFailures-- > 0)
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Fixture dependency unavailable' }),
          });
        await route.continue();
      });
      await page.goto(grant.json().url);
      await expect(page.locator('.mission')).toBeVisible();
      await expect.poll(() => reads).toBeGreaterThanOrEqual(3);
      await expect.poll(() => feeds).toBeGreaterThan(0);
      const before = (await store.get(id)).state;
      store.active = async () => {
        throw new Error('Fixture transient SQL failure');
      };
      await tick(app);
      await expect(page.locator('body')).toContainText('Overlay reconnecting');
      await expect(page.locator('.mission')).toBeVisible();
      store.active = original;
      await store.command(
        id,
        { id: creator.id, role: 'host', community: creator.id },
        'simulation',
        (await store.get(id)).revision,
        randomUUID(),
        { type: 'start' },
      );
      await expect(page.locator('.mission')).toBeVisible();
      await expect(page.locator('body')).not.toContainText('Overlay reconnecting');
      expect((await store.get(id)).state.version).toBe(before.version + 1);
      expect(paths.every((path) => path === '/overlay/sim-alpha/session')).toBe(true);
      const read = await page.request.get('/overlay/sim-alpha/state');
      expect(read.status()).toBe(200);
      const projected = await read.json();
      expect(projected.me.id).toBe('sim-alpha');
      expect(projected.integration.details).toBeUndefined();
      expect(Object.values(projected.world.capabilities).every((value) => value === false)).toBe(
        true,
      );
      expect(
        (
          await page.request.post('/api/worlds', {
            headers: { 'x-torchline-request': '1' },
            data: {},
          })
        ).status(),
      ).toBe(401);
      await store.pool.query("DELETE FROM overlay_grants WHERE channel_id='sim-alpha'");
      await tick(app);
      await expect(page.locator('body')).toContainText('Overlay access ended');
      await expect(page.locator('.mission')).toHaveCount(0);
      const stoppedFeeds = feeds,
        stoppedReads = reads;
      await page.waitForTimeout(1600);
      expect(feeds).toBe(stoppedFeeds);
      expect(reads).toBe(stoppedReads);
      expect((await page.request.get('/overlay/sim-alpha/state')).status()).toBe(403);
    } finally {
      store.active = original;
      await page.goto('about:blank');
      await app.close();
    }
  }));
