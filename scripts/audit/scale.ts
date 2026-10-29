import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { createWorld, applyCommand } from '@torchline/engine';
import { CURRENT_RULES_VERSION } from '@torchline/contracts';
import type { Actor, Command } from '@torchline/contracts';
import { createApp } from '../../apps/server/src/app.ts';
import { database } from '../../tests/helpers.ts';
import { tick } from '../../tests/twitch-provider.ts';

// Audit diagnostics only: refuse the live environment; helpers create disposable schemas.
if (process.env.WORLD_MODE !== 'simulation')
  throw new Error('Use the local simulation .env for isolated audit diagnostics.');
await mkdir('.local/audit-reproduction-2026-10-29', { recursive: true });

const host: Actor = { id: 'captain', role: 'host', community: 'captain' };
let s = createWorld('audit-scale', CURRENT_RULES_VERSION);
let serial = 0;
const act = (command: Command, actor: Actor = host) => {
  s = applyCommand(s, command, actor, {
    commandId: `audit-${serial++}`,
    at: '2026-10-29T05:00:00Z',
  }).state;
};
act({ type: 'start' });
act({ type: 'close-challenge' });
const blocks: { through: number; ms: number; snapshotBytes: number }[] = [];
const start = performance.now();
for (let block = 0; block < 10; block++) {
  const before = performance.now();
  for (let i = block * 1000; i < (block + 1) * 1000; i++)
    act({ type: 'vote', option: '1' }, { id: `viewer-${i}`, role: 'viewer', community: 'captain' });
  blocks.push({
    through: (block + 1) * 1000,
    ms: Math.round(performance.now() - before),
    snapshotBytes: Buffer.byteLength(JSON.stringify(s)),
  });
  if (performance.now() - start > 90000) break;
}
const result: Record<string, unknown> = {
  source: '7700316; local isolated audit; CPU microbenchmark, not deployed capacity',
  ballots: Object.keys(s.votes).length,
  blocks,
};
await database(async (store) => {
  const owner = await store.ensureCreator('sim-alpha', 'Audit', 'simulation');
  await store.create(owner);
  const app = await createApp(
    store,
    {
      mode: 'simulation',
      baseUrl: 'http://localhost:3193',
      sessionSecret: 'ab'.repeat(32),
      tokenKey: 'cd'.repeat(32),
      botSetupSecret: 'fixture',
    },
    { workers: false },
  );
  const controllers: AbortController[] = [];
  try {
    const address = await app.listen({ port: 3193, host: '127.0.0.1' });
    const login = await app.inject({
      method: 'POST',
      url: '/api/simulator/login',
      payload: { channel: 'alpha' },
      headers: { 'x-torchline-request': '1' },
    });
    const cookie = `torchline_sim_session=${login.cookies.find((c) => c.name === 'torchline_sim_session')!.value}`;
    for (let i = 0; i < 4; i++) {
      const controller = new AbortController();
      controllers.push(controller);
      const response = await fetch(address + '/api/live/events', {
        headers: { cookie },
        signal: controller.signal,
      });
      const reader = response.body!.getReader();
      void (async () => {
        try {
          while (!(await reader.read()).done) {}
        } catch {}
      })();
    }
    const original = store.pool.query.bind(store.pool);
    let queries = 0;
    store.pool.query = ((...args: unknown[]) => {
      queries++;
      return Reflect.apply(original, store.pool, args);
    }) as typeof store.pool.query;
    const begin = performance.now();
    for (let i = 0; i < 8; i++) {
      await tick(app);
      await new Promise((r) => setTimeout(r, 250));
    }
    result.idleFourFeeds = {
      ticks: 8,
      ms: Math.round(performance.now() - begin),
      poolQueries: queries,
      phase: 'ready',
      mutations: 0,
    };
    store.pool.query = original;
  } finally {
    for (const c of controllers) c.abort();
    await app.close();
  }
});
await writeFile(
  '.local/audit-reproduction-2026-10-29/scale.json',
  JSON.stringify(result, null, 2) + '\n',
);
console.log(JSON.stringify(result, null, 2));
