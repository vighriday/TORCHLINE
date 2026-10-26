import { expect, it } from 'vitest';
import { encryptSecret, decryptSecret, BOT_SCOPES, CREATOR_SCOPES } from '@torchline/twitch';
import type { Fetcher } from '@torchline/twitch';
import { twitchLifecycle } from '../apps/server/src/twitch-lifecycle.ts';
import { database } from './helpers.ts';
const config = {
  mode: 'live' as const,
  baseUrl: 'https://fixture.invalid',
  sessionSecret: 'ab'.repeat(32),
  tokenKey: 'cd'.repeat(32),
  botSetupSecret: 'test',
  twitchClientId: 'client',
  twitchClientSecret: 'secret',
};
it.each([false, true])(
  'preserves a newly authorized grant when obsolete validation finishes late (refresh=%s)',
  (refresh) =>
    database(async (store) => {
      await store.ensureCreator('42', 'Creator', 'live');
      const original = encryptSecret(
        { access_token: 'old', ...(refresh ? { refresh_token: 'old-refresh' } : {}) },
        config.tokenKey,
      );
      await store.pool.query(
        "INSERT INTO oauth_grants(id,role,scopes,encrypted) VALUES('42','creator',$1,$2)",
        [CREATOR_SCOPES, original],
      );
      let entered: () => void = () => {};
      let release: () => void = () => {};
      const waiting = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const fetcher: Fetcher = async (input, init) => {
        if ((init?.headers as Record<string, string> | undefined)?.Authorization === 'OAuth old') {
          entered();
          await gate;
          return new Response('', { status: 401 });
        }
        if (String(input).endsWith('/token'))
          return Response.json({
            access_token: 'obsolete-refresh-result',
            refresh_token: 'obsolete-refresh-pair',
            expires_in: 3600,
          });
        return Response.json({
          client_id: 'client',
          user_id: '42',
          scopes: CREATOR_SCOPES,
          expires_in: 3600,
        });
      };
      const validation = twitchLifecycle(store, config, fetcher).validateGrants(true);
      await waiting;
      try {
        const replacement = encryptSecret(
          { access_token: 'reauthorized', refresh_token: 'reauthorized-pair' },
          config.tokenKey,
        );
        await store.pool.query(
          "UPDATE oauth_grants SET encrypted=$1,validated_at=now() WHERE id='42'",
          [replacement],
        );
      } finally {
        release();
      }
      await validation;
      const grant = (await store.pool.query("SELECT encrypted FROM oauth_grants WHERE id='42'"))
        .rows[0];
      expect(decryptSecret(grant.encrypted, config.tokenKey)).toMatchObject({
        access_token: 'reauthorized',
        refresh_token: 'reauthorized-pair',
      });
      expect((await store.creator('42'))?.connected).toBe(true);
    }),
);
it('serializes refresh, revalidates identity/scopes and atomically stores the new token pair', () =>
  database(async (store) => {
    await store.ensureCreator('42', 'Creator', 'live');
    await store.pool.query(
      "INSERT INTO oauth_grants(id,role,scopes,encrypted,validated_at) VALUES('42','creator',$1,$2,now()-interval '2 hours')",
      [
        ['channel:bot'],
        encryptSecret({ access_token: 'expired', refresh_token: 'refresh-old' }, config.tokenKey),
      ],
    );
    let refreshes = 0;
    const fetcher: Fetcher = async (input, init) => {
      if (String(input).endsWith('/token')) {
        refreshes++;
        return Response.json({
          access_token: 'new-token',
          refresh_token: 'refresh-new',
          expires_in: 3600,
        });
      }
      if ((init?.headers as Record<string, string>).Authorization === 'OAuth expired')
        return new Response('', { status: 401 });
      return Response.json({
        client_id: 'client',
        user_id: '42',
        scopes: ['channel:bot'],
        expires_in: 3600,
      });
    };
    const lifecycle = twitchLifecycle(store, config, fetcher);
    await Promise.all([lifecycle.validateGrants(true), lifecycle.validateGrants(true)]);
    expect(refreshes).toBe(1);
    const grant = (await store.pool.query('SELECT * FROM oauth_grants')).rows[0];
    expect(decryptSecret(grant.encrypted, config.tokenKey)).toMatchObject({
      access_token: 'new-token',
      refresh_token: 'refresh-new',
    });
    expect(Date.now() - grant.validated_at.getTime()).toBeLessThan(5000);
  }));
it('removes sessions on confirmed revocation but preserves credentials on provider outage', () =>
  database(async (store) => {
    await store.ensureCreator('42', 'Creator', 'live');
    await store.pool.query(
      "INSERT INTO oauth_grants(id,role,scopes,encrypted) VALUES('42','creator',$1,$2)",
      [['channel:bot'], encryptSecret({ access_token: 'fixture' }, config.tokenKey)],
    );
    await store.pool.query(
      "INSERT INTO sessions(hash,channel_id,expires_at) VALUES('fixture-session','42',now()+interval '1 hour')",
    );
    await twitchLifecycle(
      store,
      config,
      async () => new Response('', { status: 503 }),
    ).validateGrants(true);
    expect((await store.pool.query('SELECT * FROM oauth_grants')).rowCount).toBe(1);
    await twitchLifecycle(
      store,
      config,
      async () => new Response('', { status: 401 }),
    ).validateGrants(true);
    expect((await store.pool.query('SELECT * FROM sessions')).rowCount).toBe(0);
    expect((await store.creator('42'))?.connected).toBe(false);
  }));
it('gates live handoff on fresh grants, enabled subscriptions and actual stream response', () =>
  database(async (store) => {
    for (const id of ['a', 'b', 'bot'])
      await store.pool.query(
        'INSERT INTO oauth_grants(id,role,scopes,encrypted) VALUES($1,$2,$3,$4)',
        [
          id,
          id === 'bot' ? 'bot' : 'creator',
          id === 'bot' ? BOT_SCOPES : CREATOR_SCOPES,
          encryptSecret({ access_token: 'fixture' }, config.tokenKey),
        ],
      );
    const fetcher: Fetcher = async (input) =>
      String(input).endsWith('/token')
        ? Response.json({ access_token: 'app', expires_in: 3600 })
        : Response.json({ data: [{ user_id: 'a' }, { user_id: 'b' }] });
    const lifecycle = twitchLifecycle(store, config, fetcher);
    await expect(lifecycle.readyForTransfer('a', 'b')).rejects.toMatchObject({
      code: 'SUBSCRIPTION_UNREADY',
    });
    await store.pool.query(
      "INSERT INTO subscriptions(id,type,channel_id,status) VALUES('a-chat','channel.chat.message','a','enabled'),('b-chat','channel.chat.message','b','enabled'),('b-raid','channel.raid','b','enabled')",
    );
    await store.pool.query(
      "UPDATE subscriptions SET version='1',condition=CASE WHEN type='channel.raid' THEN jsonb_build_object('to_broadcaster_user_id',channel_id) ELSE jsonb_build_object('broadcaster_user_id',channel_id,'user_id','bot') END,callback=$1,confirmed_at=now()",
      [`${config.baseUrl}/integrations/twitch/eventsub`],
    );
    await expect(lifecycle.readyForTransfer('a', 'b')).resolves.toBeUndefined();
    const offline = twitchLifecycle(store, config, async (input) =>
      String(input).endsWith('/token')
        ? Response.json({ access_token: 'app', expires_in: 3600 })
        : Response.json({ data: [{ user_id: 'a' }] }),
    );
    await expect(offline.readyForTransfer('a', 'b')).rejects.toMatchObject({
      code: 'TARGET_OFFLINE',
    });
  }));
