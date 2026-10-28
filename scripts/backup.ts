import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createBackup, restoreBackup, restoreDrill } from './lib/backup.ts';

const action = process.argv[2];
if (action === 'prepare') {
  const text = await readFile('.env.live', 'utf8');
  if (!/^BACKUP_ENCRYPTION_KEY=.+$/m.test(text))
    await writeFile(
      '.env.live',
      text.trimEnd() + `\nBACKUP_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}\n`,
      { mode: 0o600 },
    );
  console.log(
    'Backup key configured locally. Preserve it separately from the encrypted archives; no key printed.',
  );
} else {
  const url = process.env.DATABASE_URL,
    key = process.env.BACKUP_ENCRYPTION_KEY;
  if (!url || !key)
    throw new Error(
      'Configure DATABASE_URL and BACKUP_ENCRYPTION_KEY (backup:prepare for the local live environment).',
    );
  const path = resolve(
    process.argv[3] ?? `.local/backups/${new Date().toISOString().replaceAll(':', '-')}.tlb`,
  );
  try {
    if (action === 'create') console.log(JSON.stringify(await createBackup(url, key, path)));
    else if (action === 'drill') console.log(JSON.stringify(await restoreDrill(url, key, path)));
    else if (action === 'restore') {
      if (!process.env.RESTORE_DATABASE_URL)
        throw new Error('Set RESTORE_DATABASE_URL to a different, empty destination.');
      console.log(
        JSON.stringify(await restoreBackup(url, process.env.RESTORE_DATABASE_URL, key, path)),
      );
    } else throw new Error('Use create, drill or restore with an encrypted archive path.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Backup operation failed.');
    process.exitCode = 1;
  }
}
