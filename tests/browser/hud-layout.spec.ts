import { test, expect } from '@playwright/test';
import { serve, launch, manual, command, snapshot } from './runtime.ts';
test.use({ reducedMotion: 'reduce' });
test('mission panels and captain commit have unobstructed space through every gameplay window', async ({
  page,
}) =>
  serve(async () => {
    test.setTimeout(120000);
    await launch(page);
    await manual(page);
    await command(page, { type: 'configure-cooperation', budget: 5, investigation: true });
    const inspect = async () => {
      for (const size of [
        { width: 1920, height: 1080 },
        { width: 1440, height: 900 },
        { width: 1280, height: 720 },
        { width: 820, height: 1180 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(size);
        await expect(page.locator('.mission')).toBeVisible();
        const layout = await page.locator('.mission').evaluate((root) => {
          const boxes = ['.left-rail', '.ship-stage', '.decision-panel'].map((name) => ({
            name,
            box: root.querySelector(name)!.getBoundingClientRect(),
          }));
          const overlaps: string[] = [];
          for (let a = 0; a < boxes.length; a++)
            for (let b = a + 1; b < boxes.length; b++) {
              const x = boxes[a].box,
                y = boxes[b].box;
              if (
                Math.min(x.right, y.right) - Math.max(x.left, y.left) > 2 &&
                Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 2
              )
                overlaps.push(boxes[a].name + ' ' + boxes[b].name);
            }
          return { overlaps, overflow: document.documentElement.scrollWidth > innerWidth };
        });
        expect(layout, JSON.stringify(size)).toEqual({ overlaps: [], overflow: false });
      }
    };
    try {
      for (const action of [
        null,
        { type: 'start' },
        { type: 'close-investigation' },
        { type: 'close-challenge' },
        { type: 'close-allocation' },
        { type: 'close-voting' },
      ] as const) {
        if (action) await command(page, action);
        await page.reload();
        await inspect();
      }
      await page.getByRole('button', { name: /Sacrifice navigation/ }).click();
      const commit = page.getByRole('button', { name: 'Commit directive', exact: true });
      await commit.scrollIntoViewIfNeeded();
      expect(
        await commit.evaluate((element) => {
          const r = element.getBoundingClientRect();
          return element.contains(
            document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2),
          );
        }),
      ).toBe(true);
      await commit.click();
      await expect.poll(async () => (await snapshot(page)).phase).toBe('ready');
      await inspect();
    } finally {
      await page.goto('about:blank');
    }
  }));
