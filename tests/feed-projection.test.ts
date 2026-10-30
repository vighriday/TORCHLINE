import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/server/src/app.ts';
import type { AppConfig } from '../apps/server/src/app.ts';
import { database } from './helpers.ts';
import { tick } from './twitch-provider.ts';

const config: AppConfig = {
  mode: 'simulation',
  baseUrl: 'http://localhost:3000',
  sessionSecret: 'ab'.repeat(32),
  tokenKey: 'cd'.repeat(32),
  botSetupSecret: 'fixture',
};
const header = { 'x-torchline-request': '1' };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Frame {
  event: string;
  data: string;
}
/** Reads server-sent frames so a test can assert what was published, not only what was stored. */
function collect(response: Response) {
  const frames: Frame[] = [];
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const finished = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let split: number;
        while ((split = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          if (chunk.startsWith(':')) continue;
          frames.push({
            event: /^event: (.+)$/m.exec(chunk)?.[1] ?? 'message',
            data: /^data: (.*)$/m.exec(chunk)?.[1] ?? '',
          });
        }
      }
    } catch {
      /* The reader is aborted when the feed or the test ends. */
    }
  })();
  return {
    frames,
    finished,
    snapshots: () => frames.filter((frame) => frame.event === 'snapshot'),
  };
}

it('serves every view of one channel from a single projection and stops republishing an unchanged world', () =>
  database(async (store) => {
    const app = await createApp(store, config, { workers: false });
    const controllers: AbortController[] = [];
    try {
      const address = await app.listen({ port: 0, host: '127.0.0.1' });
      const login = await fetch(address + '/api/simulator/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...header },
        body: JSON.stringify({ channel: 'alpha' }),
      });
      expect(login.status).toBe(200);
      const cookie = login.headers.get('set-cookie')!.split(';')[0];
      const creator = (await store.creator('sim-alpha'))!;
      const worldId = await store.create(creator);
      const open = async () => {
        const abort = new AbortController();
        controllers.push(abort);
        const response = await fetch(address + '/api/live/events', {
          headers: { cookie },
          signal: abort.signal,
        });
        expect(response.status).toBe(200);
        return collect(response);
      };
      const countQueries = async (ticks: number) => {
        const original = store.pool.query.bind(store.pool);
        let queries = 0;
        store.pool.query = ((...args: unknown[]) => {
          queries++;
          return Reflect.apply(original, store.pool, args);
        }) as typeof store.pool.query;
        try {
          for (let i = 0; i < ticks; i++) {
            await tick(app);
            await wait(250);
          }
        } finally {
          store.pool.query = original;
        }
        return queries;
      };

      const first = await open();
      await expect.poll(() => first.snapshots().length).toBe(1);
      const single = await countQueries(6);
      const extra = [await open(), await open(), await open()];
      await expect.poll(() => extra.every((feed) => feed.snapshots().length === 1)).toBe(true);

      // Three further views of the same channel must not multiply projection work. Each view only
      // rechecks its own authority, so the extra cost is bounded per view and not per projection.
      const shared = await countQueries(6);
      expect(shared - single).toBeLessThanOrEqual(3 * 6 * 2);

      // An unchanged world publishes nothing further: no repeated snapshot rewrites.
      const published = [first, ...extra].map((feed) => feed.snapshots().length);
      await countQueries(8);
      expect([first, ...extra].map((feed) => feed.snapshots().length)).toEqual(published);

      // A real change still reaches every view of the channel.
      const started = await fetch(address + `/api/worlds/${worldId}/commands`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, ...header },
        body: JSON.stringify({
          command: { type: 'start' },
          expectedVersion: 0,
          commandId: randomUUID(),
        }),
      });
      expect(started.status).toBe(200);
      await tick(app);
      await expect.poll(() => extra.every((feed) => feed.snapshots().length === 2)).toBe(true);
      expect(JSON.parse(extra[0].snapshots()[1].data).world.phase).not.toBe('ready');

      // Sharing a projection never shares authority: a revoked view ends while the others continue.
      await store.pool.query('DELETE FROM sessions WHERE channel_id=$1', [creator.id]);
      await tick(app);
      await expect
        .poll(() => [first, ...extra].map((feed) => feed.frames.at(-1)?.event))
        .toEqual(['unavailable', 'unavailable', 'unavailable', 'unavailable']);
      expect((await store.get(worldId)).state.phase).not.toBe('ready');
    } finally {
      for (const controller of controllers) controller.abort();
      await app.close();
    }
  }));

it('keeps a running phase clock exact without rewriting the world snapshot', () =>
  database(async (store) => {
    const app = await createApp(store, config, { workers: false });
    const controllers: AbortController[] = [];
    try {
      const address = await app.listen({ port: 0, host: '127.0.0.1' });
      const login = await fetch(address + '/api/simulator/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...header },
        body: JSON.stringify({ channel: 'alpha' }),
      });
      const cookie = login.headers.get('set-cookie')!.split(';')[0];
      const creator = (await store.creator('sim-alpha'))!;
      const worldId = await store.create(creator);
      const timing = await fetch(address + `/api/worlds/${worldId}/timing`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, ...header },
        body: JSON.stringify({
          investigation: 900,
          challenge: 900,
          allocation: 900,
          decision: 900,
        }),
      });
      expect(timing.status).toBe(200);
      const started = await fetch(address + `/api/worlds/${worldId}/commands`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, ...header },
        body: JSON.stringify({
          command: { type: 'start' },
          expectedVersion: 1,
          commandId: randomUUID(),
        }),
      });
      expect(started.status).toBe(200);
      const abort = new AbortController();
      controllers.push(abort);
      const response = await fetch(address + '/api/live/events', {
        headers: { cookie },
        signal: abort.signal,
      });
      const feed = collect(response);
      await expect.poll(() => feed.snapshots().length).toBe(1);
      const deadline = Date.parse(JSON.parse(feed.snapshots()[0].data).world.clock.deadlineAt);
      expect(deadline).toBeGreaterThan(Date.now());

      // Five seconds of ticks: the clock is resynchronised, the unchanged world is not rewritten.
      for (let i = 0; i < 20; i++) {
        await tick(app);
        await wait(250);
      }
      expect(feed.snapshots()).toHaveLength(1);
      const clocks = feed.frames.filter((frame) => frame.event === 'clock');
      expect(clocks.length).toBeGreaterThan(0);
      for (const frame of clocks) {
        const serverAt = Date.parse(JSON.parse(frame.data).serverAt);
        expect(Number.isFinite(serverAt)).toBe(true);
        expect(serverAt).toBeGreaterThan(deadline - 900_000);
      }
    } finally {
      for (const controller of controllers) controller.abort();
      await app.close();
    }
  }));
