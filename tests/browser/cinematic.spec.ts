import { test, expect } from '@playwright/test';
import { serve, launch, navigate, snapshot, manual, closeDecision } from './runtime.ts';
test('rolling Ark renders real changing pixels, stable cockpit navigation and persistent damage', async ({
  page,
}) =>
  serve(async (store) => {
    // Shared CI software rendering is a correctness check, not an FPS benchmark.
    test.setTimeout(process.env.CI ? 300000 : 180000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1280, height: 720 });
    try {
      await launch(page);
      await manual(page);
      const scene = page.locator('.ark-canvas');
      await expect(scene).toHaveAttribute('data-scene-ready', 'true', { timeout: 45000 });
      const pixels = await scene.locator('canvas').screenshot(),
        frames = Number(await scene.getAttribute('data-frame-count'));
      await expect
        .poll(async () => Number(await scene.getAttribute('data-frame-count')), {
          timeout: process.env.CI ? 60000 : 15000,
        })
        .toBeGreaterThan(frames + 8);
      expect(Buffer.compare(pixels, await scene.locator('canvas').screenshot())).not.toBe(0);
      const ratio = Number(await scene.getAttribute('data-pixel-ratio'));
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThanOrEqual(1.5);
      await navigate(page, 'settings');
      await page.getByRole('button', { name: /FULL MOTION/ }).click();
      await navigate(page, 'mission');
      await page.getByRole('button', { name: '3D COCKPIT', exact: true }).click();
      await expect(page.locator('.stage-heading')).toContainText('COMMAND DECK');
      await page.getByRole('button', { name: 'EXTERIOR', exact: true }).click();
      await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
      await page.getByRole('button', { name: 'Scan A', exact: true }).click();
      await expect(page.locator('.clue-list .found')).toHaveCount(1);
      await closeDecision(page);
      await page.getByRole('button', { name: /Sacrifice navigation/ }).click();
      await page.getByRole('button', { name: 'Commit directive', exact: true }).click();
      await expect(page.locator('.nav-dead-stamp')).toContainText('NAVIGATION OFFLINE');
      await page.reload();
      await expect(page.locator('.nav-dead-stamp')).toBeVisible();
      await expect(page.locator('[data-system=navigation]')).toHaveAttribute(
        'data-condition',
        'destroyed',
      );
      const before = (await store.get((await snapshot(page)).worldId)).state;
      await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
      await expect(scene).toHaveAttribute('data-scene-ready', 'true', { timeout: 45000 });
      const stopped = Number(await scene.getAttribute('data-frame-count'));
      await page.waitForTimeout(500);
      expect(Number(await scene.getAttribute('data-frame-count')) - stopped).toBeLessThanOrEqual(2);
      expect((await store.get(before.id)).state).toEqual(before);
      expect(errors).toEqual([]);
    } finally {
      await page.goto('about:blank');
    }
  }));
