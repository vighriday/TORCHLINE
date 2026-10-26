import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { encryptSecret, CREATOR_SCOPES } from '@torchline/twitch';
import type { Store } from '@torchline/storage';
import { createApp } from '../apps/server/src/app.ts';
import { twitchBotSetup } from '../apps/server/src/twitch-bot-setup.ts';
import { database } from './helpers.ts';
import { authorize, browserHeader, liveConfig, providerFixture } from './twitch-provider.ts';

type Validation = 'valid' | 'revoked' | 'wrong-account';
type Context = {
  store: Store;
  app: Awaited<ReturnType<typeof createApp>>;
  provider: ReturnType<typeof providerFixture>;
  headers: Record<string, string>;
  creatorHeaders: Record<string, string>;
  otherHeaders: Record<string, string>;
  token: string;
  cookie: { httpOnly?: boolean; secure?: boolean; sameSite?: string; path?: string };
  setValidation: (value: Validation) => void;
};
async function withPending(run: (context: Context) => Promise<void>) {
  return database(async (store) => {
    await store.ensureCreator('99', 'Accidental creator', 'live');
    await store.pool.query(
      "INSERT INTO oauth_grants(id,role,scopes,encrypted) VALUES('99','creator',$1,$2)",
      [CREATOR_SCOPES, encryptSecret({ access_token: 'old-creator-fixture' }, liveConfig.tokenKey)],
    );
    await store.pool.query(
      "INSERT INTO sessions(hash,channel_id,expires_at) VALUES($1,'99',now()+interval '1 hour')",
      [createHash('sha256').update('creator-session-fixture').digest('hex')],
    );
    await store.pool.query(
      "INSERT INTO overlay_grants(hash,channel_id) VALUES('old-overlay-fixture','99')",
    );
    const provider = providerFixture();
    let validation: Validation = 'valid';
    const fetcher: typeof provider.fetcher = async (input, init) => {
      if (String(input).endsWith('/validate') && validation === 'revoked')
        return new Response('', { status: 401 });
      const response = await provider.fetcher(input, init);
      if (String(input).endsWith('/validate') && validation === 'wrong-account')
        return Response.json({ ...(await response.json()), user_id: '100' });
      return response;
    };
    const app = await createApp(store, liveConfig, { fetcher, workers: false });
    provider.attach(app);
    try {
      const other = await authorize(app, '42');
      const response = (await authorize(app, '99', true)).response;
      expect(response.statusCode).toBe(302);
      const cookie = response.cookies.find((cookie) => cookie.name === 'torchline_bot_setup')!;
      expect(cookie).toBeDefined();
      await run({
        store,
        app,
        provider,
        token: cookie.value,
        cookie,
        headers: { ...browserHeader, cookie: `torchline_bot_setup=${cookie.value}` },
        creatorHeaders: { ...browserHeader, cookie: 'torchline_session=creator-session-fixture' },
        otherHeaders: other.headers,
        setValidation: (value) => {
          validation = value;
        },
      });
    } finally {
      await app.close();
    }
  });
}
const confirm = (c: Context, headers = c.headers, payload: Record<string, unknown> = {}) =>
  c.app.inject({ method: 'POST', url: '/api/operator/bot-setup/confirm', headers, payload });

it('previews only the browser-bound account and grants no conversion authority to creator or operator credentials alone', () =>
  withPending(async (c) => {
    expect(c.cookie).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/api/operator/bot-setup',
    });
    const preview = await c.app.inject({ url: '/api/operator/bot-setup', headers: c.headers });
    expect(preview.json()).toEqual({
      pending: { accountLabel: 'fixture_99', expiresAt: expect.any(String) },
    });
    expect(preview.headers['cache-control']).toBe('no-store');
    expect((await c.app.inject('/api/operator/bot-setup')).json()).toEqual({ pending: null });
    for (const headers of [
      browserHeader,
      c.creatorHeaders,
      c.otherHeaders,
      { ...browserHeader, authorization: `Bearer ${liveConfig.botSetupSecret}` },
      { ...browserHeader, cookie: `torchline_bot_setup=${'00'.repeat(32)}` },
    ])
      expect((await confirm(c, headers)).statusCode).toBe(403);
    expect((await c.store.creator('99'))?.connected).toBe(true);
  }));

