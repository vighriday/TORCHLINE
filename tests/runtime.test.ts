import { it, expect } from 'vitest';
import { runtimeConfig } from '../apps/server/src/runtime-config.ts';
import { createApp } from '../apps/server/src/app.ts';
import { database } from './helpers.ts';

const env = {
  DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:5432/test',
  SESSION_SECRET: 'ab'.repeat(32),
  TOKEN_ENCRYPTION_KEY: 'cd'.repeat(32),
  BOT_SETUP_SECRET: 'ef'.repeat(32),
  WORLD_MODE: 'simulation',
};
it('rejects insecure or ambiguous release configuration without echoing credentials', () => {
  expect(runtimeConfig(env).host).toBe('127.0.0.1');
  expect(runtimeConfig(env).config.trustProxyHops).toBe(0);
  expect(runtimeConfig({ ...env, TRUST_PROXY_HOPS: '1' }).config.trustProxyHops).toBe(1);
  const production = { ...env, NODE_ENV: 'production', PUBLIC_BASE_URL: 'https://game.example' };
  expect(runtimeConfig(production).config.mode).toBe('simulation');
  for (const change of [
    { WORLD_MODE: '' },
    { SESSION_SECRET: 'private-invalid-sentinel' },
    { TOKEN_ENCRYPTION_KEY: env.SESSION_SECRET },
    { PORT: 'NaN' },
    { PORT: '65536' },
    { PUBLIC_BASE_URL: 'http://game.example' },
    { PUBLIC_BASE_URL: 'https://secret@game.example' },
    { PUBLIC_BASE_URL: 'https://game.example/subpath' },
    { FEED_MAX_TOTAL: '0' },
    { BOT_REPLIES_ENABLED: 'yes' },
    { DB_STATEMENT_TIMEOUT_MS: '0' },
    { DB_LOCK_TIMEOUT_MS: 'NaN' },
    { DB_IDLE_TRANSACTION_TIMEOUT_MS: '60001' },
    { TRUST_PROXY_HOPS: '-1' },
    { TRUST_PROXY_HOPS: '6' },
    { TRUST_PROXY_HOPS: 'all' },
    { DATABASE_URL: 'invalid-private-sentinel' },
    { DATABASE_URL: 'postgresql://user:private-sentinel@remote.example/db?sslmode=require' },
    { WORLD_MODE: 'live' },
    { TWITCH_CLIENT_ID: 'only-one-half' },
  ]) {
    expect(() => runtimeConfig({ ...production, ...change })).toThrow();
    try {
      runtimeConfig({ ...production, ...change });
    } catch (error) {
      expect(String(error)).not.toContain('sentinel');
    }
  }
  expect(
    runtimeConfig({
      ...production,
      DATABASE_URL: 'postgresql://u:p@remote.example/db?sslmode=verify-full',
    }).host,
  ).toBe('127.0.0.1');
  const live = {
    ...production,
    WORLD_MODE: 'live',
    TWITCH_CLIENT_ID: 'fixture',
    TWITCH_CLIENT_SECRET: 'fixture',
    EVENTSUB_SECRET: '01'.repeat(32),
    TWITCH_REDIRECT_URI: 'https://game.example/auth/twitch/callback',
  };
  expect(runtimeConfig(live).port).toBe(3001);
  expect(runtimeConfig({ ...live, BOT_REPLIES_ENABLED: 'false' }).config.botRepliesEnabled).toBe(
    false,
  );
  expect(() =>
    runtimeConfig({ ...live, TWITCH_REDIRECT_URI: 'https://other.example/auth/twitch/callback' }),
  ).toThrow('exactly match');
  // Development-mode live worlds (the judges' compose setup) still need a strong operator key.
  const developmentLive = { ...live, NODE_ENV: undefined };
  expect(runtimeConfig(developmentLive).config.mode).toBe('live');
  for (const BOT_SETUP_SECRET of [undefined, 'REPLACE_WITH_64_RANDOM_HEX_CHARACTERS', 'short'])
    expect(() => runtimeConfig({ ...developmentLive, BOT_SETUP_SECRET })).toThrow(
      'BOT_SETUP_SECRET',
    );
});

it('bounds authenticated feeds per channel and globally, releases closed slots and applies security headers', () =>
  database(async (store) => {
    const app = await createApp(
      store,
      {
        mode: 'simulation',
        baseUrl: 'http://localhost:3000',
        sessionSecret: env.SESSION_SECRET,
        tokenKey: env.TOKEN_ENCRYPTION_KEY,
        botSetupSecret: 'fixture',
        feedLimits: { perChannel: 2, total: 3 },
      },
      { workers: false },
    );
    const controllers: AbortController[] = [];
    try {
      const address = await app.listen({ port: 0, host: '127.0.0.1' });
      const cookie = async (channel: string) => {
        const response = await fetch(address + '/api/simulator/login', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
            'x-torchline-request': '1',
          },
          body: JSON.stringify({ channel }),
        });
        expect(response.status).toBe(200);
        return response.headers.get('set-cookie')!.split(';')[0];
      };
      const alpha = await cookie('alpha'),
        beta = await cookie('beta');
      const open = async (session: string) => {
        const abort = new AbortController();
        controllers.push(abort);
        return fetch(address + '/api/live/events', {
          headers: { cookie: session },
          signal: abort.signal,
        });
      };
      const one = await open(alpha);
      expect(one.status).toBe(200);
      expect(one.headers.get('content-security-policy')).toContain("script-src 'self'");
      const reader = one.body!.getReader();
      expect((await reader.read()).value?.length).toBeGreaterThan(0);
      expect((await open(alpha)).status).toBe(200);
      expect((await open(alpha)).status).toBe(429);
      expect((await open(beta)).status).toBe(200);
      expect((await open(beta)).status).toBe(429);
      controllers[0].abort();
      await reader.cancel().catch(() => {});
      await expect
        .poll(async () => {
          const response = await open(beta);
          return response.status;
        })
        .toBe(200);
      const anonymous = await fetch(address + '/api/live/events');
      expect(anonymous.status).toBe(401);
      const response = await fetch(address + '/health/live');
      expect(response.headers.get('permissions-policy')).toContain('microphone=()');
      expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    } finally {
      for (const controller of controllers) controller.abort();
      await app.close();
    }
  }));
