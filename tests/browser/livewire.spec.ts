import { test, expect } from '@playwright/test';
import { replayEvents } from '@torchline/engine';
import { serve, launch, navigate, snapshot, overlayLink } from './runtime.ts';
test('Voxel Survival LIVEWIRE persists a crew lock and one attested consequence across reload, history and OBS', async ({
  page,
  browser,
}) =>
  serve(async (store) => {
    test.setTimeout(120000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const overlay = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      reducedMotion: 'reduce',
    });
    try {
      await launch(page);
      const initial = await snapshot(page);
      const link = await overlayLink(page);
      await overlay.goto(link);
      await expect(overlay.locator('.dock--collapsed')).toBeVisible();
      expect(await overlay.getByRole('button').count()).toBe(0);
      await navigate(page, 'livewire');
      await expect(page.locator('.voxel-canvas')).toHaveAttribute('data-scene-ready', 'true', {
        timeout: 45000,
      });
      await page
        .getByRole('button', { name: 'Open mission · spend 1 supply', exact: true })
        .click();
      await page.locator('.practice-chat summary').click();
      await page.getByRole('button', { name: 'Send practice ballot', exact: true }).click();
      await expect(page.locator('[data-ballots=hull]')).toHaveText('1 votes');
      await page
        .getByRole('button', { name: 'Lock commitment · start attempt', exact: true })
        .click();
      await page.reload();
      await expect(page.locator('.livewire-world')).toHaveAttribute('data-stage', 'locked');
      await page.getByRole('button', { name: /^ATTEMPT LAVA GAP JUMP/ }).click();
      await expect(page.getByRole('button', { name: /^CONFIRM LOSS/ })).toBeVisible();
      await page.getByRole('button', { name: /^CONFIRM LOSS/ }).click();
      await page.getByRole('button', { name: 'WRITE CONSEQUENCE TO ARK', exact: true }).click();
      await expect(page.locator('.dock-consequence')).toContainText('FAILURE SAVED');
      await expect(overlay.locator('[data-livewire-resource=hull]')).toContainText(
        String(initial.resources.hull - 6),
      );
      await overlay.reload();
      await expect(overlay.locator('[data-livewire-resource=hull]')).toContainText(
        String(initial.resources.hull - 6),
      );
      const saved = await store.get(initial.worldId);
      expect(
        saved.events.filter((event) => event.command.type === 'livewire-resolve'),
      ).toHaveLength(1);
      expect(replayEvents(initial.worldId, saved.events)).toEqual(saved.state);
      expect(saved.state.resources.supplies).toBe(initial.resources.supplies - 1);
      await navigate(page, 'archive');
      await expect(page.locator('.timeline')).toContainText(/attested|LIVEWIRE|mission/i);
      await navigate(page, 'mission');
      await expect(page.locator('[data-system=hull]')).toHaveAttribute('data-condition', 'damaged');
      await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
      await expect.poll(async () => (await snapshot(page)).chapter).toBe(1);
      expect(errors).toEqual([]);
    } finally {
      await overlay.close();
      await page.goto('about:blank');
    }
  }));

test('each LIVEWIRE preset renders its own practice feed and a saved mission keeps its named game and scene', async ({
  page,
}) =>
  serve(async () => {
    test.setTimeout(120000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await launch(page);
      await navigate(page, 'livewire');
      await expect(page.locator('.game-hud--voxel')).toBeVisible();
      await page.locator('.controls-toggle').click();
      for (const [preset, hud] of [
        ['Car Soccer', 'rocket'],
        ['Souls Run', 'souls'],
      ] as const) {
        await page.getByRole('button', { name: new RegExp(`^${preset}`) }).click();
        await expect(page.locator(`.game-hud--${hud}`)).toBeVisible();
        await expect(page.locator('.voxel-canvas')).toHaveAttribute('data-scene-ready', 'true', {
          timeout: 45000,
        });
      }
      // The streamer names the game they really play; the preset only picks the scene.
      await page.getByLabel('Your game').fill('Elden Ring');
      await page
        .getByRole('button', { name: 'Open mission · spend 1 supply', exact: true })
        .click();
      await expect(page.locator('.livewire-world')).toHaveAttribute('data-stage', 'voting');
      // The saved mission, not the default preset, decides which feed a reload shows.
      await page.reload();
      await expect(page.locator('.game-hud--souls')).toBeVisible();
      await expect(page.locator('.game-feed-label')).toContainText('ELDEN RING / BOSS ATTEMPT');
      await expect(page.locator('.voxel-canvas')).toHaveAttribute('data-scene-ready', 'true', {
        timeout: 45000,
      });
      expect(errors).toEqual([]);
    } finally {
      await page.goto('about:blank');
    }
  }));
