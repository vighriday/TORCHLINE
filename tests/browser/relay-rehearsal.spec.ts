import { test, expect } from '@playwright/test';
import { serve } from './runtime.ts';
test.use({ reducedMotion: 'reduce' });

test('the judge relay rehearsal moves one Ark between two practice communities and traces the consequence', async ({
  page,
}) =>
  serve(async (store) => {
    test.setTimeout(process.env.CI ? 240000 : 120000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?screen=simulator');
    await expect(page.locator('.rehearsal-stage')).toHaveAttribute('data-step', '1');
    await page.getByRole('button', { name: 'AUTOPLAY TO THE HANDOFF', exact: true }).click();
    // Autoplay stops at the dossier so a person reads it before the next chapter applies it.
    await expect(page.locator('.rehearsal-stage')).toHaveAttribute('data-step', '8', {
      timeout: 60000,
    });
    await expect(page.locator('.rehearsal-error')).toHaveCount(0);
    const dossier = page.locator('.rehearsal-stage .arrival-dossier');
    await expect(dossier).toContainText('Simulation alpha');
    await expect(dossier).toContainText('Sacrifice navigation');
    await expect(dossier).toContainText('Blind jump');
    await expect(dossier).toContainText('Created by Simulation alpha');

    // The saved world really moved: same Ark, new custodian, scars and debt preserved.
    const moved = (await store.pool.query("SELECT id FROM worlds WHERE custodian_id='sim-beta'"))
      .rows[0].id as string;
    const inherited = await store.get(moved);
    expect(inherited.state.chapter).toBe(1);
    expect(inherited.state.systems.navigation.condition).toBe('destroyed');
    expect(inherited.state.systems.shields.condition).toBe('repaired');
    expect(inherited.state.obligations).toEqual([
      expect.objectContaining({ kind: 'blind-jump', dueChapter: 2, status: 'pending' }),
    ]);
    const custody = await store.pool.query(
      "SELECT mode FROM custody_events WHERE world_id=$1 AND source_id='sim-alpha' AND target_id='sim-beta'",
      [moved],
    );
    expect(custody.rows).toEqual([{ mode: 'simulation' }]);

    // Progress survives a reload; the dossier is still pending the receiver's first command.
    await page.reload();
    await expect(page.locator('.rehearsal-stage')).toHaveAttribute('data-step', '8');
    await expect(page.locator('.rehearsal-stage .arrival-dossier')).toBeVisible();

    await page.getByRole('button', { name: 'RUN STEP 8', exact: true }).click();
    await expect(page.locator('.rehearsal-stage')).toHaveAttribute('data-step', '9');
    const started = await store.get(moved);
    expect(started.state).toMatchObject({ chapter: 2, crisis: 'blind-jump' });
    // Alpha's crew repaired the shields, so Beta's blind arrival costs no hull.
    expect(started.state.resources.hull).toBe(inherited.state.resources.hull);
    expect(started.state.obligations[0].status).toBe('applied');

    await page.getByRole('button', { name: 'OPEN THE CHRONICLE', exact: true }).click();
    await expect(page.locator('.season-record')).toContainText('Simulation alpha');
    await expect(page.locator('.season-record')).toContainText('Simulation beta');
    await expect(page.locator('.lineage-custody')).toHaveCount(1);
    await expect(page.locator('.lineage-node[data-kind=decision]').first()).toContainText(
      'Sacrifice navigation',
    );
    await expect(page.locator('.lineage-edge').first()).toBeAttached();
    await page.locator('.lineage-node[data-kind=decision]').first().click();
    await expect(page.locator('.event-record')).toContainText('Sacrifice navigation');

    // The receiver publishes a read-only link; a browser with no session can follow the Ark.
    await page.getByRole('button', { name: /Share public Chronicle/ }).click();
    const link = await page.getByLabel('Public Chronicle link').inputValue();
    expect(link).toMatch(/\/chronicle\/#[a-f\d]{64}$/);
    const visitor = await page.context().browser()!.newContext();
    try {
      const reader = await visitor.newPage();
      await reader.goto(link);
      await expect(reader.locator('.season-record')).toContainText('Simulation alpha');
      await expect(reader.locator('.lineage-custody')).toHaveCount(1);
      await expect(reader.locator('.public-chronicle-custody')).toContainText(
        'Simulation alpha → Simulation beta',
      );
      await expect(reader.getByRole('button', { name: /Commit|Start chapter/ })).toHaveCount(0);
    } finally {
      await visitor.close();
    }
    expect(errors).toEqual([]);
    await page.goto('about:blank');
  }));
