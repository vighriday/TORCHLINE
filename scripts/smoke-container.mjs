import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { Store } from '@torchline/storage';

// Linux CI only: Docker host networking reaches the disposable PostgreSQL service.
const image = process.argv[2] ?? 'torchline:check';
if (!/^[a-z0-9][a-z0-9._/:@-]*$/.test(image)) throw new Error('Invalid local image name.');
if (!process.env.DATABASE_URL)
  throw new Error('Use an isolated CI/development PostgreSQL database.');
const schema = 'container_' + randomUUID().replaceAll('-', ''),
  name = schema.replaceAll('_', '-');
const admin = new Store(process.env.DATABASE_URL),
  url = new URL(process.env.DATABASE_URL);
url.searchParams.set('options', `-c search_path=${schema}`);
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  DATABASE_URL: url.toString(),
  SESSION_SECRET: 'ab'.repeat(32),
  TOKEN_ENCRYPTION_KEY: 'cd'.repeat(32),
  BOT_SETUP_SECRET: 'ef'.repeat(32),
  WORLD_MODE: 'simulation',
  PUBLIC_BASE_URL: 'https://release-smoke.invalid',
  HOST: '127.0.0.1',
  PORT: '3200',
};
const docker = (args) => {
  const result = spawnSync('docker', args, { env, encoding: 'utf8', timeout: 60000 });
  if (result.status !== 0)
    throw new Error('Container smoke command failed; no environment or container logs printed.');
  return result.stdout.trim();
};
let created = false;
try {
  await admin.pool.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  const variables = Object.keys(env)
    .filter((k) => !['PATH', 'HOME'].includes(k))
    .flatMap((k) => ['--env', k]);
  docker(['run', '--rm', '--network=host', ...variables, image, 'node', 'scripts/migrate.ts']);
  const config = JSON.parse(docker(['image', 'inspect', image]))[0].Config;
  if (config.User !== 'node')
    throw new Error('Release image must run as the unprivileged node user.');
  docker([
    'run',
    '--rm',
    image,
    'node',
    '--input-type=module',
    '-e',
    `
    import { existsSync } from 'node:fs'; import { createRequire } from 'node:module';
    for(const path of ['.env','.env.live','.git','.local','.tools','docs/internal','idea.txt','frontend-design'])
      if(existsSync(path)) throw new Error('Private path in release image');
    const require=createRequire(import.meta.url);
    for(const name of ['vitest','typescript','@playwright/test','vite']) {
      try { require.resolve(name); } catch { continue; }
      throw new Error('Development dependency in release image');
    }
  `,
  ]);
  docker([
    'run',
    '-d',
    '--name',
    name,
    '--network=host',
    '--read-only',
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,size=16m',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    ...variables,
    image,
  ]);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch('http://127.0.0.1:3200/health/ready', {
        signal: AbortSignal.timeout(1000),
      });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('Release container did not become ready.');
  const root = await fetch('http://127.0.0.1:3200/'),
    html = await root.text();
  if (!root.ok || !root.headers.get('content-security-policy')?.includes("script-src 'self'"))
    throw new Error('Release web document/security policy failed.');
  const asset = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  if (!asset || !(await fetch('http://127.0.0.1:3200' + asset)).ok)
    throw new Error('Release browser bundle unavailable.');
  const denied = await fetch('http://127.0.0.1:3200/api/worlds', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-torchline-request': '1',
      origin: env.PUBLIC_BASE_URL,
    },
    body: '{}',
  });
  if (denied.status !== 401) throw new Error('Anonymous container mutation was not denied.');
  docker(['stop', '--time', '10', name]);
  const stopped = JSON.parse(docker(['inspect', name]))[0].State;
  if (stopped.ExitCode !== 0 || stopped.OOMKilled)
    throw new Error('Release container did not stop gracefully.');
  console.log(
    'Release container passed: non-root, no private paths/dev tooling, read-only filesystem, migration/readiness/assets/authorization and graceful SIGTERM. No Twitch fixture counts as live evidence.',
  );
} finally {
  spawnSync('docker', ['rm', '-f', name], { env, stdio: 'ignore', timeout: 15000 });
  if (created) await admin.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.close();
}
