import { expect, test } from '@playwright/test';

import { readFile } from 'node:fs/promises';
import { database } from '../helpers.ts';
import { createApp } from '../../apps/server/src/app.ts';
import type { WorldPresentation } from '@torchline/contracts';

// Engine-derived fixtures verify renderers, not Twitch or custody acceptance.
test('all physical-state fixtures remain legible in read-only 720p and 1080p compositions', async ({
  page,
}) =>
  database(async (store) => {
    test.setTimeout(180000);
    const app = await createApp(
      store,
      {
        mode: 'simulation',
        baseUrl: 'http://localhost:3100',
        sessionSecret: 'ab'.repeat(32),
        tokenKey: 'cd'.repeat(32),
        botSetupSecret: 'fixture-only',
      },
      { workers: false },
    );
    let projected: WorldPresentation;
    app.get('/overlay/design-fixture/state', async () => ({
      world: projected,
      mode: 'simulation',
    }));
    app.get('/overlay/design-fixture/events', async (_request, reply) => {
      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
      });
      reply.raw.write(
        `event: snapshot\ndata: ${JSON.stringify({ world: projected, mode: 'simulation' })}\n\n`,
      );
    });
    await app.listen({ port: 3100, host: '127.0.0.1' });
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    try {
      for (const name of [
        'pristine',
        'navigation-sacrificed',
        'leaking',
        'repaired-with-scars',
        'cargo-jettisoned',
        'inherited',
        'wreck',
      ]) {
        const world = JSON.parse(
          await readFile(`docs/design/fixtures/${name}.json`, 'utf8'),
        ) as WorldPresentation;
        projected = world;
        for (const size of [
          { width: 1280, height: 720 },
          { width: 1920, height: 1080 },
        ]) {
          await page.setViewportSize(size);
          await page.goto('/overlay/design-fixture/');
          await expect(page.locator('.chapter-block')).toContainText(world.title);
          await page.evaluate(() => document.fonts.ready);
          await expect(page.getByRole('button')).toHaveCount(0);
          await expect(page.locator('.ark-canvas')).toHaveAttribute('data-scene-ready', 'true', {
            timeout: 45000,
          });
          for (const system of world.systems)
            await expect(page.locator(`[data-system=${system.id}]`)).toHaveAttribute(
              'data-condition',
              system.condition,
            );
          const fit = await page.evaluate(() => ({
            width: document.documentElement.scrollWidth <= innerWidth,
            height: document.documentElement.scrollHeight <= innerHeight,
          }));
          expect(fit, `${name} at ${size.width}×${size.height}`).toEqual({
            width: true,
            height: true,
          });
          if (name === 'leaking' || name === 'navigation-sacrificed')
            await page.screenshot({ path: `.local/screenshots/overlay-${name}-${size.width}.png` });
        }
      }
      expect(failures).toEqual([]);
    } finally {
      await page.goto('about:blank');
      await app.close();
    }
  }));
