import { test, expect } from '@playwright/test';
import { database } from '../helpers.ts';
import { createApp } from '../../apps/server/src/app.ts';
import { recoverLivewire } from '@torchline/storage';
import { chooseSimulation } from './ui.ts';

test('solo selection recovers explicitly, long labels fit a transparent dock, and rotated access ends cleanly', async ({
  page,
  browser,
}) =>
  database(async (store) => {
    test.setTimeout(90000);
    const app = await createApp(store, {
      mode: 'simulation',
      baseUrl: 'http://localhost:3100',
      sessionSecret: 'ab'.repeat(32),
      tokenKey: 'cd'.repeat(32),
      botSetupSecret: 'fixture',
      livewireEnabled: true,
    });
    await app.listen({ port: 3100, host: '127.0.0.1' });
    const overlay = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await overlay.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      await chooseSimulation(page, 'beta');
      await page.getByRole('button', { name: 'Create an Ark', exact: true }).click();
      await expect.poll(async () => !!(await store.active('sim-beta'))).toBe(true);
      const id = (await store.active('sim-beta'))!.id;
      const openWorkspace = () =>
        page
          .getByRole('navigation', { name: 'Command deck' })
          .getByRole('button')
          .filter({ hasText: 'LIVEWIRE' })
          .click();
      await openWorkspace();
      await page.getByLabel('Game you are playing').fill('G'.repeat(64));
      await page.getByLabel('One attempt', { exact: true }).fill('A'.repeat(64));
      await page
        .getByRole('button', { name: 'Open mission · spend 1 supply', exact: true })
        .click();
      await expect(page.getByLabel('Solo system (no crew votes)')).toBeVisible();
      await recoverLivewire(store, 'simulation');
      await expect(page.getByRole('button', { name: 'Resume saved selection' })).toBeVisible();
      await page.reload();
      await openWorkspace();
      await page.getByRole('button', { name: 'Resume saved selection' }).click();
      await page.getByLabel('Solo system (no crew votes)').selectOption('oxygen');
      await page.getByRole('button', { name: 'Lock commitment · start attempt' }).click();
      const headers = { 'X-Torchline-Request': '1', origin: 'http://localhost:3100' };
      const grant = async () => {
        const r = await page.request.post('/api/overlay-grant', { headers, data: {} });
        expect(r.ok()).toBe(true);
        const u = new URL((await r.json()).url);
        u.searchParams.set('view', 'compact');
        return u.toString();
      };
      await overlay.goto(await grant());
      await expect(overlay.getByText('Solo commitment', { exact: false })).toBeVisible();
      for (const size of [
        { width: 1280, height: 720 },
        { width: 1920, height: 1080 },
      ]) {
        await overlay.setViewportSize(size);
        const box = (await overlay.locator('.lw-dock').boundingBox())!;
        expect((box.width * box.height) / (size.width * size.height)).toBeLessThan(0.18);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
      }
      const png = await overlay.screenshot({ omitBackground: true });
      const alpha = await overlay.evaluate(async (bytes) => {
        const img = new Image();
        const ready = new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Screenshot decode failed'));
        });
        img.src = `data:image/png;base64,${bytes}`;
        await ready;
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(1, 1, 1, 1).data[3];
      }, png.toString('base64'));
      expect(alpha).toBe(0);
      const replacement = await grant();
      await expect(overlay.getByRole('status')).toHaveText(
        'Overlay access ended. Generate a current OBS link.',
      );
      expect(await overlay.locator('[data-livewire-resource]').count()).toBe(0);
      await overlay.goto(replacement);
      await expect(overlay.getByText('Solo commitment', { exact: false })).toBeVisible();
      expect(await overlay.getByRole('button').count()).toBe(0);
      await page.getByRole('button', { name: 'Cancel mission · allowance stays spent' }).click();
      await expect
        .poll(async () => (await store.get(id)).state.livewire!.stake.status)
        .toBe('cancelled');
    } finally {
      await page.goto('about:blank');
      await overlay.close();
      await app.close();
    }
  }));
