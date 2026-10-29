// Records an isolated saved simulation. Never uses creator/bot grants or the live store.
import { chromium } from '@playwright/test';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { database } from '../../tests/helpers.ts';
import { createApp } from '../../apps/server/src/app.ts';
import { configureEpisode } from '@torchline/storage';
import { getPuzzle } from '@torchline/engine';
process.env.PLAYWRIGHT_BROWSERS_PATH = '.local/browsers';
await mkdir('.local/game-review/video', { recursive: true });
await database(async (store) => {
  const creator = await store.ensureCreator('sim-alpha', 'Simulation alpha', 'simulation'),
    id = await store.create(creator);
  await configureEpisode(store, creator, id, {
    investigation: null,
    challenge: null,
    allocation: null,
    decision: null,
  });
  const app = await createApp(
    store,
    {
      mode: 'simulation',
      baseUrl: 'http://localhost:3102',
      sessionSecret: 'ab'.repeat(32),
      tokenKey: 'cd'.repeat(32),
      botSetupSecret: 'fixture',
    },
    { workers: false },
  );
  await app.listen({ host: '127.0.0.1', port: 3102 });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: '.local/game-review/video', size: { width: 1280, height: 800 } },
  });
  const recordedAt = performance.now();
  const elapsed = () => (performance.now() - recordedAt) / 1000;
  const ranges: number[][] = [];
  const page = await context.newPage();
  const video = page.video()!;
  const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
  try {
    await page.goto('http://localhost:3102');
    await page.getByRole('button', { name: 'Launch the Ark' }).click();
    await page.getByRole('button', { name: 'Start chapter 1', exact: true }).waitFor();
    await page.locator('.scene-ready canvas').waitFor({ timeout: 45000 });
    await page.getByRole('button', { name: 'Start chapter 1', exact: true }).click();
    await page.locator('.phase-challenge').waitFor();
    await pause(4600);
    const challengeStart = elapsed();
    await page.screenshot({ path: '.local/game-review/encounter-challenge.png' });
    for (const node of ['A', 'B', 'C', 'D']) {
      await page.getByRole('button', { name: `Scan relay ${node}`, exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.getByText(`${node} · Discovered`, { exact: true }).waitFor();
      await pause(650);
    }
    const graph = getPuzzle((await store.get(id)).state)!;
    function path(nodes: string[], cost: number): string[] | undefined {
      const at = nodes.at(-1)!;
      if (at === 'T') return nodes.includes(graph.requiredNode!) ? nodes : undefined;
      for (const edge of graph.edges) {
        const to = edge.from === at ? edge.to : edge.to === at ? edge.from : null;
        if (
          !to ||
          nodes.includes(to) ||
          to === graph.blockedNode ||
          cost + edge.cost > graph.budget
        )
          continue;
        const found = path([...nodes, to], cost + edge.cost);
        if (found) return found;
      }
    }
    const route = path(['S'], 0);
    if (!route) throw new Error('Authored route fixture has no solution');
    await page.locator('.route-tools > summary').click();
    await page.getByRole('textbox', { name: 'Candidate route' }).fill(route.join(' '));
    await page.getByRole('button', { name: 'Submit route', exact: true }).click();
    await page.getByText('Solved · reward persisted', { exact: true }).waitFor();
    await pause(1900);
    ranges.push([challengeStart, elapsed()]);
    await page.getByRole('button', { name: 'Open final decision', exact: true }).click();
    await page.locator('.phase-decision').waitFor();
    const decisionStart = elapsed();
    await pause(1800);
    ranges.push([decisionStart, elapsed()]);
    await page.screenshot({ path: '.local/game-review/encounter-decision.png' });
    await page.getByRole('button', { name: 'Commit Sacrifice navigation', exact: true }).click();
    await page.getByRole('button', { name: 'Start chapter 2', exact: true }).waitFor();
    await pause(2200);
    await page.getByRole('button', { name: 'Start chapter 2', exact: true }).click();
    await page.locator('.chapter-2').waitFor();
    await pause(1500);
    const chapterTwoStart = elapsed();
    await pause(3200);
    ranges.push([chapterTwoStart, elapsed()]);
    await page.screenshot({ path: '.local/game-review/encounter-chapter-two.png' });
    await writeFile(
      '.local/game-review/capture-timing.json',
      JSON.stringify({ source: 'Actual isolated simulation', ranges }, null, 2) + '\n',
    );
    console.log(
      JSON.stringify({
        simulationOnly: true,
        worldPersisted: true,
        chapter: (await store.get(id)).state.chapter,
        frames: await page.locator('.ark-canvas').getAttribute('data-frames'),
        fps: await page.locator('.ark-canvas').getAttribute('data-fps'),
        pixelRatio: await page.locator('.ark-canvas').getAttribute('data-pixel-ratio'),
      }),
    );
  } finally {
    await context.close();
    await rename(await video.path(), resolve('.local/game-review/encounter-demo.webm'));
    await browser.close();
    await app.close();
  }
});
