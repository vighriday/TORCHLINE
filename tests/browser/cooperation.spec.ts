import { test, expect } from '@playwright/test';
import { configureEpisode } from '@torchline/storage';
import { tick } from '../twitch-provider.ts';
import { serve, launch, snapshot, overlayLink } from './runtime.ts';
test.use({ reducedMotion: 'reduce' });
test('a live clock refresh preserves the captain’s unsaved timing selection', async ({ page }) =>
  serve(async (store, app) => {
    test.setTimeout(120000);
    try {
      await launch(page);
      await page.locator('.episode-preparation summary').click();
      const initial = await snapshot(page);
      expect(initial.clock).toBeUndefined();
      await page.getByLabel('Next chapter timing').selectOption('manual');

      // An independent, real SQL update first materializes the default clock.
      // Its actual SSE snapshot must not replace the local, unsaved selection.
      await configureEpisode(store, (await store.creator('sim-alpha'))!, initial.worldId, {
        investigation: 30,
        challenge: 90,
        allocation: 45,
        decision: 60,
      });
      const revision = (await store.get(initial.worldId)).revision;
      await tick(app);
      await expect(page.locator('main.mission')).toHaveAttribute('data-version', String(revision));
      await expect(page.getByLabel('Next chapter timing')).toHaveValue('manual');
      await page.getByRole('button', { name: 'Save timing', exact: true }).click();
      await expect
        .poll(async () => (await store.get(initial.worldId)).clock?.durations)
        .toEqual({ investigation: null, challenge: null, allocation: null, decision: null });
      await page.reload();
      await page.locator('.episode-preparation summary').click();
      await expect(page.getByLabel('Next chapter timing')).toHaveValue('manual');
    } finally {
      await page.goto('about:blank');
    }
  }));

test('mobile investigation, saved custom clocks and real allocation change the shared OBS state', async ({
  page,
  browser,
}) =>
  serve(async (store) => {
    test.setTimeout(120000);
    const overlay = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      reducedMotion: 'reduce',
    });
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await launch(page);
      await page.locator('.episode-preparation summary').click();
      await page.getByLabel('Repair reserve (0–10 power)').fill('5');
      await page.getByLabel('Investigate a shared clue first').check();
      await page.getByRole('button', { name: 'Save crew settings', exact: true }).click();
      await expect.poll(async () => (await snapshot(page)).cooperation?.budget).toBe(5);
      await page.getByLabel('Next chapter timing').selectOption('manual');
      await page.getByRole('button', { name: 'Save timing', exact: true }).click();
      await expect.poll(async () => (await snapshot(page)).clock?.durations?.challenge).toBeNull();
      await page.reload();
      await page.locator('.episode-preparation summary').click();
      await expect(page.getByLabel('Next chapter timing')).toHaveValue('manual');
      const world = await snapshot(page),
        custom = { investigation: null, challenge: null, allocation: null, decision: 120 };
      await configureEpisode(store, (await store.creator('sim-alpha'))!, world.worldId, custom);
      await page.reload();
      await page.locator('.episode-preparation summary').click();
      await expect(page.getByLabel('Next chapter timing')).toHaveValue('custom');
      await page.getByRole('button', { name: 'Save timing', exact: true }).click();
      await expect
        .poll(async () => (await store.get(world.worldId)).clock?.durations)
        .toEqual(custom);
      await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
      await page.locator('.practice-chat summary').click();
      const input = async (text: string) => {
        await page.getByLabel('Chat command', { exact: true }).fill(text);
        await page.getByRole('button', { name: 'Send simulated input', exact: true }).click();
      };
      await input('!inspect engine');
      await page.getByRole('button', { name: 'Close investigation', exact: true }).click();
      await expect(page.locator('.clue-list .found')).toContainText(['C']);
      await page.getByRole('button', { name: 'Close challenge', exact: true }).click();
      await input('!allocate 3 2');
      await expect
        .poll(async () => (await snapshot(page)).cooperation?.plan)
        .toEqual({ hull: 3, oxygen: 2 });
      await overlay.goto(await overlayLink(page, 'full'));
      await expect(overlay.locator('.game-directives')).toContainText(
        'Locked plan: hull +3 · oxygen +2',
      );
      await expect(overlay.getByRole('button')).toHaveCount(0);
      await page.getByRole('button', { name: 'Close allocation', exact: true }).click();
      await input('!vote 2');
      await page.getByRole('button', { name: 'Close voting', exact: true }).click();
      await page.getByRole('button', { name: /Seal the rear habitat/ }).click();
      await page.getByRole('button', { name: 'Commit directive', exact: true }).click();
      await expect(page.locator('[data-resource=hull]')).toHaveAttribute('data-value', '63');
      await expect(page.locator('[data-resource=oxygen]')).toHaveAttribute('data-value', '64');
      await expect(overlay.locator('[data-resource=hull]')).toHaveAttribute('data-value', '63');
      await page.reload();
      await expect(page.locator('[data-resource=hull]')).toHaveAttribute('data-value', '63');
    } finally {
      await overlay.close();
      await page.goto('about:blank');
    }
  }));
