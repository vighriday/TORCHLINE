import { test, expect } from '@playwright/test';
import { recoverLivewire } from '@torchline/storage';
import { serve, launch, navigate, snapshot, overlayLink } from './runtime.ts';
test('solo selection resumes after recovery and rotated OBS access is revoked without host authority', async ({
  page,
  browser,
}) =>
  serve(async (store) => {
    test.setTimeout(120000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const overlay = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      reducedMotion: 'reduce',
    });
    try {
      await launch(page, 'beta');
      await navigate(page, 'livewire');
      await page.getByRole('button', { name: 'STREAMER CONTROLS', exact: false }).click();
      await page.getByLabel('One attempt', { exact: true }).fill('A'.repeat(64));
      await page.getByRole('button', { name: 'HIDE STREAMER CONTROLS', exact: false }).click();
      await page
        .getByRole('button', { name: 'Open mission · spend 1 supply', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Lock commitment · start attempt', exact: true }),
      ).toBeDisabled();
      await recoverLivewire(store, 'simulation');
      await expect(
        page.getByRole('button', { name: 'Resume mission selection', exact: true }),
      ).toBeVisible();
      await page.reload();
      await page.getByRole('button', { name: 'Resume mission selection', exact: true }).click();
      await page.getByLabel('No crew votes · explicit solo target').selectOption('oxygen');
      await page
        .getByRole('button', { name: 'Lock commitment · start attempt', exact: true })
        .click();
      await expect.poll(async () => (await snapshot(page)).livewire?.stake?.selection).toBe('solo');
      const first = await overlayLink(page);
      await overlay.goto(first);
      await expect(overlay.locator('.dock--collapsed')).toBeVisible();
      for (const size of [
        { width: 1280, height: 720 },
        { width: 1920, height: 1080 },
        { width: 390, height: 844 },
      ]) {
        await overlay.setViewportSize(size);
        const box = (await overlay.locator('.dock--collapsed').boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width);
        expect(box.y + box.height).toBeLessThanOrEqual(size.height);
        for (const resource of await overlay.locator('[data-livewire-resource]').all()) {
          const bounds = (await resource.boundingBox())!;
          expect(bounds.x).toBeGreaterThanOrEqual(box.x);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(box.x + box.width);
          expect(bounds.y + bounds.height).toBeLessThanOrEqual(box.y + box.height);
        }
        if (size.width > 1000)
          expect((box.width * box.height) / (size.width * size.height)).toBeLessThan(0.18);
      }
      expect(
        await overlay.evaluate(() => getComputedStyle(document.documentElement).backgroundColor),
      ).toBe('rgba(0, 0, 0, 0)');
      const next = await overlayLink(page);
      await expect(overlay.locator('.livewire-empty')).toContainText('Overlay access ended');
      await overlay.goto(next);
      await expect(overlay.locator('.dock--collapsed')).toBeVisible();
      expect(await overlay.getByRole('button').count()).toBe(0);
    } finally {
      await overlay.close();
      await page.goto('about:blank');
    }
  }));
