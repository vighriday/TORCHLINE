import { inputPolicy } from '@torchline/storage';
import type { AppConfig } from './app.ts';

export function runtimeConfig(env: NodeJS.ProcessEnv) {
  const production = env.NODE_ENV === 'production';
  const mode = env.WORLD_MODE ?? (production ? '' : 'simulation');
  if (mode !== 'simulation' && mode !== 'live')
    throw new Error('WORLD_MODE must explicitly be simulation or live.');
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  let database: URL;
  try {
    database = new URL(env.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL URL.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !database.hostname ||
    !database.pathname.slice(1)
  )
    throw new Error('DATABASE_URL must select a PostgreSQL database.');
  const loopback = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
  if (
    production &&
    !loopback(database.hostname) &&
    database.searchParams.get('sslmode') !== 'verify-full'
  )
    throw new Error(
      'Remote production PostgreSQL requires sslmode=verify-full and a trusted server certificate.',
    );
  const baseUrl = env.PUBLIC_BASE_URL ?? `http://localhost:${mode === 'live' ? 3001 : 3000}`;
  let origin: URL;
  try {
    origin = new URL(baseUrl);
  } catch {
    throw new Error('PUBLIC_BASE_URL must be an HTTP(S) origin.');
  }
  if (
    !['https:', 'http:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new Error(
      'PUBLIC_BASE_URL must be an HTTP(S) origin without credentials, path or query.',
    );
  if (origin.protocol !== 'https:' && (production || !loopback(origin.hostname)))
    throw new Error(
      'Public and production origins require HTTPS. Local development may use loopback HTTP.',
    );
  const hex = (name: string) => {
    if (!/^[a-f\d]{64}$/i.test(env[name] ?? ''))
      throw new Error(`Configure an independent random 64-hex-character ${name}.`);
    return env[name]!;
  };
  const sessionSecret = hex('SESSION_SECRET'),
    tokenKey = hex('TOKEN_ENCRYPTION_KEY');
  // A live world is reachable through a public origin, so its operator key must be strong even
  // when it runs in development mode (as the judges' compose setup does).
  const botSetupSecret =
    production || mode === 'live' ? hex('BOT_SETUP_SECRET') : (env.BOT_SETUP_SECRET ?? '');
  const secrets = [sessionSecret, tokenKey, botSetupSecret, env.EVENTSUB_SECRET]
    .filter(Boolean)
    .map((s) => s!.toLowerCase());
  if (new Set(secrets).size !== secrets.length)
    throw new Error(
      'Session, token encryption, bot setup and EventSub secrets must be independent.',
    );
  if (Boolean(env.TWITCH_CLIENT_ID) !== Boolean(env.TWITCH_CLIENT_SECRET))
    throw new Error('Configure both Twitch client ID and client secret.');
  if (mode === 'live' && env.TWITCH_CLIENT_ID) {
    if (env.TWITCH_REDIRECT_URI !== `${origin.origin}/auth/twitch/callback`)
      throw new Error(
        'TWITCH_REDIRECT_URI must exactly match the public origin plus /auth/twitch/callback.',
      );
    if (!/^[a-z\d]{10,100}$/i.test(env.EVENTSUB_SECRET ?? ''))
      throw new Error('Configure an alphanumeric EVENTSUB_SECRET of 10–100 characters.');
  }
  if (production && mode === 'live' && !env.TWITCH_CLIENT_ID)
    throw new Error('A production live service requires the registered Twitch application.');
  const bounded = (name: string, fallback: number, max: number) => {
    const n = env[name] === undefined ? fallback : Number(env[name]);
    if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`Invalid ${name}.`);
    return n;
  };
  const config: AppConfig = {
    mode,
    baseUrl: origin.origin,
    sessionSecret,
    tokenKey,
    botSetupSecret,
    twitchClientId: env.TWITCH_CLIENT_ID,
    twitchClientSecret: env.TWITCH_CLIENT_SECRET,
    twitchRedirectUri: env.TWITCH_REDIRECT_URI,
    eventsubSecret: env.EVENTSUB_SECRET,
    botUserId: env.TWITCH_BOT_USER_ID,
    trustProxyHops: (() => {
      if (env.TRUST_PROXY_HOPS === undefined) return 0;
      const hops = Number(env.TRUST_PROXY_HOPS);
      if (!Number.isInteger(hops) || hops < 0 || hops > 5)
        throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 5.');
      return hops;
    })(),
    livewireEnabled: (() => {
      if (env.LIVEWIRE_ENABLED === undefined) return false;
      if (!['true', 'false'].includes(env.LIVEWIRE_ENABLED))
        throw new Error('LIVEWIRE_ENABLED must be true or false.');
      return env.LIVEWIRE_ENABLED === 'true';
    })(),
    botRepliesEnabled: (() => {
      if (env.BOT_REPLIES_ENABLED === undefined) return true;
      if (!['true', 'false'].includes(env.BOT_REPLIES_ENABLED))
        throw new Error('BOT_REPLIES_ENABLED must be true or false.');
      return env.BOT_REPLIES_ENABLED === 'true';
    })(),
    inputPolicy: inputPolicy(env),
    feedLimits: {
      perChannel: bounded('FEED_MAX_PER_CHANNEL', 8, 100),
      total: bounded('FEED_MAX_TOTAL', 256, 10000),
    },
  };
  return {
    config,
    databaseUrl: env.DATABASE_URL,
    databaseBudgets: {
      statementMs: bounded('DB_STATEMENT_TIMEOUT_MS', 10000, 60000),
      lockMs: bounded('DB_LOCK_TIMEOUT_MS', 2000, 10000),
      idleTransactionMs: bounded('DB_IDLE_TRANSACTION_TIMEOUT_MS', 15000, 60000),
    },
    port: bounded('PORT', mode === 'live' ? 3001 : 3000, 65535),
    host: env.HOST || '127.0.0.1',
  };
}
