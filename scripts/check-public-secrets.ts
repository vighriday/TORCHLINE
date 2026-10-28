import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { Store } from '@torchline/storage';
import { decryptSecret } from '@torchline/twitch';
const values = new Set<string>();
if (existsSync('.local/ngrok.yml')) {
  const credential = readFileSync('.local/ngrok.yml', 'utf8').match(
    /^\s*authtoken:\s*["']?([\w-]+)/m,
  )?.[1];
  if (credential && credential.length >= 16) values.add(credential);
}
let live: ReturnType<typeof parseEnv> = {};
for (const file of ['.env', '.env.live'])
  if (existsSync(file)) {
    const env = parseEnv(readFileSync(file, 'utf8'));
    if (file === '.env.live') live = env;
    for (const [key, value] of Object.entries(env))
      if (
        value &&
        /SECRET|TOKEN|PASSWORD|ENCRYPTION_KEY/.test(key) &&
        value.length >= 16 &&
        !value.startsWith('REPLACE_')
      )
        values.add(value);
    if (env.DATABASE_URL) {
      const password = decodeURIComponent(new URL(env.DATABASE_URL).password);
      if (password.length >= 16) values.add(password);
    }
  }
if (live.DATABASE_URL && live.TOKEN_ENCRYPTION_KEY) {
  const store = new Store(live.DATABASE_URL);
  try {
    for (const grant of (
      await store.pool.query(
        'SELECT encrypted FROM oauth_grants UNION ALL SELECT encrypted FROM bot_setup_confirmations',
      )
    ).rows) {
      const tokens = decryptSecret<{ access_token?: string; refresh_token?: string }>(
        grant.encrypted,
        live.TOKEN_ENCRYPTION_KEY,
      );
      for (const value of [tokens.access_token, tokens.refresh_token])
        if (value && value.length >= 8) values.add(value);
    }
  } finally {
    await store.close();
  }
}
const needles = [...values].flatMap((value) => [
  Buffer.from(value),
  Buffer.from(Buffer.from(value).toString('base64')),
  Buffer.from(encodeURIComponent(value)),
]);
let checked = 0;
const inspect = (content: Buffer, label: string) => {
  checked++;
  if (needles.some((value) => content.includes(value)))
    throw new Error(
      `A private credential was found in ${label}. The value is deliberately not printed.`,
    );
};
const git = (...args: string[]) =>
  execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
const history = git('rev-list', '--objects', '--all')
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split(' ')[0]);
const index = git('ls-files', '--stage', '-z')
  .split('\0')
  .filter(Boolean)
  .map((entry) => entry.split('\t')[0].split(' ')[1]);
const ids = [...new Set([...history, ...index])];
inspect(
  execFileSync(
    'git',
    ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'cat-file', '--batch'],
    { input: ids.join('\n') + '\n', maxBuffer: 64 * 1024 * 1024 },
  ),
  'committed or staged Git objects',
);
for (const file of git('ls-files').split('\n').filter(Boolean))
  if (existsSync(file)) inspect(readFileSync(file), 'tracked working files');
function walk(directory: string) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else inspect(readFileSync(path), 'built browser assets');
  }
}
walk(resolve('apps/web/dist'));
for (const name of existsSync('.local') ? readdirSync('.local') : [])
  if (name.endsWith('.log'))
    inspect(readFileSync(join('.local', name)), 'local application/tunnel logs');
let responses = 0;
const artifactsOnly = process.argv.includes('--artifacts-only');
let publicScan = artifactsOnly
  ? 'skipped: artifacts-only requested'
  : 'incomplete: no live HTTPS origin';
let identified = false;
if (!artifactsOnly && live.PUBLIC_BASE_URL?.startsWith('https://')) {
  let probe: Response | undefined;
  try {
    probe = await fetch(new URL('/health/live', live.PUBLIC_BASE_URL), {
      headers: { 'ngrok-skip-browser-warning': 'true' },
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    publicScan = 'incomplete: public origin unreachable';
  }
  if (probe) {
    const body = Buffer.from(await probe.arrayBuffer());
    inspect(body, 'public identity probe');
    responses++;
    let identity: { ok?: boolean; mode?: string } = {};
    try {
      identity = JSON.parse(body.toString()) ?? {};
    } catch {
      /* Tunnel/error HTML is not the app. */
    }
    identified = probe.status === 200 && identity.ok === true && identity.mode === 'live';
    publicScan = identified
      ? 'completed: selected live application responses'
      : 'incomplete: origin did not identify the live application';
  }
}
if (identified) {
  const paths = new Set([
    '/',
    '/.env',
    '/.env.live',
    '/.git/config',
    '/docs/internal/IDEA.txt',
    '/api/state',
    '/api/twitch/status',
  ]);
  for (const path of paths) {
    let response: Response;
    try {
      response = await fetch(new URL(path, live.PUBLIC_BASE_URL), {
        headers: { 'ngrok-skip-browser-warning': 'true' },
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      publicScan = 'incomplete: a selected public response was unavailable';
      break;
    }
    const body = Buffer.from(await response.arrayBuffer());
    inspect(body, 'public HTTP response');
    responses++;
    if (live.TWITCH_CLIENT_ID && body.includes(Buffer.from(live.TWITCH_CLIENT_ID)))
      throw new Error(
        'Client ID was unnecessarily exposed outside the OAuth authorization redirect.',
      );
    if (path === '/')
      for (const match of body.toString().matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g))
        paths.add(match[1]);
  }
}
console.log(
  JSON.stringify(
    {
      result: artifactsOnly || publicScan.startsWith('completed:') ? 'passed' : 'partial',
      artifactScan: 'passed',
      publicScan,
      privateFingerprints: values.size,
      gitObjects: ids.length,
      stagedEntries: index.length,
      inspectedBuffers: checked,
      publicResponses: responses,
      clientIdPolicy:
        'The client ID is a public OAuth identifier. It is excluded from normal UI/assets/API responses; the Twitch authorization redirect necessarily includes it. Client secrets and access/refresh tokens must stay private.',
    },
    null,
    2,
  ),
);
if (!artifactsOnly && !publicScan.startsWith('completed:')) process.exitCode = 2;
