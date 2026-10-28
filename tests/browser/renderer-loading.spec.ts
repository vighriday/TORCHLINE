import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { database } from '../helpers.ts';
import type { Store } from '@torchline/storage';
import { createApp } from '../../apps/server/src/app.ts';

async function serve(run: (store: Store) => Promise<void>) {
  await database(async (store) => {
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
    await app.listen({ host: '127.0.0.1', port: 3100 });
    try {
      await run(store);
    } finally {
      await app.close();
    }
  });
}

test('cold 3D loading never flashes the schematic; first frame fades in and graphics failure retains fallback', async ({
  page,
}) => {
  test.setTimeout(90000);
  await serve(async (store) => {
    let releaseScene!: () => void;
    const sceneGate = new Promise<void>((resolve) => {
      releaseScene = resolve;
    });
    await page.route('**/assets/ark-scene-*.js', async (route) => {
      await sceneGate;
      await route.continue();
    });
    await page.setViewportSize({ width: 1365, height: 768 });
    try {
      await page.goto('/');
      await expect(page.locator('.title-screen .ark-stage')).toHaveAttribute(
        'data-renderer',
        'loading',
      );
      await expect(page.getByText('Bringing the Ark into view', { exact: true })).toBeVisible();
      await expect(page.locator('.ark-schematic')).toBeHidden();
      await expect(page.locator('.ark-schematic')).toHaveAttribute('aria-hidden', 'true');
      await page.evaluate(() => document.fonts.ready);
      const brand = await page.locator('.title-brand').boundingBox();
      const launch = await page.locator('.title-launch').boundingBox();
      await mkdir('.local/screenshots', { recursive: true });
      await page.screenshot({ path: '.local/screenshots/visual-loading.png' });
      releaseScene();
      await expect(page.locator('.scene-ready canvas')).toHaveCount(1, { timeout: 45000 });
      await expect(page.locator('.ark-canvas')).toHaveCSS('opacity', '1');
      await expect(page.locator('.ark-loading')).toHaveCount(0);
      await expect(page.locator('.ark-schematic')).toBeHidden();
      expect(await page.locator('.title-brand').boundingBox()).toEqual(brand);
      expect(await page.locator('.title-launch').boundingBox()).toEqual(launch);
      await page.screenshot({ path: '.local/screenshots/visual-ready.png' });
      await page
        .locator('canvas')
        .evaluate((canvas) =>
          canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
        );
      await expect(page.locator('.ark-stage')).toHaveAttribute('data-renderer', 'schematic');
      await expect(page.locator('.ark-schematic')).toBeVisible();
      await expect(page.locator('canvas')).toHaveCount(0);
      expect(Number((await store.pool.query('SELECT count(*) FROM worlds')).rows[0].count)).toBe(0);
    } finally {
      releaseScene();
      await page.goto('about:blank');
    }
  });
});
