import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { database } from '../helpers.ts';
import type { Store } from '@torchline/storage';
import type { Command, WorldPresentation } from '@torchline/contracts';
import { createApp } from '../../apps/server/src/app.ts';
export const origin = 'http://localhost:3100';
export const headers = { 'X-Torchline-Request': '1', origin };
export async function serve(
  run: (store: Store, app: Awaited<ReturnType<typeof createApp>>) => Promise<void>,
  livewire = true,
) {
  return database(async (store) => {
    const app = await createApp(store, {
      mode: 'simulation',
      baseUrl: origin,
      sessionSecret: 'ab'.repeat(32),
      tokenKey: 'cd'.repeat(32),
      botSetupSecret: 'fixture',
      livewireEnabled: livewire,
      botRepliesEnabled: false,
    });
    await app.listen({ host: '127.0.0.1', port: 3100 });
    try {
      await run(store, app);
    } finally {
      await app.close();
    }
  });
}
export async function navigate(page: Page, mode: string) {
  if (await page.getByRole('button', { name: 'Exit inheritance', exact: true }).count())
    await page.getByRole('button', { name: 'Exit inheritance', exact: true }).click();
  await page.locator('.system-launcher-button').click();
  const modes = [
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
  ];
  await page
    .getByRole('dialog', { name: 'All ship systems' })
    .locator('.launcher-grid button')
    .nth(modes.indexOf(mode))
    .click();
}
export async function login(page: Page, channel = 'alpha') {
  const response = await page.request.post('/api/simulator/login', { headers, data: { channel } });
  expect(response.ok()).toBe(true);
  await page.goto('/?screen=mission');
}
export async function launch(page: Page, channel = 'alpha') {
  await login(page, channel);
  await page.getByRole('button', { name: 'LAUNCH THE ARK', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start chapter 1', exact: true })).toBeEnabled({
    timeout: 30000,
  });
}
export async function snapshot(page: Page) {
  return (await page.request.get('/api/state').then((r) => r.json())).world as WorldPresentation;
}
export async function command(page: Page, value: Command) {
  const world = await snapshot(page);
  const result = await page.request.post('/api/worlds/' + world.worldId + '/commands', {
    headers,
    data: { command: value, expectedVersion: world.worldVersion, commandId: crypto.randomUUID() },
  });
  expect(result.ok()).toBe(true);
}
export async function manual(page: Page) {
  const world = await snapshot(page);
  const result = await page.request.post('/api/worlds/' + world.worldId + '/timing', {
    headers,
    data: { investigation: null, challenge: null, allocation: null, decision: null },
  });
  expect(result.ok()).toBe(true);
}
export async function overlayLink(page: Page, view = 'compact') {
  const result = await page.request.post('/api/overlay-grant', { headers, data: {} });
  expect(result.ok()).toBe(true);
  const url = new URL((await result.json()).url);
  url.searchParams.set('view', view);
  return url.toString();
}
export async function closeDecision(page: Page) {
  let current = await snapshot(page);
  if (current.phase === 'investigation') await command(page, { type: 'close-investigation' });
  current = await snapshot(page);
  if (current.phase === 'challenge') await command(page, { type: 'close-challenge' });
  current = await snapshot(page);
  if (current.phase === 'allocation') await command(page, { type: 'close-allocation' });
  current = await snapshot(page);
  if (current.phase === 'decision') await command(page, { type: 'close-voting' });
}
