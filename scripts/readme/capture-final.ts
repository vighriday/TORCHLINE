import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import type { Command, WorldPresentation } from '@torchline/contracts';
import { Store } from '@torchline/storage';
import { createApp } from '../../apps/server/src/app.ts';

// Documentation footage only. Actual app + disposable saved simulation, never live credentials.
if (!process.env.DATABASE_URL) throw Error('Use an isolated development DATABASE_URL.');
const origin = 'http://localhost:3102';
const admin = new Store(process.env.DATABASE_URL);
const schema = `media_${randomUUID().replaceAll('-', '')}`;
await admin.pool.query(`CREATE SCHEMA "${schema}"`);
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('options', `-c search_path=${schema}`);
const store = new Store(url.toString());
await store.migrate();
const app = await createApp(
  store,
  {
    mode: 'simulation',
    baseUrl: origin,
    sessionSecret: 'ab'.repeat(32),
    tokenKey: 'cd'.repeat(32),
    botSetupSecret: 'documentation-fixture',
    livewireEnabled: true,
    botRepliesEnabled: false,
  },
  { workers: false },
);
await app.listen({ host: '127.0.0.1', port: 3102 });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
const headers = { 'X-Torchline-Request': '1', origin };
const output = '.local/final-media';
await mkdir(output + '/ark', { recursive: true });
await mkdir(output + '/livewire', { recursive: true });
await mkdir('assets/readme', { recursive: true });
async function post(path: string, data: unknown) {
  const response = await page.request.post(origin + path, { headers, data });
  if (!response.ok()) throw Error('Documentation action failed: ' + path);
  return response.json();
}
async function world() {
  return (await page.request.get(origin + '/api/state').then((r) => r.json()))
    .world as WorldPresentation;
}
async function act(command: Command) {
  const current = await world();
  await post('/api/worlds/' + current.worldId + '/commands', {
    command,
    expectedVersion: current.worldVersion,
    commandId: randomUUID(),
  });
}
async function ready() {
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator('.ark-canvas[data-scene-ready=true],.voxel-canvas[data-scene-ready=true]')
    .first()
    .waitFor({ timeout: 60000 });
}
try {
  await page.goto(origin);
  await ready();
  await page.screenshot({ path: 'assets/readme/awakening.png' });
  for (let i = 0; i < 24; i++) {
    await page.screenshot({ path: output + '/ark/' + String(i).padStart(3, '0') + '.png' });
    await page.waitForTimeout(180);
  }
  await post('/api/simulator/login', { channel: 'alpha' });
  await post('/api/worlds', {});
  const current = await world();
  await post('/api/worlds/' + current.worldId + '/timing', {
    investigation: null,
    challenge: null,
    allocation: null,
    decision: null,
  });
  await act({ type: 'start' });
  await page.goto(origin + '/?screen=mission');
  await ready();
  await page.screenshot({ path: 'assets/readme/mission-control.png' });
  await act({ type: 'close-challenge' });
  await act({ type: 'close-voting' });
  await act({ type: 'commit', option: 'burn-navigation' });
  // Use a new real ready-boundary opening, with a mechanically eligible hull target.
  await page.goto(origin + '/?screen=livewire');
  await page.getByRole('button', { name: 'Open mission · spend 1 supply', exact: true }).click();
  await page.locator('.practice-chat summary').click();
  await page.getByRole('button', { name: 'Send practice ballot', exact: true }).click();
  await page.locator('[data-ballots=hull]').filter({ hasText: '1 votes' }).waitFor();
  await page.getByRole('button', { name: 'Lock commitment · start attempt', exact: true }).click();
  await ready();
  await page.locator('.voxel-canvas[data-scene-ready=true]').waitFor({ timeout: 60000 });
  await page.screenshot({ path: 'assets/readme/minecraft-livewire.png' });
  await page.getByRole('button', { name: /^ATTEMPT LAVA GAP JUMP/ }).click();
  for (let i = 0; i < 24; i++) {
    await page.screenshot({ path: output + '/livewire/' + String(i).padStart(3, '0') + '.png' });
    await page.waitForTimeout(80);
  }
  const saved = await store.get(current.worldId);
  if (errors.length) throw Error('Page errors in documentation capture.');
  await writeFile(
    output + '/manifest.json',
    JSON.stringify(
      {
        design: 'figma-v2',
        source: 'Actual integrated app and disposable PostgreSQL simulation',
        nativeTwitch: false,
        nativeRaid: false,
        blueNosePlane: 'removed',
        arkFrames: 24,
        livewireFrames: 24,
        chapter: saved.state.chapter,
        missionStatus: saved.state.livewire?.stake?.status,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'Final-design footage captured; review before staging. No live world or provider action.',
  );
} finally {
  await browser.close();
  await app.close();
  await store.close();
  await admin.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.close();
}
