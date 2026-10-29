import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { configureEpisode } from '@torchline/storage';
import { database } from '../../tests/helpers.ts';
import { createApp } from '../../apps/server/src/app.ts';
import { providerFixture, liveConfig, authorize, tick } from '../../tests/twitch-provider.ts';

// Audit diagnostics only: refuse the live environment; helpers create disposable schemas.
if (process.env.WORLD_MODE !== 'simulation')
  throw new Error('Use the local simulation .env for isolated audit diagnostics.');
await mkdir('.local/audit-reproduction-2026-10-29', { recursive: true });

await database(async (store) => {
  const provider = providerFixture();
  const app = await createApp(store, liveConfig, { fetcher: provider.fetcher, workers: false });
  provider.attach(app);
  try {
    await authorize(app, '99', true);
    const { headers } = await authorize(app, '42');
    await app.inject({ method: 'POST', url: '/api/twitch/reconcile', payload: {}, headers });
    const owner = (await store.creator('42'))!;
    const id = await store.create(owner);
    await configureEpisode(store, owner, id, {
      investigation: null,
      challenge: null,
      allocation: null,
      decision: null,
    });
    for (const command of [{ type: 'start' }, { type: 'close-challenge' }] as const)
      await store.command(
        id,
        { id: '42', role: 'host', community: '42' },
        'live',
        (await store.get(id, true)).revision,
        randomUUID(),
        command,
      );
    const sub = provider.subscriptions.find((s) => s.type === 'channel.chat.message')!;
    const times: number[] = [];
    const codes: Record<number, number> = {};
    const start = performance.now();
    await Promise.all(
      Array.from({ length: 500 }, async (_, i) => {
        const at = performance.now();
        const r = await provider.deliver(sub, {
          broadcaster_user_id: '42',
          chatter_user_id: `viewer-${i}`,
          message_id: randomUUID(),
          message: { text: '!vote 1' },
        });
        times.push(performance.now() - at);
        codes[r.statusCode] = (codes[r.statusCode] ?? 0) + 1;
      }),
    );
    times.sort((a, b) => a - b);
    const before = (
      await store.pool.query(
        'SELECT count(*) FILTER(WHERE processed_at IS NULL)::integer AS pending,count(*) FILTER(WHERE error IS NOT NULL)::integer AS rejected FROM eventsub_inbox',
      )
    ).rows[0];
    const drainAt = performance.now();
    for (let i = 0; i < 10; i++) await tick(app);
    const result = {
      source:
        '7700316; synthetic signed provider via app.inject and real isolated PostgreSQL; one 500-message concurrent burst, no live capacity claim',
      totalMs: Math.round(performance.now() - start),
      ackMs: {
        p50: Math.round(times[250]),
        p95: Math.round(times[475]),
        max: Math.round(times[499]),
      },
      codes,
      beforeDrain: before,
      drainMs: Math.round(performance.now() - drainAt),
      uniqueVotes: Object.keys((await store.get(id, true)).state.votes).length,
      afterPending: (
        await store.pool.query(
          'SELECT count(*)::integer AS pending FROM eventsub_inbox WHERE processed_at IS NULL',
        )
      ).rows[0].pending,
    };
    await writeFile(
      '.local/audit-reproduction-2026-10-29/ingress.json',
      JSON.stringify(result, null, 2) + '\n',
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
});
