import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { database } from '../helpers.ts';
import { createApp } from '../../apps/server/src/app.ts';
import type { WorldPresentation } from '@torchline/contracts';

// Engine-derived fixtures verify renderers, not Twitch or custody acceptance.
test('all physical-state fixtures remain legible in read-only 720p and 1080p compositions', async ({
  page,
}) =>
  database(async (store) => {
    test.setTimeout(90000);
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
          await expect(page.getByRole('heading', { name: world.title, exact: true })).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          await expect(page.getByRole('button')).toHaveCount(0);
          await expect(page.locator('canvas')).toHaveCount(0);
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
          const bounds = await page.evaluate(() => {
            const resource = document.querySelector('.resources')!.getBoundingClientRect();
            const scene = document.querySelector('.overlay-scene')!.getBoundingClientRect();
            const bottom = document.querySelector('.overlay-bottom')!.getBoundingClientRect();
            const context = document.querySelector('.overlay-context')!.getBoundingClientRect();
            return {
              telemetryAboveShip: resource.bottom <= scene.top,
              shipAboveInstructions: scene.bottom <= bottom.top,
              contextInside: context.bottom <= bottom.top,
            };
          });
          expect(bounds, `${name} composition has no overlapping information`).toEqual({
            telemetryAboveShip: true,
            shipAboveInstructions: true,
            contextInside: true,
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

test('keyboard cooperation, responsive workspaces, reduced motion and graphics recovery preserve canonical state', async ({
  page,
}) =>
  database(async (store) => {
    let overlay: Page | undefined;
    const app = await createApp(store, {
      mode: 'simulation',
      baseUrl: 'http://localhost:3100',
      sessionSecret: 'ab'.repeat(32),
      tokenKey: 'cd'.repeat(32),
      botSetupSecret: 'fixture-only',
    });
    await app.listen({ port: 3100, host: '127.0.0.1' });
    const external: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith('http://localhost:3100/')) external.push(request.url());
    });
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto('/');
      await page.getByRole('button', { name: 'Use simulation alpha' }).click();
      await page.getByRole('button', { name: 'Create an Ark' }).click();
      await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
      await expect(page.locator('canvas')).toHaveCount(0);
      const original = (await (await page.request.get('/api/state')).json()).world;
      await page.getByRole('button', { name: 'Add S', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Add A', exact: true }).focus();
      await page.keyboard.press('Space');
      await expect(page.getByRole('textbox', { name: 'Candidate route', exact: true })).toHaveValue(
        'S A',
      );
      for (const name of ['Archive', 'Relay', 'Hangar', 'Broadcast', 'Bridge']) {
        const button = page
          .getByRole('navigation', { name: 'Command deck' })
          .getByRole('button', { name: new RegExp(name) });
        await button.focus();
        await page.keyboard.press('Enter');
        await expect(button).toHaveAttribute('aria-current', 'page');
        if (name === 'Archive')
          await expect(page.getByRole('heading', { name: 'Canonical ship log' })).toBeVisible();
        for (const width of [320, 390, 768, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            `${name} at ${width}px`,
          ).toBe(true);
        }
      }
      expect((await (await page.request.get('/api/state')).json()).world).toEqual(original);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.getByRole('region', { name: 'Persistent Ark condition' }).scrollIntoViewIfNeeded();
      await expect
        .poll(
          async () =>
            (await page.locator('.scene-ready').count()) > 0 ||
            (await page.getByText('Cinematic graphics unavailable', { exact: false }).count()) > 0,
        )
        .toBe(true);
      await page.screenshot({ path: '.local/screenshots/bridge-design.png', fullPage: true });
      const graphics = await page.locator('.ark-stage').evaluate((element) => ({
        state: element.className,
        canvases: element.querySelectorAll('canvas').length,
        schematicOpacity: getComputedStyle(element.querySelector('svg')!).opacity,
      }));
      console.log('Renderer evidence:', JSON.stringify(graphics));
      await page.locator('.ark-stage').screenshot({ path: '.local/screenshots/ark-cinematic.png' });
      if (await page.locator('canvas').count()) {
        await page
          .locator('canvas')
          .evaluate((canvas) =>
            canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
          );
        await expect(page.locator('canvas')).toHaveCount(0);
        await expect(
          page.getByText('Cinematic graphics unavailable', { exact: false }),
        ).toBeVisible();
        await expect(page.locator('.ark-schematic')).toHaveCSS('opacity', '1');
      }
      expect(external).toEqual([]);
      expect((await (await page.request.get('/api/state')).json()).world).toEqual(original);
      await page.getByRole('button', { name: 'Open final decision' }).click();
      await page.getByRole('button', { name: 'Generate / rotate OBS link' }).click();
      [overlay] = await Promise.all([
        page.waitForEvent('popup'),
        page.getByRole('link', { name: 'Open read-only overlay' }).click(),
      ]);
      for (const size of [
        { width: 1280, height: 720 },
        { width: 1920, height: 1080 },
      ]) {
        await overlay.setViewportSize(size);
        await expect(overlay.getByText('1. Sacrifice navigation', { exact: true })).toBeVisible();
        await expect(overlay.getByRole('button')).toHaveCount(0);
        expect(
          await overlay.evaluate(
            () =>
              document.documentElement.scrollHeight <= innerHeight &&
              document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const clear = await overlay
          .locator('.overlay-context')
          .evaluate(
            (element) =>
              element.getBoundingClientRect().bottom <=
              document.querySelector('.overlay-bottom')!.getBoundingClientRect().top,
          );
        expect(clear).toBe(true);
      }
    } finally {
      await overlay?.close();
      await page.goto('about:blank');
      await app.close();
    }
  }));
