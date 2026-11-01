import { test, expect } from '@playwright/test';
import { serve } from './runtime.ts';
test.use({ reducedMotion: 'reduce' });

test('the judge relay rehearsal moves one Ark between two practice communities in two games and traces every consequence', async ({
  page,
}) =>
  serve(async (store) => {
    test.setTimeout(process.env.CI ? 240000 : 120000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?screen=simulator');
    await expect(page.locator('.rehearsal-stage')).toHaveAttribute('data-step', '1');
    // Both channels are on screen from the start, each in its own game.
    await expect(page.locator('.relay-stream[data-side=alpha]')).toContainText('MINECRAFT');
    await expect(page.locator('.relay-stream[data-side=receiver]')).toContainText('ROCKET LEAGUE');
    await page.getByRole('button', { name: 'AUTOPLAY TO THE HANDOFF', exact: true }).click();
    // Alpha's Minecraft mission fails and the attested damage stays pinned to alpha's channel.
    await expect(page.locator('.relay-stream[data-side=alpha] .relay-result')).toContainText(
      'LAVA GAP JUMP · FAILURE',
      { timeout: 60000 },
    );
    // Autoplay stops at the dossier so a person reads it before the receiver acts.
    await expect(page.locator('.rehearsal-stage')).toHaveAttribute('data-step', '9', {
      timeout: 90000,
    });
    await expect(page.locator('.rehearsal-error')).toHaveCount(0);
    const dossier = page.locator('.rehearsal-stage .arrival-dossier');
    await expect(dossier).toContainText('Simulation alpha');
    await expect(dossier).toContainText('Sacrifice navigation');
    await expect(dossier).toContainText('Blind jump');
    await expect(dossier).toContainText('Created by Simulation alpha');
    // The dossier names what the other game did to the hull, and who attested it.
    await expect(dossier.locator('.dossier-missions')).toContainText('Minecraft');
    await expect(dossier.locator('.dossier-missions')).toContainText('LAVA GAP JUMP · failure');
    await expect(dossier.locator('.dossier-missions')).toContainText('Hull -6');

    // The saved world really moved: same Ark, new custodian, scars and debt preserved.
    const moved = (await store.pool.query("SELECT id FROM worlds WHERE custodian_id='sim-beta'"))
      .rows[0].id as string;
    const inherited = await store.get(moved);
    expect(inherited.state.chapter).toBe(1);
    const attested = inherited.events.filter((event) => event.command.type === 'livewire-resolve');
    expect(attested).toHaveLength(1);
    expect(attested[0]).toMatchObject({
      evidence: 'streamer_attested',
      chapter: 0,
      resourceDelta: { hull: -6 },
      actor: { community: 'sim-alpha' },
    });
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
    await expect(page.locator('.rehearsal-stage')).toHaveAttribute('data-step', '9');
    await expect(page.locator('.rehearsal-stage .arrival-dossier')).toBeVisible();

    // The receiver's own game repairs the hull alpha's game cracked, on the same Ark.
    await page.getByRole('button', { name: 'RUN STEP 9', exact: true }).click();
    await expect(page.locator('.rehearsal-stage')).toHaveAttribute('data-step', '10', {
      timeout: 30000,
    });
    await expect(page.locator('.relay-stream[data-side=receiver] .relay-result')).toContainText(
      'AERIAL GOAL · SUCCESS',
    );
    const repaired = await store.get(moved);
    const repair = repaired.events.at(-1)!;
    expect(repair).toMatchObject({
      evidence: 'streamer_attested',
      resourceDelta: { hull: 3 },
      actor: { community: 'sim-beta' },
    });
    expect(repaired.state.resources.hull).toBe(inherited.state.resources.hull + 3);

    await page.getByRole('button', { name: 'RUN STEP 10', exact: true }).click();
    await expect(page.locator('.rehearsal-stage')).toHaveAttribute('data-step', '11');
    const started = await store.get(moved);
    expect(started.state).toMatchObject({ chapter: 2, crisis: 'blind-jump' });
    // Alpha's crew repaired the shields, so Beta's blind arrival costs no hull.
    expect(started.state.resources.hull).toBe(repaired.state.resources.hull);
    expect(started.state.obligations[0].status).toBe('applied');

    await page.getByRole('button', { name: 'OPEN THE CHRONICLE', exact: true }).click();
    await expect(page.locator('.season-record')).toContainText('Simulation alpha');
    await expect(page.locator('.season-record')).toContainText('Simulation beta');
    await expect(page.locator('.lineage-custody')).toHaveCount(1);
    await expect(page.locator('.lineage-node[data-kind=decision]').first()).toContainText(
      'Sacrifice navigation',
    );
    // Both missions, one per community and game, appear in the lineage.
    await expect(page.locator('.lineage-node[data-kind=livewire]')).toHaveCount(2);
    await expect(page.locator('.lineage-edge').first()).toBeAttached();
    await page.locator('.lineage-node[data-kind=decision]').first().click();
    await expect(page.locator('.event-record')).toContainText('Sacrifice navigation');
    // The road not taken, replayed once from the saved state before the decision.
    await page.getByRole('button', { name: 'WHAT IF THEY HAD CHOSEN DIFFERENTLY?' }).click();
    const whatIf = page.locator('section.what-if');
    await expect(whatIf).toContainText('Recomputed choice matches the saved record');
    await expect(whatIf.locator('li[data-option=seal-habitat]')).toContainText('168');
    await expect(whatIf.locator('li[data-chosen=true]')).toContainText(
      'Leaves blind jump due ch.2',
    );

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
      await reader.locator('.lineage-node[data-kind=livewire]').first().click();
      await reader.getByRole('button', { name: 'WHAT IF THEY HAD CHOSEN DIFFERENTLY?' }).click();
      await expect(reader.locator('section.what-if')).toContainText('Minecraft · LAVA GAP JUMP');
      await expect(reader.locator('section.what-if li[data-option=success]')).toContainText(
        'NOT TAKEN',
      );
    } finally {
      await visitor.close();
    }
    expect(errors).toEqual([]);
    await page.goto('about:blank');
  }));
