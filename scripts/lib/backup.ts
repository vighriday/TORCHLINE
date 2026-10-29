import { spawn } from 'node:child_process';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, mkdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Writable } from 'node:stream';
import { pipeline, finished } from 'node:stream/promises';
import { isDeepStrictEqual } from 'node:util';
import type { PoolClient } from 'pg';
import { Store } from '@torchline/storage';
import { replayEvents } from '@torchline/engine';

// Operator-only native backup/restore and scratch DDL have a larger bounded budget
// than interactive requests. Never disable timeouts on application connections.
const maintenanceBudgets = { statementMs: 60000, lockMs: 10000, idleTransactionMs: 60000 };
const magic = Buffer.from('TORCHLINE.BAK1\n');
const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
type Fingerprint = { table: string; rows: number; sha256: string };
type Header = {
  version: 1;
  nonce: string;
  schema: string;
  source: string;
  at: string;
  postgresMajor: number;
  tables: Fingerprint[];
};
const keyBytes = (key: string) => {
  if (!/^[a-f\d]{64}$/i.test(key))
    throw new Error('Use an independent 64-hex-character BACKUP_ENCRYPTION_KEY.');
  return Buffer.from(key, 'hex');
};
function identity(url: string) {
  const u = new URL(url);
  return createHash('sha256')
    .update(`${u.hostname.toLowerCase()}:${u.port || 5432}/${decodeURIComponent(u.pathname)}`)
    .digest('hex');
}
function pgEnvironment(url: string) {
  const u = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(u.protocol))
    throw new Error('Use a PostgreSQL connection URL.');
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([name]) =>
        /^(PATH|SystemRoot|WINDIR|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(name),
      ),
    ),
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
    PGCONNECT_TIMEOUT: '10',
    PGTZ: 'UTC',
    ...(u.searchParams.get('options') ? { PGOPTIONS: u.searchParams.get('options')! } : {}),
    ...(u.searchParams.get('sslmode') ? { PGSSLMODE: u.searchParams.get('sslmode')! } : {}),
    ...(u.searchParams.get('sslrootcert')
      ? { PGSSLROOTCERT: u.searchParams.get('sslrootcert')! }
      : {}),
  };
}
function pg(name: 'pg_dump' | 'pg_restore', args: string[], url: string) {
  const directory =
    process.env.PG_BIN ??
    (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/17/bin' : '');
  const executable = directory
    ? join(directory, name + (process.platform === 'win32' ? '.exe' : ''))
    : name;
  const env = pgEnvironment(url),
    container = process.env.PG_TOOL_CONTAINER;
  if (container && !/^postgres:17(?:[.\-][a-z0-9]+)*$/.test(container))
    throw new Error('PG_TOOL_CONTAINER must name the official PostgreSQL 17 image.');
  const child = spawn(
    container ? 'docker' : executable,
    container
      ? [
          'run',
          '--rm',
          '--network=host',
          '-i',
          ...Object.keys(env)
            .filter((k) => k.startsWith('PG'))
            .flatMap((k) => ['--env', k]),
          container,
          name,
          ...args,
        ]
      : args,
    { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  // Error text/connection strings/dump bytes never enter logs or exception messages.
  child.stderr.resume();
  const completion = new Promise<void>((resolve, reject) => {
    child.once('error', () =>
      reject(
        new Error(
          'PostgreSQL utility unavailable. Install matching PostgreSQL tools or set PG_BIN.',
        ),
      ),
    );
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('PostgreSQL utility failed; destination is not ready for use.')),
    );
  });
  void completion.catch(() => {});
  return { child, completion };
}
async function fingerprints(client: PoolClient, schema: string): Promise<Fingerprint[]> {
  await client.query("SET LOCAL TIME ZONE 'UTC'");
  const tables = (
    await client.query(
      'SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename COLLATE "C"',
      [schema],
    )
  ).rows;
  const result: Fingerprint[] = [];
  for (const { tablename } of tables) {
    const primary = (
      await client.query(
        'SELECT a.attname FROM pg_index i JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum,ord) ON true JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum WHERE i.indrelid=$1::regclass AND i.indisprimary ORDER BY k.ord',
        [`${quote(schema)}.${quote(tablename)}`],
      )
    ).rows;
    if (!primary.length) throw new Error('Application backup requires primary keys on all tables.');
    const order = primary.map((p) => `${quote(p.attname)}::text COLLATE "C"`).join(',');
    await client.query(
      `DECLARE backup_rows NO SCROLL CURSOR FOR SELECT to_jsonb(t)::text AS value FROM ${quote(schema)}.${quote(tablename)} t ORDER BY ${order}`,
    );
    const hash = createHash('sha256');
    let count = 0;
    for (;;) {
      const rows = (await client.query('FETCH 512 FROM backup_rows')).rows;
      if (!rows.length) break;
      for (const row of rows) {
        hash.update(row.value + '\n');
        count++;
      }
    }
    await client.query('CLOSE backup_rows');
    result.push({ table: tablename, rows: count, sha256: hash.digest('hex') });
  }
  return result;
}
export async function createBackup(url: string, key: string, path: string) {
  const bytes = keyBytes(key),
    store = new Store(url, maintenanceBudgets);
  let created = false;
  await mkdir(dirname(path), { recursive: true });
  try {
    return await store.transaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      await client.query('SELECT pg_advisory_xact_lock(833016)');
      const info = (
        await client.query(
          "SELECT current_schema() AS schema,pg_export_snapshot() AS snapshot,current_setting('server_version_num')::integer AS version,clock_timestamp() AS at",
        )
      ).rows[0];
      if (!info.schema) throw new Error('No application schema selected.');
      const header: Header = {
        version: 1,
        nonce: randomBytes(12).toString('base64'),
        schema: info.schema,
        source: identity(url),
        at: info.at.toISOString(),
        postgresMajor: Math.floor(info.version / 10000),
        tables: await fingerprints(client, info.schema),
      };
      if (!header.tables.some((t) => t.table === 'schema_migrations'))
        throw new Error('The source is not a migrated TORCHLINE schema.');
      const body = Buffer.from(JSON.stringify(header)),
        length = Buffer.alloc(4);
      length.writeUInt32BE(body.length);
      const file = await open(path, 'wx', 0o600);
      created = true;
      let operation: ReturnType<typeof pg> | undefined;
      try {
        operation = pg(
          'pg_dump',
          [
            '--format=custom',
            '--no-owner',
            '--no-privileges',
            '--schema',
            info.schema,
            '--snapshot',
            info.snapshot,
          ],
          url,
        );
        const { child, completion } = operation;
        const cipher = createCipheriv('aes-256-gcm', bytes, Buffer.from(header.nonce, 'base64'));
        cipher.setAAD(body);
        const output = file.createWriteStream({ autoClose: true, flush: true });
        try {
          output.write(Buffer.concat([magic, length, body]));
          await pipeline(child.stdout, cipher, output, { end: false });
          await completion;
          output.end(cipher.getAuthTag());
          await finished(output);
        } catch (error) {
          child.kill();
          output.destroy();
          throw error;
        }
      } finally {
        operation?.child.kill();
        await file.close();
      }
      return {
        path,
        at: header.at,
        tables: header.tables.length,
        rows: header.tables.reduce((sum, t) => sum + t.rows, 0),
        encrypted: true,
      };
    });
  } catch (error) {
    if (created) await unlink(path).catch(() => {});
    throw error;
  } finally {
    await store.close();
  }
}
async function archive(path: string) {
  const file = await open(path, 'r');
  try {
    const size = (await file.stat()).size,
      prefix = Buffer.alloc(magic.length + 4);
    await file.read(prefix, 0, prefix.length, 0);
    if (!prefix.subarray(0, magic.length).equals(magic))
      throw new Error('Unrecognized encrypted backup.');
    const length = prefix.readUInt32BE(magic.length);
    if (length < 1 || length > 1048576 || size < prefix.length + length + 17)
      throw new Error('Truncated or invalid backup.');
    const body = Buffer.alloc(length),
      tag = Buffer.alloc(16);
    await file.read(body, 0, length, prefix.length);
    await file.read(tag, 0, 16, size - 16);
    const header = JSON.parse(body.toString('utf8')) as Header;
    if (
      header.version !== 1 ||
      Buffer.from(header.nonce, 'base64').length !== 12 ||
      !Array.isArray(header.tables)
    )
      throw new Error('Unsupported backup metadata.');
    return { header, body, tag, start: prefix.length + length, end: size - 17 };
  } finally {
    await file.close();
  }
}
export async function restoreBackup(
  sourceUrl: string,
  targetUrl: string,
  key: string,
  path: string,
) {
  const bytes = keyBytes(key),
    a = await archive(path);
  if (identity(sourceUrl) === identity(targetUrl) || a.header.source === identity(targetUrl))
    throw new Error('Restore destination must be a different, empty database.');
  const decrypt = () => {
    const d = createDecipheriv('aes-256-gcm', bytes, Buffer.from(a.header.nonce, 'base64'));
    d.setAAD(a.body);
    d.setAuthTag(a.tag);
    return d;
  };
  // Authenticate every encrypted byte before sending any SQL to PostgreSQL. No plaintext file.
  await pipeline(
    createReadStream(path, { start: a.start, end: a.end }),
    decrypt(),
    new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
    }),
  ).catch(() => {
    throw new Error('Backup authentication failed. No restore was attempted.');
  });
  const target = new Store(targetUrl, maintenanceBudgets),
    client = await target.pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(833016)');
    const tables = (
      await client.query(
        "SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','v','m','S') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' LIMIT 1",
      )
    ).rowCount;
    if (tables) throw new Error('Restore destination is not empty. Nothing was replaced.');
    const major = Math.floor(
      (await client.query("SELECT current_setting('server_version_num')::integer AS version"))
        .rows[0].version / 10000,
    );
    if (major < a.header.postgresMajor)
      throw new Error('The restore database cannot be older than the backup.');
    // template0 still contains an empty public schema; pg_dump includes CREATE SCHEMA.
    // RESTRICT refuses to remove any unexpected object (including routines/types).
    if (a.header.schema === 'public') await client.query('DROP SCHEMA IF EXISTS public RESTRICT');
    const { child, completion } = pg(
      'pg_restore',
      [
        '--no-owner',
        '--no-privileges',
        '--exit-on-error',
        '--single-transaction',
        '--dbname',
        pgEnvironment(targetUrl).PGDATABASE,
      ],
      targetUrl,
    );
    child.stdout.resume();
    try {
      await pipeline(
        createReadStream(path, { start: a.start, end: a.end }),
        decrypt(),
        child.stdin,
      );
      await completion;
    } catch (error) {
      child.kill();
      throw error;
    }
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const restored = await fingerprints(client, a.header.schema);
    await client.query('COMMIT');
    if (!isDeepStrictEqual(restored, a.header.tables))
      throw new Error('Restore fingerprint mismatch. Keep this destination isolated.');
    const replayUrl = new URL(targetUrl);
    replayUrl.searchParams.set('options', `-c search_path=${a.header.schema}`);
    const replayStore = new Store(replayUrl.toString(), maintenanceBudgets);
    let replayed = 0;
    try {
      const ids = (await replayStore.pool.query('SELECT id FROM worlds ORDER BY id')).rows;
      for (const { id } of ids) {
        const world = await replayStore.get(id);
        if (
          !isDeepStrictEqual(replayEvents(id, world.events, world.state.rulesVersion), world.state)
        )
          throw new Error('Restored game replay mismatch. Keep this destination isolated.');
        replayed++;
      }
    } finally {
      await replayStore.close();
    }
    return {
      tables: restored.length,
      rows: restored.reduce((sum, t) => sum + t.rows, 0),
      replayedWorlds: replayed,
      authenticated: true,
    };
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.query('SELECT pg_advisory_unlock(833016)').catch(() => {});
    client.release();
    await target.close();
  }
}
export async function restoreDrill(url: string, key: string, path: string) {
  const source = new Store(url, maintenanceBudgets),
    name = 'torchline_restore_' + randomUUID().replaceAll('-', '');
  let created = false;
  try {
    await source.pool.query(`CREATE DATABASE ${quote(name)} TEMPLATE template0`);
    created = true;
    const target = new URL(url);
    target.pathname = '/' + name;
    target.searchParams.delete('options');
    return await restoreBackup(url, target.toString(), key, path);
  } finally {
    try {
      if (created) await source.pool.query(`DROP DATABASE ${quote(name)}`);
    } finally {
      await source.close();
    }
  }
}
