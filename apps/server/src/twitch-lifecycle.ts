import type { Store } from '@torchline/storage';
import { DomainError } from '@torchline/contracts';
import {
  BOT_SCOPES,
  CREATOR_SCOPES,
  decryptSecret,
  encryptSecret,
  helix,
  requestToken,
  validateToken,
} from '@torchline/twitch';
import type { Fetcher, OAuthTokens } from '@torchline/twitch';
import type { AppConfig } from './app.ts';

export function twitchLifecycle(store: Store, config: AppConfig, fetcher: Fetcher) {
  let validating = false;
  let appToken: { value: string; expires: number } | null = null;
  async function applicationToken() {
    if (!config.twitchClientId || !config.twitchClientSecret)
      throw new DomainError('NOT_CONFIGURED', 'Twitch application credentials are missing.');
    if (!appToken || appToken.expires < Date.now()) {
      const token = await requestToken(
        {
          client_id: config.twitchClientId,
          client_secret: config.twitchClientSecret,
          grant_type: 'client_credentials',
        },
        fetcher,
      );
      appToken = {
        value: token.access_token,
        expires: Date.now() + Math.max(1, token.expires_in - 60) * 1000,
      };
    }
    return appToken.value;
  }
  async function validateGrants(force = false) {
    if (
      validating ||
      config.mode !== 'live' ||
      !config.twitchClientId ||
      !config.twitchClientSecret
    )
      return;
    validating = true;
    try {
      const rows = (
        await store.pool.query(
          "SELECT * FROM oauth_grants WHERE $1::boolean OR validated_at<now()-interval '55 minutes'",
          [force],
        )
      ).rows;
      for (const grant of rows) {
        try {
          let tokens = decryptSecret<OAuthTokens>(grant.encrypted, config.tokenKey);
          let identity;
          try {
            identity = await validateToken(tokens.access_token, fetcher);
          } catch (e) {
            if (
              !(e instanceof DomainError) ||
              e.code !== 'TWITCH_TOKEN_INVALID' ||
              !tokens.refresh_token
            )
              throw e;
            tokens = await requestToken(
              {
                client_id: config.twitchClientId!,
                client_secret: config.twitchClientSecret!,
                grant_type: 'refresh_token',
                refresh_token: tokens.refresh_token,
              },
              fetcher,
            );
            identity = await validateToken(tokens.access_token, fetcher);
          }
          if (
            identity.client_id !== config.twitchClientId ||
            identity.user_id !== grant.id ||
            !(grant.role === 'bot' ? BOT_SCOPES : CREATOR_SCOPES).every((s) =>
              identity.scopes.includes(s),
            )
          )
            throw new DomainError('TWITCH_TOKEN_INVALID', 'Identity or required scopes changed.');
          await store.pool.query(
            'UPDATE oauth_grants SET encrypted=$2,scopes=$3,validated_at=now() WHERE id=$1',
            [grant.id, encryptSecret(tokens, config.tokenKey), identity.scopes],
          );
        } catch (e) {
          if (
            !(e instanceof DomainError) ||
            !['TWITCH_TOKEN_INVALID', 'TWITCH_AUTH_FAILED'].includes(e.code)
          )
            continue;
          await store.transaction(async (c) => {
            await c.query('DELETE FROM oauth_grants WHERE id=$1', [grant.id]);
            await c.query('DELETE FROM sessions WHERE channel_id=$1', [grant.id]);
            await c.query('UPDATE creators SET connected=false WHERE id=$1', [grant.id]);
            await c.query(
              "UPDATE subscriptions SET status='authorization_revoked' WHERE channel_id=$1 OR ($2='bot' AND type='channel.chat.message')",
              [grant.id, grant.role],
            );
          });
        }
      }
    } finally {
      validating = false;
    }
  }
  async function readyForTransfer(sourceId: string | null, targetId: string) {
    await validateGrants();
    const ids = sourceId ? [sourceId, targetId] : [targetId];
    for (const id of ids) {
      const grant = (
        await store.pool.query(
          "SELECT 1 FROM oauth_grants WHERE id=$1 AND role='creator' AND validated_at>now()-interval '1 hour'",
          [id],
        )
      ).rowCount;
      if (!grant)
        throw new DomainError('NOT_CONFIGURED', 'Both creators need valid Twitch grants.');
      if (
        !(
          await store.pool.query(
            "SELECT 1 FROM subscriptions WHERE channel_id=$1 AND type='channel.chat.message' AND status='enabled'",
            [id],
          )
        ).rowCount
      )
        throw new DomainError('SUBSCRIPTION_UNREADY', 'Both chat subscriptions must be enabled.');
    }
    if (
      !(
        await store.pool.query(
          "SELECT 1 FROM oauth_grants WHERE role='bot' AND validated_at>now()-interval '1 hour'",
        )
      ).rowCount
    )
      throw new DomainError('NOT_CONFIGURED', 'The dedicated bot must be authorized.');
    if (
      !(
        await store.pool.query(
          "SELECT 1 FROM subscriptions WHERE channel_id=$1 AND type='channel.raid' AND status='enabled'",
          [targetId],
        )
      ).rowCount
    )
      throw new DomainError(
        'SUBSCRIPTION_UNREADY',
        'The destination needs an enabled native raid subscription.',
      );
    const token = await applicationToken();
    const streams = await helix(
      `streams?${ids.map((id) => `user_id=${encodeURIComponent(id)}`).join('&')}`,
      config.twitchClientId!,
      token,
      {},
      fetcher,
    );
    if (
      !ids.every((id) => streams.data.some((stream: { user_id: string }) => stream.user_id === id))
    )
      throw new DomainError(
        'TARGET_OFFLINE',
        'Creators must be live when preparing; the receiver must stay live for acceptance.',
      );
  }
  return { validateGrants, applicationToken, readyForTransfer };
}
