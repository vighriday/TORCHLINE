import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { Store } from '@torchline/storage';
import { createApp } from '../../apps/server/src/app.ts';
import { randomUUID } from 'node:crypto';

let store: Store;
let admin: Store;
let schema: string;
let app: Awaited<ReturnType<typeof createApp>>;
test.beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error('Run pnpm db:up first.');
  admin = new Store(process.env.DATABASE_URL);
  schema = `browser_${randomUUID().replaceAll('-', '')}`;
  await admin.pool.query(`CREATE SCHEMA "${schema}"`);
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('options', `-c search_path=${schema}`);
  store = new Store(url.toString());
  await store.migrate();
  app = await createApp(store, {
    mode: 'simulation',
    baseUrl: 'http://localhost:3100',
    sessionSecret: 'ab'.repeat(32),
    tokenKey: 'cd'.repeat(32),
    botSetupSecret: 'fixture-only',
  });
  await app.listen({ port: 3100, host: '127.0.0.1' });
  await mkdir('.local/screenshots', { recursive: true });
});
test.afterAll(async ({ browser }) => {
  await Promise.allSettled(browser.contexts().map((context) => context.close()));
  if (app) await app.close();
  if (store) await store.close();
  if (admin) {
    await admin.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.close();
  }
});

test('cooperative play, save/reload, read-only overlay and consented simulated custody transfer', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Use simulation alpha' }).click();
  await page.getByRole('button', { name: 'Create an Ark' }).click();
  await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
  await expect(page.locator('[data-resource=hull]')).toHaveText('70');
  await page.getByRole('textbox', { name: 'Chat command' }).fill('!scan A');
  await page.getByRole('button', { name: 'Send simulated input' }).click();
  await expect(page.getByText('A · Discovered', { exact: true })).toBeVisible();
  await page.getByLabel('Participant alias').fill('crew-two');
  await page.getByRole('textbox', { name: 'Chat command' }).fill('!scan C');
  await page.getByRole('button', { name: 'Send simulated input' }).click();
  await expect(page.getByText('C · Discovered', { exact: true })).toBeVisible();
  await page.getByLabel('Candidate route').fill('S A C T');
  await page.getByRole('button', { name: 'Submit route' }).click();
  await expect(page.locator('[data-resource=hull]')).toHaveText('85');
  await expect(page.locator('[data-system=shields]')).toHaveAttribute('data-condition', 'repaired');
  await page.getByRole('button', { name: 'Open final decision' }).click();
  await page.getByRole('button', { name: 'Commit Sacrifice navigation', exact: true }).click();
  await expect(page.locator('[data-resource=navigation]')).toHaveText('0');
  await expect(page.locator('[data-system=navigation]')).toHaveAttribute(
    'data-condition',
    'destroyed',
  );
  await page.reload();
  await expect(page.locator('[data-system=navigation]')).toHaveAttribute(
    'data-condition',
    'destroyed',
  );
  await page.screenshot({ path: '.local/screenshots/vertical-slice.png', fullPage: true });
  await page.getByRole('button', { name: 'Generate / rotate OBS link' }).click();
  const [overlay] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('link', { name: 'Open read-only overlay' }).click(),
  ]);
  await expect(overlay.locator('[data-system=navigation]')).toHaveAttribute(
    'data-condition',
    'destroyed',
  );
  await expect(overlay.getByRole('button')).toHaveCount(0);
  const targetContext = await browser.newContext();
  const target = await targetContext.newPage();
  await target.goto('/');
  await target.getByRole('button', { name: 'Use simulation beta' }).click();
  await target.getByLabel('Accept incoming world offers').check();
  await page.getByRole('button', { name: 'Prepare handoff', exact: true }).click();
  await page.getByRole('button', { name: 'Inject simulated raid evidence' }).click();
  await target.getByRole('button', { name: 'Accept inherited Ark' }).click();
  await expect(target.locator('[data-system=navigation]')).toHaveAttribute(
    'data-condition',
    'destroyed',
  );
  await expect(target.locator('[data-system=shields]')).toHaveAttribute(
    'data-condition',
    'repaired',
  );
  await expect(target.locator('[data-resource=hull]')).toHaveText('80');
  await expect(overlay.getByRole('heading', { name: 'No active Ark' })).toBeVisible();
  await target.getByRole('button', { name: 'Start chapter 2', exact: true }).click();
  await expect(target.locator('[data-resource=hull]')).toHaveText('80');
  await expect(target.getByRole('heading', { name: 'The Blind Jump', exact: true })).toBeVisible();
  await target.screenshot({ path: '.local/screenshots/inherited-ark.png', fullPage: true });
  expect(errors).toEqual([]);
  await overlay.close();
  await targetContext.close();
});

test('mobile reference layout has no horizontal overflow and supports solo play', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Use simulation gamma' }).click();
  await page.getByRole('button', { name: 'Create an Ark' }).click();
  await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Radiation Storm', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/screenshots/mobile-reference.png', fullPage: true });
});
