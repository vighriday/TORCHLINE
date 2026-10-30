import { test, expect } from '@playwright/test';
import { serve, launch, navigate } from './runtime.ts';
test.use({ reducedMotion: 'reduce' });
test('handoff copy, consent, offers and actions never overlap on phone or tablet', async ({
  page,
}) =>
  serve(async () => {
    test.setTimeout(90000);
    await launch(page);
    await navigate(page, 'inheritance');
    try {
      for (const width of [390, 820, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        const layout = await page.locator('.inheritance').evaluate((root) => {
          const selectors = [
            '.incoming-copy',
            '.captain-transfer',
            '.legacy-panel',
            '.inheritance-action',
            '.relay-account button',
          ];
          const boxes = selectors.map((name) => ({
            name,
            rect: root.querySelector(name)!.getBoundingClientRect(),
          }));
          const overlaps: string[] = [];
          for (let a = 0; a < boxes.length; a++)
            for (let b = a + 1; b < boxes.length; b++) {
              const x = boxes[a].rect,
                y = boxes[b].rect;
              if (
                Math.min(x.right, y.right) - Math.max(x.left, y.left) > 2 &&
                Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 2
              )
                overlaps.push(boxes[a].name + ' / ' + boxes[b].name);
            }
          return { overlaps, overflow: document.documentElement.scrollWidth > innerWidth };
        });
        expect(layout, String(width)).toEqual({ overlaps: [], overflow: false });
        await expect(page.getByLabel('Accept incoming world offers')).toBeVisible();
        if (width > 1100) {
          const scene = await page.locator('.inheritance-ship').boundingBox();
          const screen = await page.locator('.inheritance').boundingBox();
          expect(scene).toEqual(screen);
        }
      }
    } finally {
      await page.goto('about:blank');
    }
  }));

test('awakening actions and manifest remain separate at desktop, tablet and phone sizes', async ({
  page,
}) =>
  serve(async () => {
    test.setTimeout(90000);
    try {
      for (const size of [
        { width: 390, height: 844 },
        { width: 820, height: 900 },
        { width: 1280, height: 720 },
        { width: 1920, height: 900 },
      ]) {
        await page.setViewportSize(size);
        await page.goto('/?screen=awakening');
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('.awakening-actions')).toBeVisible();
        const copy = (await page.locator('.awakening-copy').boundingBox())!;
        const metrics = (await page.locator('.awakening-metrics').boundingBox())!;
        expect(metrics.y - (copy.y + copy.height), JSON.stringify(size)).toBeGreaterThanOrEqual(30);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
          false,
        );
      }
    } finally {
      await page.goto('about:blank');
    }
  }));
