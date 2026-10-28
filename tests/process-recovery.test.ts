import { it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { database } from './helpers.ts';

it(
  'recovers persisted gameplay and worker ownership after an actual process kill and replacement',
  () =>
    database(async (store, url) => {
      const reservation = createServer();
      await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve));
      const port = (reservation.address() as { port: number }).port;
      await new Promise<void>((resolve, reject) =>
        reservation.close((error) => (error ? reject(error) : resolve())),
      );
      const children: ReturnType<typeof spawn>[] = [];
      const spawnServer = () => {
        const env = Object.fromEntries(
          Object.entries(process.env).filter(([key]) =>
            /^(PATH|SystemRoot|WINDIR|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|USERNAME|USERDOMAIN|SYSTEMDRIVE)$/i.test(
              key,
            ),
          ),
        );
        const child = spawn(process.execPath, ['apps/server/src/main.ts'], {
          windowsHide: true,
          stdio: 'ignore',
          env: {
            ...env,
            NODE_ENV: 'test',
            WORLD_MODE: 'simulation',
            DATABASE_URL: url,
            SESSION_SECRET: 'ab'.repeat(32),
            TOKEN_ENCRYPTION_KEY: 'cd'.repeat(32),
            BOT_SETUP_SECRET: 'ef'.repeat(32),
            PUBLIC_BASE_URL: 'http://localhost:' + port,
            PORT: String(port),
          },
        });
        children.push(child);
        const exited = new Promise<{ code: number | null; signal: string | null }>(
          (resolve, reject) => {
            child.once('exit', (code, signal) => resolve({ code, signal }));
            child.once('error', reject);
          },
        );
        return { child, exited };
      };
      const stop = async (server: ReturnType<typeof spawnServer>, signal: NodeJS.Signals) => {
        server.child.kill(signal);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            server.exited,
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () =>
                  reject(
                    new Error(
                      `Server failed to exit after ${signal}; shutdown must release the worker lease before closing the pool.`,
                    ),
                  ),
                8000,
              );
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      };
      const ready = () =>
        expect
          .poll(
            async () => {
              try {
                return (
                  await fetch(`http://127.0.0.1:${port}/health/ready`, {
                    signal: AbortSignal.timeout(1000),
                  })
                ).status;
              } catch {
                return 0;
              }
            },
            { timeout: 12000 },
          )
          .toBe(200);
      try {
        const first = spawnServer();
        await ready();
        const owner = await store.ensureCreator('process-owner', 'Process fixture', 'simulation'),
          id = await store.create(owner);
        for (const command of [
          { type: 'start' },
          { type: 'close-challenge' },
          { type: 'commit', option: 'burn-navigation' },
          { type: 'start' },
        ] as const)
          await store.command(
            id,
            { id: owner.id, role: 'host', community: owner.id },
            'simulation',
            (await store.get(id)).revision,
            randomUUID(),
            command,
          );
        const before = (await store.get(id)).state;
        expect(before.chapter).toBe(2);
        await stop(first, 'SIGKILL');
        const replacement = spawnServer();
        await ready();
        await expect.poll(async () => (await store.get(id)).state.phase).toBe('paused');
        const restored = await store.get(id);
        expect(restored.state.systems).toEqual(before.systems);
        expect(restored.state.resources).toEqual(before.resources);
        expect(restored.clock?.recovery_reason).toContain('restart');
        const revision = restored.revision;
        const exit = await stop(replacement, 'SIGTERM');
        // Windows TerminateProcess cannot deliver POSIX SIGTERM. Linux CI asserts graceful exit.
        if (process.platform !== 'win32') expect(exit).toEqual({ code: 0, signal: null });
        const again = spawnServer();
        await ready();
        expect((await store.get(id)).revision).toBe(revision);
        await stop(again, 'SIGTERM');
      } finally {
        await Promise.all(
          children.map(
            (child) =>
              new Promise<void>((resolve) => {
                if (child.exitCode !== null || child.signalCode !== null) return resolve();
                child.once('exit', () => resolve());
                child.kill('SIGKILL');
              }),
          ),
        );
      }
    }),
  45000,
);
