import { test, expect } from '@playwright/test';
import {
  serve,
  launch,
  login,
  navigate,
  manual,
  closeDecision,
  overlayLink,
  snapshot,
} from './runtime.ts';
test.use({ reducedMotion: 'reduce' });
test('shared puzzle rewards, saved sacrifice and consented practice custody reach the inherited ship', async ({
  page,
  browser,
}) =>
  serve(async (store) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const targetContext = await browser.newContext({ reducedMotion: 'reduce' }),
      target = await targetContext.newPage(),
      overlay = await browser.newPage({ reducedMotion: 'reduce' });
    try {
      await launch(page);
      await manual(page);
      await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
      await page.locator('.practice-chat summary').click();
      await page.getByLabel('Chat command', { exact: true }).fill('!scan A');
      await page.getByRole('button', { name: 'Send simulated input', exact: true }).click();
      await expect(page.locator('.clue-list .found')).toContainText(['A']);
      await page.getByLabel('Simulated viewer').fill('crew-two');
      await page.getByLabel('Chat command', { exact: true }).fill('!scan C');
      await page.getByRole('button', { name: 'Send simulated input', exact: true }).click();
      await expect(page.locator('.clue-list .found')).toHaveCount(2);
      await page.getByLabel('Candidate route').fill('S A C T');
      await page.getByRole('button', { name: 'Submit route', exact: true }).click();
      await expect(page.locator('[data-resource=hull]')).toHaveAttribute('data-value', '85');
      await expect(page.locator('[data-system=shields]')).toHaveAttribute(
        'data-condition',
        'repaired',
      );
      await closeDecision(page);
      await expect(page.getByRole('button', { name: /Sacrifice navigation/ })).toBeEnabled();
      await page.getByRole('button', { name: /Sacrifice navigation/ }).click();
      await page.getByRole('button', { name: 'Commit directive', exact: true }).click();
      await expect(page.locator('[data-resource=navigation]')).toHaveAttribute('data-value', '0');
      await page.reload();
      await expect(page.locator('[data-system=navigation]')).toHaveAttribute(
        'data-condition',
        'destroyed',
      );
      const before = await snapshot(page);
      await overlay.goto(await overlayLink(page, 'full'));
      await expect(overlay.locator('[data-system=navigation]')).toHaveAttribute(
        'data-condition',
        'destroyed',
      );
      await expect(overlay.getByRole('button')).toHaveCount(0);
      await login(target, 'beta');
      await navigate(target, 'inheritance');
      await target.getByLabel('Accept incoming world offers').check();
      await expect.poll(async () => (await store.creator('sim-beta'))?.receive_opt_in).toBe(true);
      await navigate(page, 'inheritance');
      await page.getByRole('button', { name: 'Prepare handoff', exact: true }).click();
      await page
        .getByRole('button', { name: 'Inject simulated raid evidence', exact: true })
        .click();
      await expect(
        target.getByRole('button', { name: 'Accept inherited Ark', exact: true }),
      ).toBeVisible();
      await expect(target.locator('.inherited-stats')).toContainText('0%');
      await target.getByRole('button', { name: 'Accept inherited Ark', exact: true }).click();
      await expect.poll(async () => (await snapshot(target))?.worldId).toBe(before.worldId);
      await expect
        .poll(async () => (await store.get(before.worldId)).custodian_id)
        .toBe('sim-beta');
      await expect(overlay.getByRole('status')).toContainText('Waiting for an active Ark');
      if (await target.getByRole('button', { name: 'Exit inheritance', exact: true }).count())
        await target.getByRole('button', { name: 'Exit inheritance', exact: true }).click();
      await expect(target.locator('[data-system=navigation]')).toHaveAttribute(
        'data-condition',
        'destroyed',
      );
      await expect(target.locator('[data-system=shields]')).toHaveAttribute(
        'data-condition',
        'repaired',
      );
      await expect(target.locator('[data-resource=hull]')).toHaveAttribute('data-value', '80');
      await target.getByRole('button', { name: 'Start chapter 2', exact: true }).click();
      await expect(target.locator('.chapter-block')).toContainText('The Blind Jump');
      await expect(target.locator('[data-resource=hull]')).toHaveAttribute('data-value', '80');
      expect(errors).toEqual([]);
    } finally {
      await overlay.close();
      await targetContext.close();
      await page.goto('about:blank');
    }
  }));
test('phone captain can create and play a saved chapter without layout overflow', async ({
  page,
}) =>
  serve(async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await launch(page, 'gamma');
    await manual(page);
    await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
    await expect(page.locator('.chapter-block')).toContainText('Radiation Storm');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Scan A', exact: true }).click();
    await expect(page.locator('.clue-list .found')).toHaveCount(1);
    await page.goto('about:blank');
  }));
