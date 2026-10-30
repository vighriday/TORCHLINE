import { DomainError } from '@torchline/contracts';
import type { Store } from './index.ts';

/** Ages are generous: every window below is far longer than a broadcast or a provider retry. */
export interface RetentionPolicy {
  inboxDays: number;
  dedupDays: number;
  deliveredOutboxDays: number;
  expiredSessionHours: number;
  batch: number;
}
export const RETENTION_POLICY: RetentionPolicy = {
  inboxDays: 14,
  dedupDays: 14,
  deliveredOutboxDays: 7,
  expiredSessionHours: 24,
  batch: 2000,
};

export interface RetentionResult {
  foldedChat: number;
  foldedQuarantined: number;
  inbox: number;
  dedup: number;
  outbox: number;
  sessions: number;
  oauthStates: number;
  inputLimits: number;
  inputRejections: number;
}

interface DoomedInboxRow {
  message_id: string;
  channel_id: string | null;
  kind: string | null;
  error: string | null;
}

/**
 * Deletes only terminal operational rows, in bounded batches.
 *
 * Never touched: pending or retryable input, world events, custody events, raid proofs, handoffs,
 * command idempotency records and bot reply history. A sweep that would remove evidence of what a
 * world did is not a sweep this product may run.
 */
export async function sweepRetention(
  store: Store,
  policy: typeof RETENTION_POLICY = RETENTION_POLICY,
): Promise<RetentionResult> {
  for (const value of Object.values(policy))
    if (!Number.isInteger(value) || value < 1 || value > 100000)
      throw new DomainError('INVALID_RETENTION', 'Retention limits must be bounded whole numbers.');
  return store.transaction(async (c) => {
    const doomed = (
      await c.query(
        `SELECT message_id,payload->>'channelId' AS channel_id,payload->>'kind' AS kind,error
         FROM eventsub_inbox
         WHERE received_at < now() - ($1::integer * interval '1 day')
           AND (processed_at IS NOT NULL OR error IS NOT NULL)
         ORDER BY received_at LIMIT $2`,
        [policy.inboxDays, policy.batch],
      )
    ).rows as DoomedInboxRow[];
    // Lifetime diagnostics read these rows. Fold exactly the counts about to be deleted so a swept
    // channel keeps reporting the same applied and quarantined totals.
    const fold = async (
      kind: string,
      matches: (row: DoomedInboxRow & { channel_id: string }) => boolean,
    ) => {
      const totals = new Map<string, number>();
      for (const row of doomed)
        if (row.channel_id && matches(row as DoomedInboxRow & { channel_id: string }))
          totals.set(row.channel_id, (totals.get(row.channel_id) ?? 0) + 1);
      if (!totals.size) return 0;
      const channels = [...totals.keys()];
      const values = channels.map((channel) => totals.get(channel)!);
      await c.query(
        `INSERT INTO retention_totals(channel_id,kind,value)
         SELECT channel, $2, amount FROM unnest($1::text[],$3::bigint[]) AS folded(channel,amount)
         ON CONFLICT(channel_id,kind) DO UPDATE SET value=retention_totals.value+EXCLUDED.value`,
        [channels, kind, values],
      );
      return values.reduce((sum, value) => sum + value, 0);
    };
    const foldedChat = await fold(
      'applied_chat',
      (row) => row.error === null && row.kind === 'chat',
    );
    const foldedQuarantined = await fold('quarantined', (row) => row.error === 'RETRY_EXHAUSTED');
    const inbox = doomed.length
      ? ((
          await c.query('DELETE FROM eventsub_inbox WHERE message_id=ANY($1::text[])', [
            doomed.map((row) => row.message_id),
          ])
        ).rowCount ?? 0)
      : 0;
    const bounded = async (sql: string, parameters: unknown[]) =>
      (await c.query(sql, parameters)).rowCount ?? 0;
    const dedup = await bounded(
      `DELETE FROM chat_message_dedup WHERE (channel_id,message_id) IN (
         SELECT channel_id,message_id FROM chat_message_dedup
         WHERE received_at < now() - ($1::integer * interval '1 day') LIMIT $2)`,
      [policy.dedupDays, policy.batch],
    );
    const outbox = await bounded(
      `DELETE FROM outbox WHERE id IN (
         SELECT id FROM outbox WHERE delivered_at IS NOT NULL
           AND created_at < now() - ($1::integer * interval '1 day') LIMIT $2)`,
      [policy.deliveredOutboxDays, policy.batch],
    );
    const sessions = await bounded(
      `DELETE FROM sessions WHERE hash IN (
         SELECT hash FROM sessions WHERE expires_at < now() - ($1::integer * interval '1 hour')
         LIMIT $2)`,
      [policy.expiredSessionHours, policy.batch],
    );
    const oauthStates = await bounded(
      `DELETE FROM oauth_states WHERE hash IN (
         SELECT hash FROM oauth_states WHERE expires_at < now() - interval '1 hour' LIMIT $1)`,
      [policy.batch],
    );
    const inputLimits = await bounded(
      `DELETE FROM input_limits WHERE (world_id,input_window,subject) IN (
         SELECT world_id,input_window,subject FROM input_limits
         WHERE observed_at < now() - ($1::integer * interval '1 day') LIMIT $2)`,
      [policy.inboxDays, policy.batch],
    );
    const inputRejections = await bounded(
      `DELETE FROM input_rejections WHERE (world_id,input_window,reason) IN (
         SELECT world_id,input_window,reason FROM input_rejections
         WHERE world_id IN (SELECT id FROM worlds WHERE updated_at < now() - ($1::integer * interval '1 day'))
         LIMIT $2)`,
      [policy.inboxDays, policy.batch],
    );
    return {
      foldedChat,
      foldedQuarantined,
      inbox,
      dedup,
      outbox,
      sessions,
      oauthStates,
      inputLimits,
      inputRejections,
    };
  });
}
