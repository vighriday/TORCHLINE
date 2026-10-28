import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { database } from '../helpers.ts';
import type { Store } from '@torchline/storage';
import { createApp } from '../../apps/server/src/app.ts';

async function serve(run: (store: Store) => Promise<void>) {
  await database(async (store) => {
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
    await app.listen({ host: '127.0.0.1', port: 3100 });
    try {
      await run(store);
    } finally {
      await app.close();
    }
  });
}

test('an upstream HTML page becomes a recoverable connection screen without parser text or world creation', async ({
  page,
}) => {
  await serve(async (store) => {
    let healthy = false;
    let releaseState!: () => void;
    const stateGate = new Promise<void>((resolve) => {
      releaseState = resolve;
    });
    const mutations: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST') mutations.push(request.url());
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/state', async (route) => {
      await stateGate;
      return healthy
        ? route.continue()
        : route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<!DOCTYPE html><h1>private upstream detail</h1>',
          });
    });
    try {
      await page.goto('/');
      await expect(
        page.getByText('Connecting to your flight deck…', { exact: true }),
      ).toBeVisible();
      await expect(page.locator('.title-screen, .ark-schematic, canvas')).toHaveCount(0);
      releaseState();
      await expect(page.getByRole('alert')).toContainText('Please retry the connection.');
      await expect(page.locator('body')).not.toContainText(
        /Unexpected token|DOCTYPE|private upstream detail|not valid JSON/,
      );
      await expect(page.locator('.title-screen, .ark-schematic')).toHaveCount(0);
      healthy = true;
      await page.getByRole('button', { name: 'Retry connection', exact: true }).click();
      await expect(page.locator('.title-screen')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Launch the Ark', exact: true })).toBeEnabled();
      await expect(page.getByRole('alert')).toHaveCount(0);
      expect(mutations).toEqual([]);
      expect(Number((await store.pool.query('SELECT count(*) FROM worlds')).rows[0].count)).toBe(0);
    } finally {
      releaseState();
      await page.goto('about:blank');
    }
  });
});

test('a committed action with a lost response stays saved; reconnect performs no duplicate mutation', async ({
  page,
}) => {
  await serve(async (store) => {
    const creator = await store.ensureCreator('sim-alpha', 'Simulation alpha', 'simulation');
    const id = await store.create(creator);
    const before = (await store.get(id)).state;
    await page.request.post('/api/simulator/login', {
      headers: { 'X-Torchline-Request': '1' },
      data: { channel: 'alpha' },
    });
    let posts = 0,
      feeds = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/live/events') feeds++;
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/worlds/*/commands', async (route) => {
      posts++;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.fulfill({
        status: 502,
        contentType: 'text/html',
        body: '<!DOCTYPE html>upstream disconnected',
      });
    });
    try {
      await page.goto('/');
      await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Please retry the connection.');
      await expect(page.locator('.phase-challenge')).toBeVisible();
      const committed = (await store.get(id)).state;
      expect(committed.chapter).toBe(1);
      expect(committed.version).toBe(before.version + 1);
      await expect.poll(() => feeds).toBeGreaterThan(0);
      const priorFeeds = feeds;
      await page.getByRole('button', { name: 'Retry connection', exact: true }).click();
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect.poll(() => feeds).toBeGreaterThan(priorFeeds);
      expect(posts).toBe(1);
      expect((await store.get(id)).state).toEqual(committed);
    } finally {
      await page.goto('about:blank');
    }
  });
});
