import { expect, test } from '@playwright/test';
import { database } from '../helpers.ts';
import { createApp } from '../../apps/server/src/app.ts';

test('designed cooperation, exact allocation forecasts and frozen advice work on mobile and OBS', async ({
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
      botSetupSecret: 'fixture-only',
    });
    await app.listen({ port: 3100, host: '127.0.0.1' });
    const overlay = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const failures: string[] = [];
    await overlay.emulateMedia({ reducedMotion: 'reduce' });
    page.on('pageerror', (e) => failures.push(e.message));
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      await page.getByRole('button', { name: 'Use simulation alpha' }).click();
      await page.getByRole('button', { name: 'Create an Ark' }).click();
      await page.getByLabel('Repair reserve').fill('5');
      await page.getByLabel('Investigate a shared clue').check();
      await page.getByRole('button', { name: 'Save crew settings' }).click();
      await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'Choose where the crew investigates' }),
      ).toBeVisible();
      const input = async (text: string) => {
        await page.getByRole('textbox', { name: 'Chat command' }).fill(text);
        await page.getByRole('button', { name: 'Send simulated input' }).click();
      };
      await input('!inspect engine');
      await page.getByRole('button', { name: 'Open cooperative challenge' }).click();
      await expect(page.getByText('C · Discovered', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Open crew allocation' }).click();
      await input('!allocate 3 2');
      await expect(page.getByText(/3 hull repairs · 2 oxygen units/)).toBeVisible();
      await page.getByRole('button', { name: 'Generate / rotate OBS link' }).click();
      const href = await page
        .getByRole('link', { name: 'Open read-only overlay' })
        .getAttribute('href');
      await overlay.goto(href!);
      await expect(
        overlay.getByRole('heading', { name: 'Distribute the repair reserve' }),
      ).toBeVisible();
      await expect(overlay.getByRole('button')).toHaveCount(0);
      await page.getByRole('button', { name: 'Lock repairs & open decision' }).click();
      await input('!vote 2');
      await page.getByRole('button', { name: 'Freeze advisory votes' }).click();
      await expect(page.getByRole('timer')).toHaveText('Awaiting captain');
      await page.getByRole('button', { name: 'Commit Seal the rear habitat', exact: true }).click();
      await expect(page.locator('[data-resource=hull]')).toHaveText('63');
      await expect(page.locator('[data-resource=oxygen]')).toHaveText('64');
      await expect(overlay.locator('[data-resource=hull]')).toHaveText('63');
      await page.reload();
      await expect(page.locator('[data-resource=hull]')).toHaveText('63');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(failures).toEqual([]);
    } finally {
      await page.goto('about:blank');
      await overlay.close();
      await app.close();
    }
  }));
