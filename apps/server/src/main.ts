import { Store, inputPolicy, REQUIRED_MIGRATION } from '@torchline/storage';
import { createApp } from './app.ts';
if (!process.env.DATABASE_URL)
  throw new Error('DATABASE_URL missing. Run pnpm db:up and pnpm db:migrate first.');
if (!process.env.SESSION_SECRET || !/^[a-f\d]{64}$/i.test(process.env.SESSION_SECRET))
  throw new Error('Configure a random 64-character hexadecimal SESSION_SECRET.');
const mode = process.env.WORLD_MODE ?? 'simulation';
if (!['simulation', 'live'].includes(mode))
  throw new Error('WORLD_MODE must be simulation or live.');
const store = new Store(process.env.DATABASE_URL);
if (
  !(await store.pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [REQUIRED_MIGRATION]))
    .rowCount
)
  throw new Error('Database migration required. Run the migration command for this mode.');
const app = await createApp(
  store,
  {
    mode: mode as 'simulation' | 'live',
    baseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000',
    sessionSecret: process.env.SESSION_SECRET,
    tokenKey: process.env.TOKEN_ENCRYPTION_KEY ?? '',
    botSetupSecret: process.env.BOT_SETUP_SECRET ?? '',
    twitchClientId: process.env.TWITCH_CLIENT_ID,
    twitchClientSecret: process.env.TWITCH_CLIENT_SECRET,
    twitchRedirectUri: process.env.TWITCH_REDIRECT_URI,
    eventsubSecret: process.env.EVENTSUB_SECRET,
    botUserId: process.env.TWITCH_BOT_USER_ID,
    inputPolicy: inputPolicy(process.env),
  },
  { logger: true },
);
app.addHook('onClose', async () => store.close());
await app.listen({ port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? '127.0.0.1' });
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
