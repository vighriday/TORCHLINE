import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { database } from '../helpers.ts';
import { createApp } from '../../apps/server/src/app.ts';
import { tick } from '../twitch-provider.ts';

// ADR 0034: a transient projection failure ends the authenticated dashboard feed, and the
// dashboard must recover on its own: refresh the saved snapshot, reopen the feed, and keep
// applying new saved state without a manual reconnect or a replayed mutation.
test('dashboard feed recovers from a transient projection failure without a manual reconnect', async ({
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
    const original = store.active.bind(store);
    const posts: string[] = [];
    try {
      await app.listen({ port: 3100, host: '127.0.0.1' });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const login = await page.request.post(`${baseUrl}/api/simulator/login`, {
        headers: { 'X-Torchline-Request': '1', origin: baseUrl },
        data: { channel: 'alpha' },
      });
      expect(login.ok()).toBe(true);
      const creator = (await store.creator('sim-alpha'))!;
      const id = await store.create(creator);
      page.on('request', (request) => {
        if (request.method() === 'POST') posts.push(new URL(request.url()).pathname);
      });
      await page.goto(`${baseUrl}/?screen=mission`);
      await expect(page.locator('main.mission')).toHaveAttribute('data-phase', 'ready');

      store.active = async () => {
        throw new Error('Fixture transient SQL failure');
      };
      // A publication round is skipped while an earlier send for the same feed is still in
      // flight, so keep publishing until the failure reaches the browser.
      await expect
        .poll(async () => {
          await tick(app);
          return page.locator('.connection-banner').count();
        })
        .toBeGreaterThan(0);
      await expect(page.locator('.connection-banner')).toContainText('Reconnecting');
      store.active = original;

      await store.command(
        id,
        { id: creator.id, role: 'host', community: creator.id },
        'simulation',
        (await store.get(id)).revision,
        randomUUID(),
        { type: 'start' },
      );
      await tick(app);
      // The reopened feed delivers the newer saved state and clears the banner by itself.
      await expect(page.locator('main.mission')).toHaveAttribute('data-phase', 'challenge', {
        timeout: 15000,
      });
      await expect(page.locator('.connection-banner')).toHaveCount(0);
      // Recovery only read state: the browser issued no gameplay mutation of its own.
      expect(posts.filter((path) => path.includes('/commands'))).toEqual([]);
      expect((await store.get(id)).state.chapter).toBe(1);
    } finally {
      store.active = original;
      await app.close();
      await page.goto('about:blank');
    }
  }));
