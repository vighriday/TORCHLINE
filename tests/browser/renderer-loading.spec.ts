import { test, expect } from '@playwright/test';
import { serve } from './runtime.ts';
test('cold graphics shows a single loading state; context failure and retry preserve layout and never create a world', async ({
  page,
}) =>
  serve(async (store) => {
    test.setTimeout(120000);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/assets/Ark3D-*.js', async (route) => {
      await gate;
      await route.continue();
    });
    try {
      await page.goto('/');
      await expect(page.locator('.ark-canvas-loading')).toBeVisible();
      await expect(page.locator('.ark-viewport svg')).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      const copy = await page.locator('.awakening-copy').boundingBox();
      release();
      await expect(page.locator('.ark-canvas')).toHaveAttribute('data-scene-ready', 'true', {
        timeout: 45000,
      });
      expect(await page.locator('.awakening-copy').boundingBox()).toEqual(copy);
      await expect(page.locator('.ark-canvas-loading')).toHaveCount(0);
      await page
        .locator('canvas')
        .evaluate((canvas) =>
          canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
        );
      await expect(page.locator('.ark-canvas-fallback')).toContainText('VISUAL LINK UNAVAILABLE');
      await expect(page.locator('canvas')).toHaveCount(0);
      await page.getByRole('button', { name: 'Retry graphics', exact: true }).click();
      await expect(page.locator('.ark-canvas')).toHaveAttribute('data-scene-ready', 'true', {
        timeout: 45000,
      });
      expect(Number((await store.pool.query('SELECT count(*) FROM worlds')).rows[0].count)).toBe(0);
    } finally {
      release();
      await page.goto('about:blank');
    }
  }));
