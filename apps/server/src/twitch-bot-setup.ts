import { createHash, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { Store } from '@torchline/storage';
import { DomainError } from '@torchline/contracts';
import { BOT_SCOPES, decryptSecret, encryptSecret, validateToken } from '@torchline/twitch';
import type { Fetcher, OAuthTokens } from '@torchline/twitch';
import type { AppConfig } from './app.ts';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const invalid = (): never => {
  throw new DomainError(
    'FORBIDDEN',
    'Bot setup expired or already finished. Start dedicated bot authorization again.',
  );
};

export function twitchBotSetup(store: Store, config: AppConfig, fetcher: Fetcher) {
  function requireLive() {
    if (config.mode !== 'live')
      throw new DomainError('MODE_MISMATCH', 'Live bot setup is disabled in simulation.');
  }
  async function account(c: PoolClient, id: string, label: string) {
    const creator = (await c.query('SELECT connected,mode FROM creators WHERE id=$1', [id]))
      .rows[0];
    const history = (
      await c.query(
        'SELECT 1 WHERE EXISTS(SELECT 1 FROM worlds WHERE custodian_id=$1) OR EXISTS(SELECT 1 FROM handoffs WHERE source_id=$1 OR target_id=$1) OR EXISTS(SELECT 1 FROM custody_events WHERE source_id=$1 OR target_id=$1)',
        [id],
      )
    ).rowCount;
    if (history)
      throw new DomainError(
        'BOT_CREATOR_HISTORY',
        `The Twitch account "${label}" has Ark or handoff history and must remain a creator. Use a separate bot account. No worlds or history were deleted.`,
      );
    if (creator && creator.mode !== 'live')
      throw new DomainError('MODE_MISMATCH', 'A simulation account cannot become the live bot.');
    return creator;
  }
  async function activate(c: PoolClient, id: string, scopes: string[], encrypted: unknown) {
    const previous = (await c.query("SELECT id FROM oauth_grants WHERE role='bot'")).rows[0];
    if (previous && previous.id !== id)
      await c.query(
        "UPDATE subscriptions SET status='configuration_changed' WHERE type='channel.chat.message' AND status IN ('enabled','webhook_callback_verification_pending')",
      );
    await c.query("DELETE FROM oauth_grants WHERE role='bot'");
    await c.query(
      "INSERT INTO oauth_grants(id,role,scopes,encrypted) VALUES($1,'bot',$2,$3) ON CONFLICT(id) DO UPDATE SET role='bot',scopes=EXCLUDED.scopes,encrypted=EXCLUDED.encrypted,validated_at=now()",
      [id, scopes, encrypted],
    );
    await c.query('DELETE FROM bot_setup_confirmations');
  }
  async function authorize(id: string, label: string, scopes: string[], tokens: OAuthTokens) {
    requireLive();
    return store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(833017)');
      await store.lockChannels(c, [id]);
      const creator = await account(c, id, label);
      const encrypted = encryptSecret(tokens, config.tokenKey);
      if (creator?.connected) {
        const token = randomBytes(32).toString('hex');
        await c.query(
          'DELETE FROM bot_setup_confirmations WHERE expires_at<=now() OR account_id=$1',
          [id],
        );
        await c.query(
          'INSERT INTO bot_setup_confirmations(hash,account_id,label,scopes,encrypted) VALUES($1,$2,$3,$4,$5)',
          [digest(token), id, label, scopes, encrypted],
        );
        return token;
      }
      await activate(c, id, scopes, encrypted);
      return null;
    });
  }
  async function pending(token: string | undefined) {
    if (!token || !/^[a-f\d]{64}$/i.test(token)) return null;
    return (
      (
        await store.pool.query(
          'SELECT * FROM bot_setup_confirmations WHERE hash=$1 AND expires_at>now()',
          [digest(token)],
        )
      ).rows[0] ?? null
    );
  }
  async function preview(token: string | undefined) {
    if (config.mode !== 'live') return null;
    const row = await pending(token);
    return row
      ? { accountLabel: row.label as string, expiresAt: row.expires_at.toISOString() as string }
      : null;
  }
  async function confirm(token: string | undefined) {
    requireLive();
    const row = await pending(token);
    if (!row) return invalid();
    const credentials = decryptSecret<OAuthTokens>(row.encrypted, config.tokenKey);
    const identity = await validateToken(credentials.access_token, fetcher);
    if (
      identity.user_id !== row.account_id ||
      identity.client_id !== config.twitchClientId ||
      !BOT_SCOPES.every((scope) => identity.scopes.includes(scope)) ||
      (config.botUserId && config.botUserId !== identity.user_id)
    )
      throw new DomainError(
        'FORBIDDEN',
        'The pending bot authorization no longer matches this application or account. Start again.',
      );
    return store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(833017)');
      await store.lockChannels(c, [row.account_id]);
      const claim = await c.query(
        'DELETE FROM bot_setup_confirmations WHERE hash=$1 AND expires_at>now() RETURNING 1',
        [row.hash],
      );
      if (!claim.rowCount) return invalid();
      await account(c, row.account_id, row.label);
      await c.query('UPDATE creators SET connected=false,receive_opt_in=false WHERE id=$1', [
        row.account_id,
      ]);
      await c.query('DELETE FROM sessions WHERE channel_id=$1', [row.account_id]);
      await c.query('DELETE FROM overlay_grants WHERE channel_id=$1', [row.account_id]);
      await c.query(
        "UPDATE eventsub_inbox SET processed_at=now(),error='AUTH_ENDED' WHERE processed_at IS NULL AND payload->>'channelId'=$1",
        [row.account_id],
      );
      await c.query(
        "UPDATE subscriptions SET status='app_disconnected' WHERE channel_id=$1 AND status IN ('enabled','webhook_callback_verification_pending')",
        [row.account_id],
      );
      await activate(c, row.account_id, identity.scopes, row.encrypted);
      return { authorized: true, accountLabel: row.label as string };
    });
  }
  async function cancel(token: string | undefined) {
    requireLive();
    const row = await pending(token);
    if (!row) return invalid();
    const removed = await store.pool.query(
      'DELETE FROM bot_setup_confirmations WHERE hash=$1 RETURNING 1',
      [row.hash],
    );
    if (!removed.rowCount) return invalid();
  }
  async function expire() {
    if (config.mode === 'live')
      await store.pool.query('DELETE FROM bot_setup_confirmations WHERE expires_at<=now()');
  }
  return { authorize, preview, confirm, cancel, expire };
}
