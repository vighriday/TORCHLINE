import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { castLivewire } from '@torchline/storage';
import { tick as appTick } from '../twitch-provider.ts';
import { serve, launch, manual, navigate, snapshot, headers } from './runtime.ts';
test.use({ reducedMotion: 'reduce' });

async function holdRefresh(page: Page) {
  let release!: () => void,
    captured!: () => void,
    held = false;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const ready = new Promise<void>((resolve) => (captured = resolve));
  await page.route('**/api/state', async (route) => {
    if (held) return route.continue();
    held = true;
    const response = await route.fetch();
    captured();
    await gate;
    await route.fulfill({ response });
  });
  return { ready, release };
}

test('a delayed HTTP refresh cannot erase a newer persisted viewer clue delivered through SSE', async ({
  page,
}) =>
  serve(async (store, app) => {
    test.setTimeout(120000);
    await launch(page);
    await manual(page);
    await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
    const held = await holdRefresh(page);
    try {
      await page.getByRole('button', { name: 'Scan A', exact: true }).click();
      await held.ready;
      const before = await store.get((await snapshot(page)).worldId);
      await store.command(
        before.id,
        { id: 'viewer-two', role: 'viewer', community: 'sim-alpha' },
        'simulation',
        before.revision,
        crypto.randomUUID(),
        { type: 'scan', node: 'C' },
      );
      await appTick(app);
      await expect(page.locator('.clue-list .found')).toHaveCount(2);
      held.release();
      await expect(
        page.getByRole('button', { name: 'Close challenge', exact: true }),
      ).toBeEnabled();
      await expect(page.locator('.clue-list .found')).toHaveCount(2);
      await expect(page.locator('.mission')).toHaveAttribute(
        'data-version',
        String((await store.get(before.id)).revision),
      );
    } finally {
      held.release();
      await page.goto('about:blank');
    }
  }));

test('a delayed response cannot resurrect a parked Ark after the channel starts another world', async ({
  page,
}) =>
  serve(async (store, app) => {
    test.setTimeout(120000);
    await launch(page);
    const before = await snapshot(page);
    await page.locator('.episode-preparation summary').click();
    const held = await holdRefresh(page);
    try {
      await page.getByRole('button', { name: 'Save timing', exact: true }).click();
      await held.ready;
      await store.park('sim-alpha', before.worldId, false);
      const next = await store.create((await store.creator('sim-alpha'))!);
      await appTick(app);
      await expect(page.locator('.mission')).toHaveAttribute('data-world', next);
      held.release();
      await expect(
        page.getByRole('button', { name: 'Start chapter 1', exact: true }),
      ).toBeEnabled();
      await expect(page.locator('.mission')).toHaveAttribute('data-world', next);
      expect((await store.get(before.worldId)).state.version).toBe(0);
    } finally {
      held.release();
      await page.goto('about:blank');
    }
  }));

test('normalized mission ballots cannot roll back when world revision has not changed', async ({
  page,
}) =>
  serve(async (store, app) => {
    test.setTimeout(120000);
    await launch(page);
    await navigate(page, 'livewire');
    await page.getByRole('button', { name: 'Open mission · spend 1 supply', exact: true }).click();
    await expect(page.locator('.livewire-world')).toHaveAttribute('data-stage', 'voting');
    await page.locator('.practice-chat summary').click();
    const held = await holdRefresh(page);
    try {
      await page.getByRole('button', { name: 'Send practice ballot', exact: true }).click();
      await held.ready;
      const before = await snapshot(page);
      await castLivewire(store, {
        channel: 'sim-alpha',
        actor: 'second-viewer',
        target: 'oxygen',
        providerAt: new Date().toISOString(),
        deliveryId: crypto.randomUUID(),
        messageId: crypto.randomUUID(),
        mode: 'simulation',
        participantKey: 'ab'.repeat(32),
      });
      await appTick(app);
      await expect(page.locator('[data-ballots=oxygen]')).toHaveText('1 votes');
      held.release();
      await expect(
        page.getByRole('button', { name: 'Lock commitment · start attempt', exact: true }),
      ).toBeEnabled();
      await expect(page.locator('[data-ballots=oxygen]')).toHaveText('1 votes');
      expect((await store.get(before.worldId)).revision).toBe(before.worldVersion);
    } finally {
      held.release();
      await page.goto('about:blank');
    }
  }));

test('session revocation clears the cockpit and ignores a previously authorized delayed response', async ({
  page,
}) =>
  serve(async (_store, app) => {
    test.setTimeout(120000);
    await launch(page);
    await page.locator('.episode-preparation summary').click();
    const held = await holdRefresh(page);
    try {
      await page.getByRole('button', { name: 'Save timing', exact: true }).click();
      await held.ready;
      expect((await page.request.post('/auth/logout', { headers, data: {} })).ok()).toBe(true);
      await appTick(app);
      await expect(page.locator('.mission')).toHaveCount(0);
      held.release();
      await expect(page.getByRole('button', { name: 'LAUNCH THE ARK', exact: true })).toBeEnabled();
      await expect(page.locator('.mission')).toHaveCount(0);
    } finally {
      held.release();
      await page.goto('about:blank');
    }
  }));
