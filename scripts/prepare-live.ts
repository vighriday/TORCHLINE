import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Store } from '@torchline/storage';
if (existsSync('.env.live'))
  throw new Error('.env.live already exists; edit it rather than overwriting live credentials.');
if (!process.env.DATABASE_URL) throw new Error('Run pnpm db:up first.');
const admin = new Store(process.env.DATABASE_URL);
try {
  if (
    !(await admin.pool.query("SELECT 1 FROM pg_database WHERE datname='torchline_live'")).rowCount
  )
    await admin.pool.query('CREATE DATABASE torchline_live');
} finally {
  await admin.close();
}
const url = new URL(process.env.DATABASE_URL);
url.pathname = '/torchline_live';
const values: Record<string, string> = {
  WORLD_MODE: 'live',
  PUBLIC_BASE_URL: 'http://localhost:3000',
  PORT: '3000',
  DATABASE_URL: url.toString(),
  SESSION_SECRET: randomBytes(32).toString('hex'),
  TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  BOT_SETUP_SECRET: randomBytes(32).toString('hex'),
  TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID ?? '',
  TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET ?? '',
  TWITCH_REDIRECT_URI: 'http://localhost:3000/auth/twitch/callback',
  TWITCH_BOT_USER_ID: process.env.TWITCH_BOT_USER_ID ?? '',
  EVENTSUB_SECRET: randomBytes(32).toString('hex'),
};
await writeFile(
  '.env.live',
  Object.entries(values)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join('\n') + '\n',
  { mode: 0o600, flag: 'wx' },
);
console.log(
  'Prepared a separate local live-mode database and ignored .env.live. Add Twitch credentials there, then run pnpm db:migrate:live and pnpm start:live. No Twitch requests were sent.',
);
