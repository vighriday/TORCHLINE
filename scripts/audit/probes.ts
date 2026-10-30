import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { database } from '../../tests/helpers.ts';
import { createApp } from '../../apps/server/src/app.ts';
import { authorize, liveConfig, providerFixture, tick } from '../../tests/twitch-provider.ts';

// Audit diagnostics only: refuse the live environment; helpers create disposable schemas.
if (process.env.WORLD_MODE !== 'simulation')
  throw new Error('Use the local simulation .env for isolated audit diagnostics.');
await mkdir('.local/audit-reproduction-2026-10-29', { recursive: true });

const results: Record<string, unknown> = {
  source: '7700316; isolated PostgreSQL and synthetic provider, no live mutations',
};
await database(async (store) => {
  const provider = providerFixture();
  const app = await createApp(store, liveConfig, { fetcher: provider.fetcher, workers: false });
  provider.attach(app);
  try {
    await authorize(app, '99', true);
    const { headers } = await authorize(app, '42');
    const reconciled = await app.inject({
      method: 'POST',
      url: '/api/twitch/reconcile',
      payload: {},
      headers,
    });
    const creator = (await store.creator('42'))!;
    const id = await store.create(creator);
    await store.command(
      id,
      { id: '42', role: 'host', community: '42' },
      'live',
      (await store.get(id)).revision,
      randomUUID(),
      { type: 'start' },
    );
    const before = (await store.get(id)).state.phase;
    const sub = provider.subscriptions.find((s) => s.type === 'channel.chat.message')!;
    sub.status = 'authorization_revoked';
    const revoked = await provider.deliver(sub, undefined, randomUUID(), 'revocation');
    const after = (await store.get(id)).state.phase;
    await store.pool.query(
      "UPDATE episode_clocks SET deadline_at=clock_timestamp()-interval '1 second' WHERE world_id=$1",
      [id],
    );
    await tick(app);
    results.subscriptionLoss = {
      reconciliation: reconciled.statusCode,
      revocation: revoked.statusCode,
      before,
      after,
      afterExpiredTick: (await store.get(id)).state.phase,
      subscriptionStatus: (
        await store.pool.query('SELECT status FROM subscriptions WHERE id=$1', [sub.id])
      ).rows[0].status,
    };
    await store.pool.query(
      "UPDATE oauth_grants SET validated_at=clock_timestamp()-interval '2 hours' WHERE id='42'",
    );
    const disconnected = await app.inject({
      method: 'POST',
      url: '/api/twitch/disconnect',
      payload: {},
      headers,
    });
    results.staleGrantDisconnect = {
      http: disconnected.statusCode,
      response: disconnected.json(),
      connected: (await store.creator('42'))?.connected,
      grantStillPresent: !!(await store.pool.query("SELECT 1 FROM oauth_grants WHERE id='42'"))
        .rowCount,
    };
  } finally {
    await app.close();
  }
});
await database(async (store) => {
  const baseUrl = 'http://localhost:3192';
  const app = await createApp(
    store,
    {
      mode: 'simulation',
      baseUrl,
      sessionSecret: 'ab'.repeat(32),
      tokenKey: 'cd'.repeat(32),
      botSetupSecret: 'fixture',
    },
    { workers: false },
  );
  const creator = await store.ensureCreator('sim-alpha', 'Audit', 'simulation');
  const id = await store.create(creator);
  process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.local/browsers');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await app.listen({ port: 3192, host: '127.0.0.1' });
    const login = await app.inject({
      method: 'POST',
      url: '/api/simulator/login',
      payload: { channel: 'alpha' },
      headers: { 'x-torchline-request': '1' },
    });
    const grant = await app.inject({
      method: 'POST',
      url: '/api/overlay-grant',
      payload: {},
      headers: {
        'x-torchline-request': '1',
        cookie: `torchline_sim_session=${login.cookies.find((c) => c.name === 'torchline_sim_session')!.value}`,
      },
    });
    results.overlayGrantHttp = grant.statusCode;
    const url = grant.json().url;
    let feeds = 0;
    page.on('request', (req) => {
      if (req.url().endsWith('/events')) feeds++;
    });
    await page.goto(url);
    await page.locator('.mission').waitFor();
    const original = store.active.bind(store);
    let injected = 0;
    store.active = async (...args: Parameters<typeof store.active>) => {
      injected++;
      throw new Error('audit transient connection loss');
    };
    await tick(app);
    store.active = original;
    await page.waitForTimeout(500);
    const afterFailure = await page.locator('body').innerText();
    for (let i = 0; i < 4; i++) {
      await tick(app);
      await page.waitForTimeout(400);
    }
    results.overlayTransient = {
      injected,
      feeds,
      afterFailure,
      afterRecovery: await page.locator('body').innerText(),
      savedWorldUnchanged: (await store.get(id)).state.version === 0,
    };
  } finally {
    await page.close();
    await browser.close();
    await app.close();
  }
});
await writeFile(
  '.local/audit-reproduction-2026-10-29/probes.json',
  JSON.stringify(results, null, 2) + '\n',
);
console.log(JSON.stringify(results, null, 2));
