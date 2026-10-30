import { test, expect } from '@playwright/test';
import { database } from '../helpers.ts';
import { createApp } from '../../apps/server/src/app.ts';
import { chooseSimulation, disclose } from './ui.ts';
import { replayEvents } from '@torchline/engine';

test('mobile mission selection locks, changes the saved Ark once, and updates the read-only compact OBS view', async ({
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
      botRepliesEnabled: false,
    });
    await app.listen({ port: 3100, host: '127.0.0.1' });
    const overlay = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    overlay.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await overlay.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      await chooseSimulation(page, 'alpha');
      await page.getByRole('button', { name: 'Create an Ark', exact: true }).click();
      await expect.poll(async () => Boolean(await store.active('sim-alpha'))).toBe(true);
      const id = (await store.active('sim-alpha'))!.id;
      const before = (await store.get(id)).state.resources.hull;
      await disclose(page, '.captain-console');
      await page.getByRole('button', { name: 'Generate / rotate OBS link' }).click();
      const href = await page
        .getByRole('link', { name: 'Open compact OBS dock' })
        .getAttribute('href');
      await overlay.goto(href!);
      await expect(overlay.locator('.lw-dock')).toBeVisible();
      expect(new URL(overlay.url()).searchParams.get('view')).toBe('compact');
      expect(
        await overlay.evaluate(() => getComputedStyle(document.documentElement).backgroundColor),
      ).toBe('rgba(0, 0, 0, 0)');
      expect(await overlay.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
        'rgba(0, 0, 0, 0)',
      );
      expect(await overlay.getByRole('button').count()).toBe(0);
      await page
        .getByRole('navigation', { name: 'Command deck' })
        .getByRole('button')
        .filter({ hasText: 'LIVEWIRE' })
        .click();
      await page.getByLabel('Game you are playing').fill('Rocket League');
      await page.getByLabel('One attempt', { exact: true }).fill('Win this match');
      await page
        .getByRole('button', { name: 'Open mission · spend 1 supply', exact: true })
        .click();
      await expect(page.getByText('Crew selection is open.', { exact: false })).toBeVisible();
      await page.locator('.lw-simulator summary').click();
      await page.getByRole('button', { name: 'Send practice ballot' }).click();
      await expect(page.locator('[data-ballots=hull]')).toHaveText('1 votes');
      await expect(overlay.locator('[data-ballots=hull]')).toHaveText('1 votes');
      await page.getByRole('button', { name: 'Lock commitment · start attempt' }).click();
      await expect(
        page.getByRole('button', { name: 'Confirm failure · streamer-attested' }),
      ).toBeVisible();
      await page.reload();
      await page
        .getByRole('navigation', { name: 'Command deck' })
        .getByRole('button')
        .filter({ hasText: 'LIVEWIRE' })
        .click();
      await expect(
        page.getByRole('button', { name: 'Confirm failure · streamer-attested' }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Confirm failure · streamer-attested' }).click();
      await expect(
        page.getByText(
          'Streamer-attested failure. The saved Ark and ship log now include this result.',
        ),
      ).toBeVisible();
      await page.screenshot({ path: '.local/livewire-mobile-result.png', fullPage: true });
      await overlay.screenshot({ path: '.local/livewire-compact-result.png' });
      await expect(overlay.locator('[data-livewire-resource=hull]')).toHaveText(`${before - 6}%`);
      await overlay.reload();
      await expect(overlay.locator('[data-livewire-resource=hull]')).toHaveText(`${before - 6}%`);
      const saved = await store.get(id);
      expect(saved.events.filter((e) => e.command.type === 'livewire-resolve')).toHaveLength(1);
      expect(replayEvents(id, saved.events)).toEqual(saved.state);
      for (const size of [
        { width: 1280, height: 720 },
        { width: 1920, height: 1080 },
        { width: 390, height: 844 },
      ]) {
        await overlay.setViewportSize(size);
        const box = await overlay.locator('.lw-dock').boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
        if (size.width >= 1280)
          expect((box!.width * box!.height) / (size.width * size.height)).toBeLessThan(0.18);
        expect(
          await overlay.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        ).toBe(true);
      }
      await page
        .getByRole('navigation', { name: 'Command deck' })
        .getByRole('button')
        .filter({ hasText: 'Archive' })
        .click();
      await expect(page.locator('.history').getByText(/Streamer-attested failure/)).toBeVisible();
      await page
        .getByRole('navigation', { name: 'Command deck' })
        .getByRole('button')
        .filter({ hasText: 'Bridge' })
        .click();
      await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
      await expect.poll(async () => (await store.get(id)).state.phase).toBe('challenge');
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    } finally {
      await page.goto('about:blank');
      await overlay.close();
      await app.close();
    }
  }));