it('atomically converts only the confirmed account and preserves the other broadcaster and Ark', () =>
  withPending(async (c) => {
    const other = (await c.store.creator('42'))!;
    const worldId = await c.store.create(other);
    const before = (await c.store.get(worldId)).state;
    const response = await confirm(c);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ authorized: true, accountLabel: 'fixture_99' });
    expect((await c.store.creator('99'))?.connected).toBe(false);
    expect(
      (await c.store.pool.query("SELECT role FROM oauth_grants WHERE id='99'")).rows[0].role,
    ).toBe('bot');
    expect(
      (await c.store.pool.query("SELECT 1 FROM sessions WHERE channel_id='99'")).rowCount,
    ).toBe(0);
    expect(
      (await c.store.pool.query("SELECT 1 FROM overlay_grants WHERE channel_id='99'")).rowCount,
    ).toBe(0);
    expect((await c.app.inject({ url: '/api/state', headers: c.creatorHeaders })).statusCode).toBe(
      401,
    );
    expect((await c.app.inject({ url: '/api/state', headers: c.otherHeaders })).json().me.id).toBe(
      '42',
    );
    expect((await c.store.get(worldId)).state).toEqual(before);
    expect((await c.store.pool.query('SELECT 1 FROM bot_setup_confirmations')).rowCount).toBe(0);
  }));

it('rejects cross-origin conversion and client-supplied account substitution', () =>
  withPending(async (c) => {
    expect(
      (await confirm(c, { ...c.headers, origin: 'https://attacker.invalid' })).statusCode,
    ).toBe(403);
    expect((await confirm(c, c.headers, { accountId: '42' })).statusCode).toBe(400);
    expect((await c.store.creator('99'))?.connected).toBe(true);
    expect((await c.store.creator('42'))?.connected).toBe(true);
  }));

it('rechecks history after OAuth and preserves a world created before conversion', () =>
  withPending(async (c) => {
    const creator = (await c.store.creator('99'))!;
    const id = await c.store.create(creator);
    const before = (await c.store.get(id)).state;
    const response = await confirm(c);
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('BOT_CREATOR_HISTORY');
    expect((await c.store.creator('99'))?.connected).toBe(true);
    expect((await c.store.get(id)).state).toEqual(before);
    expect(
      (await c.store.pool.query("SELECT role FROM oauth_grants WHERE id='99'")).rows[0].role,
    ).toBe('creator');
  }));

it('consumes a conversion once under concurrent confirmation requests', () =>
  withPending(async (c) => {
    const responses = await Promise.all([confirm(c), confirm(c)]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 403]);
    expect((await confirm(c)).statusCode).toBe(403);
    expect((await c.store.pool.query("SELECT 1 FROM oauth_grants WHERE role='bot'")).rowCount).toBe(
      1,
    );
  }));

it('cancels a pending conversion without ending creator access', () =>
  withPending(async (c) => {
    const response = await c.app.inject({
      method: 'POST',
      url: '/api/operator/bot-setup/cancel',
      headers: c.headers,
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect((await confirm(c)).statusCode).toBe(403);
    expect(
      (await c.app.inject({ url: '/api/state', headers: c.creatorHeaders })).json().me.id,
    ).toBe('99');
    expect(
      (await c.store.pool.query("SELECT role FROM oauth_grants WHERE id='99'")).rows[0].role,
    ).toBe('creator');
  }));

it.each(['revoked', 'wrong-account'] as const)(
  'revalidates the pending Twitch grant before conversion (%s)',
  (validation) =>
    withPending(async (c) => {
      c.setValidation(validation);
      expect((await confirm(c)).statusCode).toBe(validation === 'revoked' ? 409 : 403);
      expect((await c.store.creator('99'))?.connected).toBe(true);
      expect(
        (await c.store.pool.query("SELECT role FROM oauth_grants WHERE id='99'")).rows[0].role,
      ).toBe('creator');
    }),
);

it('expires pending grants and isolates cleanup and conversion from simulation workers', () =>
  withPending(async (c) => {
    await c.store.pool.query(
      "UPDATE bot_setup_confirmations SET expires_at=now()-interval '1 second'",
    );
    const simulation = twitchBotSetup(
      c.store,
      { ...liveConfig, mode: 'simulation' },
      c.provider.fetcher,
    );
    await simulation.expire();
    expect((await c.store.pool.query('SELECT 1 FROM bot_setup_confirmations')).rowCount).toBe(1);
    await expect(simulation.confirm(c.token)).rejects.toMatchObject({ code: 'MODE_MISMATCH' });
    expect((await confirm(c)).statusCode).toBe(403);
    await twitchBotSetup(c.store, liveConfig, c.provider.fetcher).expire();
    expect((await c.store.pool.query('SELECT 1 FROM bot_setup_confirmations')).rowCount).toBe(0);
  }));
