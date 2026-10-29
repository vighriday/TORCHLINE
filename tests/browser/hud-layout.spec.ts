import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { Command } from '@torchline/contracts';
import { configureEpisode } from '@torchline/storage';
import { database } from '../helpers.ts';
import { createApp } from '../../apps/server/src/app.ts';

test('gameplay regions reserve their own space at desktop, compact, tablet and mobile sizes', async ({
  page,
}) =>
  database(async (store) => {
    test.setTimeout(120000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const app = await createApp(
      store,
      {
        mode: 'simulation',
        baseUrl: 'http://localhost:3100',
        sessionSecret: 'ab'.repeat(32),
        tokenKey: 'cd'.repeat(32),
        botSetupSecret: 'fixture',
      },
      { workers: false },
    );
    const creator = await store.ensureCreator('sim-alpha', 'Simulation alpha', 'simulation');
    const id = await store.create(creator);
    await configureEpisode(store, creator, id, {
      investigation: null,
      challenge: null,
      allocation: null,
      decision: null,
    });
    const act = async (command: Command) => {
      const world = await store.get(id);
      await store.command(
        id,
        { id: creator.id, role: 'host', community: creator.id },
        'simulation',
        world.revision,
        randomUUID(),
        command,
      );
    };
    await act({ type: 'configure-cooperation', budget: 5, investigation: true });
    await app.listen({ host: '127.0.0.1', port: 3100 });
    const inspect = async () => {
      await expect(page.locator('.flight-vessel')).toBeVisible();
      await expect(page.locator('.flight-status')).toBeVisible();
      for (const size of [
        { width: 1920, height: 1080 },
        { width: 1440, height: 900 },
        { width: 1280, height: 720 },
        { width: 820, height: 1180 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(size);
        const result = await page.locator('.flight-deck').evaluate((root) => {
          const selectors = [
            '.flight-heading',
            '.flight-status',
            '.flight-vessel',
            '.game-vitals',
            '.flight-mission',
            '.flight-decision-zone',
            '.flight-footer',
            '.simulation-console',
          ];
          const boxes = selectors.flatMap((name) => {
            const element = root.querySelector(name);
            if (!element) return [];
            const box = element.getBoundingClientRect();
            return box.width && box.height
              ? [{ name, left: box.left, right: box.right, top: box.top, bottom: box.bottom }]
              : [];
          });
          const collisions: string[] = [];
          for (let a = 0; a < boxes.length; a++)
            for (let b = a + 1; b < boxes.length; b++) {
              const x = boxes[a],
                y = boxes[b];
              if (
                Math.min(x.right, y.right) - Math.max(x.left, y.left) > 2 &&
                Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 2
              )
                collisions.push(x.name + ' overlaps ' + y.name);
            }
          return { collisions, overflow: document.documentElement.scrollWidth > innerWidth };
        });
        expect(result, `${size.width}×${size.height}`).toEqual({ collisions: [], overflow: false });
      }
    };
    const refresh = async () => {
      await page.reload();
      await expect(page.locator('.flight-deck')).toHaveAttribute('data-world', id);
      await inspect();
    };
    try {
      await page.goto('/');
      await page.getByRole('button', { name: 'Launch the Ark', exact: true }).click();
      await inspect();
      for (const command of [{ type: 'start' }, { type: 'close-investigation' }] as const) {
        await act(command);
        await refresh();
      }
      const scan = page.getByRole('button', { name: 'Scan relay A', exact: true });
      await scan.scrollIntoViewIfNeeded();
      await scan.click();
      await expect.poll(async () => (await store.get(id)).state.challenge.scanned).toContain('A');
      for (const command of [
        { type: 'close-challenge' },
        { type: 'close-allocation' },
        { type: 'close-voting' },
      ] as const) {
        await act(command);
        await refresh();
      }
      const commit = page.getByRole('button', { name: 'Commit Sacrifice navigation', exact: true });
      await commit.scrollIntoViewIfNeeded();
      expect(
        await commit.evaluate((e) => {
          const r = e.getBoundingClientRect();
          return e.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
        }),
      ).toBe(true);
      await commit.click();
      await expect.poll(async () => (await store.get(id)).state.chapter).toBe(1);
      await expect(
        page.getByRole('button', { name: 'Start chapter 2', exact: true }),
      ).toBeVisible();
      await inspect();
    } finally {
      await page.goto('about:blank');
      await app.close();
    }
  }));
