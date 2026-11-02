import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const root = resolve('.local');
const data = join(root, 'postgres');
const configFile = join(root, 'database.json');
const bin =
  process.env.PG_BIN ?? (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/17/bin' : '');
const executable = (name) =>
  bin ? join(bin, name + (process.platform === 'win32' ? '.exe' : '')) : name;
const run = (name, args, env = process.env) =>
  execFileSync(executable(name), args, {
    env,
    stdio: name === 'pg_ctl' && args.at(-1) === 'start' ? 'ignore' : ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 45000,
  })?.toString() ?? '';
mkdirSync(root, { recursive: true });
if (!existsSync(configFile))
  writeFileSync(
    configFile,
    JSON.stringify({ password: randomBytes(24).toString('hex'), port: 54329 }),
    { mode: 0o600 },
  );
const config = JSON.parse(readFileSync(configFile, 'utf8'));
const args = process.argv[2] ?? 'up';
if (args === 'down') {
  console.log(run('pg_ctl', ['-D', data, '-m', 'fast', 'stop']));
  process.exit(0);
}
if (args !== 'up') throw new Error('Use db:up or db:down.');
if (!existsSync(join(data, 'PG_VERSION'))) {
  const pwfile = join(root, 'postgres-password');
  writeFileSync(pwfile, config.password, { mode: 0o600 });
  console.log(
    run('initdb', [
      '-D',
      data,
      '--username=torchline',
      `--pwfile=${pwfile}`,
      '--auth=scram-sha-256',
      '--encoding=UTF8',
      '--no-locale',
    ]),
  );
}
let running = false;
try {
  run('pg_ctl', ['-D', data, 'status']);
  running = true;
} catch {
  /* the private cluster is stopped */
}
if (!running)
  console.log(
    run('pg_ctl', [
      '-D',
      data,
      '-l',
      join(root, 'postgres.log'),
      '-o',
      `-h 127.0.0.1 -p ${config.port}`,
      'start',
    ]),
  );
const pgEnv = { ...process.env, PGPASSWORD: config.password };
const connectionArgs = ['-h', '127.0.0.1', '-p', String(config.port), '-U', 'torchline'];
const found = run(
  'psql',
  [
    ...connectionArgs,
    '-d',
    'postgres',
    '-tAc',
    "SELECT 1 FROM pg_database WHERE datname = 'torchline'",
  ],
  pgEnv,
).trim();
if (!found) run('createdb', [...connectionArgs, 'torchline'], pgEnv);
const envText = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
let additions = '';
const defaults = {
  DATABASE_URL: `postgresql://torchline:${config.password}@127.0.0.1:${config.port}/torchline`,
  WORLD_MODE: 'simulation',
  PUBLIC_BASE_URL: 'http://localhost:3000',
  PORT: '3000',
  SESSION_SECRET: randomBytes(32).toString('hex'),
  TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  BOT_SETUP_SECRET: randomBytes(32).toString('hex'),
  LIVEWIRE_ENABLED: 'true',
};
for (const [key, value] of Object.entries(defaults))
  if (!new RegExp(`^${key}=`, 'm').test(envText)) additions += `${key}=${value}\n`;
if (additions)
  writeFileSync('.env', envText + (envText && !envText.endsWith('\n') ? '\n' : '') + additions, {
    mode: 0o600,
  });
console.log(
  'Private PostgreSQL ready on 127.0.0.1:54329. Local configuration is in ignored .env/.local files; credentials were not printed.',
);
