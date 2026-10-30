import { it, expect } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { Store, mutateLivewire, castLivewire } from '@torchline/storage';
import { database } from './helpers.ts';
import { createBackup, restoreBackup, restoreDrill } from '../scripts/lib/backup.ts';

it(
  'authenticates encrypted backups, restores exact state/replay into scratch, and refuses corrupt or nonempty targets',
  () =>
    database(async (admin, adminUrl) => {
      // A real deployment uses public; template0 already has that schema. A custom
      // test search_path alone would miss pg_restore's CREATE SCHEMA collision.
      const sourceName = 'torchline_backup_' + randomUUID().replaceAll('-', '');
      await admin.pool.query(`CREATE DATABASE "${sourceName}" TEMPLATE template0`);
      const sourceUrl = new URL(adminUrl);
      sourceUrl.pathname = '/' + sourceName;
      sourceUrl.searchParams.delete('options');
      const url = sourceUrl.toString(),
        store = new Store(url);
      try {
        await store.migrate();
        const owner = await store.ensureCreator(
          'backup-owner',
          'PRIVATE_BACKUP_SENTINEL',
          'simulation',
        );
        const id = await store.create(owner);
        for (const command of [
          { type: 'start' },
          { type: 'scan', node: 'A' },
          { type: 'close-challenge' },
          { type: 'commit', option: 'burn-navigation' },
        ] as const)
          await store.command(
            id,
            { id: owner.id, role: 'host', community: owner.id },
            'simulation',
            (await store.get(id)).revision,
            randomUUID(),
            command,
          );
        const mission = async (action: Parameters<typeof mutateLivewire>[3]['action']) =>
          mutateLivewire(
            store,
            owner,
            id,
            { expectedVersion: (await store.get(id)).revision, commandId: randomUUID(), action },
            true,
          );
        await mission({ type: 'open', preset: 'match', game: 'A game', label: 'Backup mission' });
        const stakeId = (await store.get(id)).state.livewire!.stake.id;
        await castLivewire(store, {
          channel: owner.id,
          actor: 'fixture-viewer',
          target: 'hull',
          providerAt: new Date().toISOString(),
          deliveryId: randomUUID(),
          messageId: randomUUID(),
          mode: 'simulation',
          participantKey: 'backup-fixture-key',
        });
        await mission({ type: 'lock', stakeId });
        await mission({ type: 'resolve', stakeId, outcome: 'failure' });
        const before = (await store.get(id)).state,
          key = randomBytes(32).toString('hex'),
          path = `.local/backups/test-${randomUUID()}.tlb`,
          corrupt = path + '.bad';
        const targetName = 'torchline_restore_guard_' + randomUUID().replaceAll('-', '');
        let created = false;
        try {
          const backup = await createBackup(url, key, path);
          expect(backup.encrypted).toBe(true);
          const bytes = await readFile(path);
          expect(bytes.includes(Buffer.from('PRIVATE_BACKUP_SENTINEL'))).toBe(false);
          const restored = await restoreDrill(url, key, path);
          expect(restored.replayedWorlds).toBe(1);
          expect(restored.authenticated).toBe(true);
          await expect(restoreBackup(url, url, key, path)).rejects.toThrow('different, empty');
          await store.pool.query(`CREATE DATABASE "${targetName}" TEMPLATE template0`);
          created = true;
          const targetUrl = new URL(url);
          targetUrl.pathname = '/' + targetName;
          targetUrl.searchParams.delete('options');
          await expect(
            restoreBackup(url, targetUrl.toString(), randomBytes(32).toString('hex'), path),
          ).rejects.toThrow('authentication failed');
          bytes[bytes.length - 18] ^= 1;
          await writeFile(corrupt, bytes, { mode: 0o600 });
          await expect(restoreBackup(url, targetUrl.toString(), key, corrupt)).rejects.toThrow(
            'authentication failed',
          );
          const target = new Store(targetUrl.toString());
          try {
            expect(
              (
                await target.pool.query(
                  "SELECT count(*)::integer AS n FROM pg_tables WHERE schemaname='public'",
                )
              ).rows[0].n,
            ).toBe(0);
            await target.pool.query('CREATE TABLE protected_data(value text PRIMARY KEY)');
            await target.pool.query("INSERT INTO protected_data VALUES('must survive')");
            await expect(restoreBackup(url, targetUrl.toString(), key, path)).rejects.toThrow(
              'not empty',
            );
            expect((await target.pool.query('SELECT value FROM protected_data')).rows).toEqual([
              { value: 'must survive' },
            ]);
          } finally {
            await target.close();
          }
          expect((await store.get(id)).state).toEqual(before);
          console.log(
            'Encrypted restore drill:',
            JSON.stringify({
              tables: restored.tables,
              rows: restored.rows,
              replayedWorlds: restored.replayedWorlds,
            }),
          );
        } finally {
          if (created) await store.pool.query(`DROP DATABASE "${targetName}"`);
          await unlink(path).catch(() => {});
          await unlink(corrupt).catch(() => {});
        }
      } finally {
        await store.close();
        await admin.pool.query(`DROP DATABASE "${sourceName}"`);
      }
    }),
  90000,
);
