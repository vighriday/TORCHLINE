import { test, expect } from '@playwright/test';
import { serve, launch, manual, navigate, snapshot } from './runtime.ts';
test.use({ reducedMotion: 'reduce' });
test('all ten final screens, keyboard launcher, local settings and legal chat guidance preserve the saved world', async ({
  page,
}) =>
  serve(async (store) => {
    // Ten real scenes and forty viewport changes exceed two minutes on shared CI GPUs.
    test.setTimeout(process.env.CI ? 300000 : 120000);
    const errors: string[] = [],
      external: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (!r.url().startsWith('http://localhost:3100/')) external.push(r.url());
    });
    try {
      await launch(page);
      await manual(page);
      await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
      await page.getByRole('button', { name: 'Scan A', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.clue-list .found')).toHaveCount(1);
      const original = (await store.get((await snapshot(page)).worldId)).state;
      for (const mode of [
        'awakening',
        'mission',
        'livewire',
        'inheritance',
        'hangar',
        'broadcast',
        'archive',
        'codex',
        'simulator',
        'settings',
      ]) {
        await navigate(page, mode);
        await expect(page.locator('[data-design=figma-v2]')).toBeVisible();
        for (const width of [320, 390, 820, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            mode + ' ' + width,
          ).toBe(true);
        }
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.locator('.system-launcher-button').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.locator('.system-launcher-button')).toBeFocused();
      await page.getByRole('button', { name: /HIGH CONTRAST HUD/ }).click();
      await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
      await page.getByLabel('HUD scale').fill('120');
      await page.reload();
      await expect(page.getByLabel('HUD scale')).toHaveValue('120');
      expect((await store.get(original.id)).state).toEqual(original);
      expect(external).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await page.goto('about:blank');
    }
  }));
