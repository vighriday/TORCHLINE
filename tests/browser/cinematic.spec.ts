import { expect, test } from '@playwright/test';
import { createApp } from '../../apps/server/src/app.ts';
import { database } from '../helpers.ts';
import { disclose } from './ui.ts';

test('cinematic launch and recorded effects preserve saves without replaying old spectacle', async ({
  page,
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
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && /same key|unique.*key/i.test(m.text())) errors.push(m.text());
    });
    try {
      await page.setViewportSize({ width: 1365, height: 768 });
      await page.goto('/');
      await expect(page.locator('.title-screen')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      // A cold software WebGL context can take longer than ordinary DOM assertions.
      await expect(page.locator('.title-screen .scene-ready canvas')).toHaveCount(1, {
        timeout: 30000,
      });
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
        true,
      );
      await page.getByRole('button', { name: 'Reduce motion', exact: true }).click();
      await expect(page.locator('canvas')).toHaveCount(0);
      await page.getByRole('button', { name: 'Motion reduced', exact: true }).click();
      await expect(page.locator('.scene-ready canvas')).toHaveCount(1);
      // Enter while focus is on the game surface launches a real saved simulation.
      await page.locator('.title-screen').click({ position: { x: 8, y: 8 } });
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('button', { name: 'Start chapter 1', exact: true }),
      ).toBeVisible();
      await expect(page.locator('.scene-ready canvas')).toHaveCount(1);
      await expect(page.locator('.ark-canvas')).not.toHaveAttribute('data-last-cue');
      await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
      await expect(page.locator('.ark-canvas')).toHaveAttribute('data-environment', '1');
      await disclose(page, '.simulation-console');
      await page.getByRole('textbox', { name: 'Chat command' }).fill('!scan A');
      await page.getByRole('button', { name: 'Send simulated input' }).click();
      await expect(page.getByText('A · Discovered', { exact: true })).toBeVisible();
      await expect(page.locator('.ark-canvas')).toHaveAttribute('data-last-cue', 'discovery');
      await page.getByRole('button', { name: 'Open final decision', exact: true }).click();
      await page.getByRole('button', { name: 'Commit Sacrifice navigation', exact: true }).click();
      await expect(page.locator('[data-system=navigation]')).toHaveAttribute(
        'data-condition',
        'destroyed',
      );
      await expect(page.locator('.cinematic-consequence')).toContainText('SACRIFICE RECORDED');
      await expect(page.locator('.ark-canvas')).toHaveAttribute('data-last-cue', 'damage');
      await expect(page.locator('.ark-canvas')).toHaveAttribute('data-draw-calls', /\d+/);
      const metrics = await page.locator('.ark-canvas').evaluate((e) => ({
        particles: Number((e as HTMLElement).dataset.particles),
        ratio: Number((e as HTMLElement).dataset.pixelRatio),
      }));
      expect(metrics.particles).toBeLessThanOrEqual(320);
      expect(metrics.ratio).toBeGreaterThanOrEqual(0.5);
      expect(metrics.ratio).toBeLessThanOrEqual(1.5);
      await page.reload();
      await expect(page.locator('.scene-ready canvas')).toHaveCount(1);
      await expect(page.locator('[data-system=navigation]')).toHaveAttribute(
        'data-condition',
        'destroyed',
      );
      await expect(page.locator('.ark-canvas')).not.toHaveAttribute('data-last-cue');
      await expect(page.locator('.cinematic-consequence')).toHaveCount(0);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(page.locator('canvas')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Start chapter 2', exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await page.goto('about:blank');
      await app.close();
    }
  }));
