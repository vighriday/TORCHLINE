import { test, expect } from '@playwright/test';
import { configureEpisode } from '@torchline/storage';
import { database } from '../helpers.ts';
import { createApp } from '../../apps/server/src/app.ts';

test('encounter motion, ship inspection and relay interaction use real saved state; reload never replays arrival', async ({
  page,
}) =>
  database(async (store) => {
    test.setTimeout(120000);
    const app = await createApp(
      store,
      {
        mode: 'simulation',
        baseUrl: 'http://localhost:3100',
        sessionSecret: 'ab'.repeat(32),
        tokenKey: 'cd'.repeat(32),
        botSetupSecret: 'fixture',
      },
      { workers: false },
    );
    const creator = await store.ensureCreator('sim-alpha', 'Simulation alpha', 'simulation');
    const id = await store.create(creator);
    await configureEpisode(store, creator, id, {
      investigation: null,
      challenge: null,
      allocation: null,
      decision: null,
    });
    await app.listen({ host: '127.0.0.1', port: 3100 });
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      await page.getByRole('button', { name: 'Launch the Ark' }).click();
      await expect(
        page.getByRole('button', { name: 'Start chapter 1', exact: true }),
      ).toBeVisible();
      const canvas = page.locator('.ark-canvas');
      await expect(page.locator('.scene-ready canvas')).toHaveCount(1, { timeout: 45000 });
      await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Sector arrival', exact: true })).toBeVisible();
      await expect(canvas).toHaveAttribute('data-encounter', 'radiation-front');
      await page.getByRole('button', { name: 'Dismiss transmission' }).click();
      await expect(page.getByRole('region', { name: 'Sector arrival', exact: true })).toHaveCount(
        0,
      );
      // Both composited pixels and rendered-frame progress must change: a data flag alone is insufficient.
      await expect
        .poll(async () => Number(await canvas.getAttribute('data-frames')))
        .toBeGreaterThan(5);
      const first = await page.locator('.scene-ready canvas').screenshot(),
        frames = Number(await canvas.getAttribute('data-frames'));
      await expect
        .poll(async () => Number(await canvas.getAttribute('data-frames')), { timeout: 15000 })
        .toBeGreaterThan(frames + 8);
      const second = await page.locator('.scene-ready canvas').screenshot();
      expect(Buffer.compare(first, second)).not.toBe(0);
      const before = await store.get(id);
      const inspect = page.getByRole('button', { name: 'Inspect Navigation', exact: true });
      await expect(inspect).toBeVisible();
      await inspect.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('complementary', { name: 'Selected ship system' })).toContainText(
        'Navigation',
      );
      expect((await store.get(id)).state).toEqual(before.state);
      await page.getByRole('button', { name: 'Close ship inspection' }).click();
      await page.getByRole('button', { name: 'Scan relay A', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByText('A · Discovered', { exact: true })).toBeVisible();
      expect((await store.get(id)).state.challenge.scanned).toContain('A');
      await expect(
        page.getByRole('button', { name: 'Copy command !scan B', exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(page.locator('.phase-challenge')).toBeVisible();
      await expect(page.getByRole('region', { name: 'Sector arrival', exact: true })).toHaveCount(
        0,
      );
      await expect(page.locator('.cinematic-consequence')).toHaveCount(0);
      await expect(page.getByText('A · Discovered', { exact: true })).toBeVisible();
      // UI-only live projection fixture: exercises the chat destination, not real Twitch consent/delivery.
      const snapshot = await page.evaluate(() => fetch('/api/state').then((r) => r.json()));
      snapshot.mode = 'live';
      snapshot.world.mode = 'live';
      snapshot.world.host = 'hriday29';
      await page.route('**/api/operator/bot-setup', (route) =>
        route.fulfill({ json: { pending: null } }),
      );
      await page.route('**/api/state', (route) => route.fulfill({ json: snapshot }));
      await page.route('**/api/live/events', (route) =>
        route.fulfill({
          contentType: 'text/event-stream',
          body: `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`,
        }),
      );
      await page.reload();
      await expect(page.getByRole('link', { name: 'Open Twitch chat ↗' })).toHaveAttribute(
        'href',
        'https://www.twitch.tv/popout/hriday29/chat',
      );
      await expect(page.getByRole('link', { name: 'Open Twitch chat ↗' })).toHaveAttribute(
        'rel',
        'noopener noreferrer',
      );
      snapshot.world.phase = 'awaiting-commit';
      await page.reload();
      await expect(
        page.getByRole('button', { name: 'Copy command !status', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Copy command !vote 1', exact: true }),
      ).toHaveCount(0);
      snapshot.world.phase = 'challenge';
      snapshot.world.challenge.kind = 'work-order';
      snapshot.world.challenge.nodes = snapshot.world.challenge.nodes.map(
        (node: { id: string }) => ({
          ...node,
          revealed: node.id !== 'D',
          patched: node.id !== 'B',
        }),
      );
      await page.reload();
      await expect(
        page.getByRole('button', { name: 'Copy command !patch B', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Copy command !scan D', exact: true }),
      ).toHaveCount(0);
      snapshot.world.challenge.nodes = snapshot.world.challenge.nodes.map(
        (node: { id: string }) => ({
          ...node,
          revealed: !['A', 'D'].includes(node.id),
          patched: node.id === 'B',
        }),
      );
      await page.reload();
      await expect(
        page.getByRole('button', { name: 'Copy command !scan A', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Copy command !patch C', exact: true }),
      ).toHaveCount(0);
      await page.evaluate(() => localStorage.setItem('torchline.motion', 'reduced'));
      await page.reload();
      await expect(page.locator('canvas')).toHaveCount(0);
      await expect(page.locator('.encounter-dust')).toHaveCSS('animation-name', 'none');
      await page.evaluate(() => localStorage.removeItem('torchline.motion'));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.reload();
      await expect(page.locator('canvas')).toHaveCount(0);
      await expect(page.locator('.encounter-dust')).toHaveCSS('animation-name', 'none');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    } finally {
      await page.goto('about:blank');
      await app.close();
    }
  }));
