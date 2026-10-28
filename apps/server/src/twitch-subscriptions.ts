import { z } from 'zod';
import { DomainError } from '@torchline/contracts';
import type { TwitchIntegrationStatus } from '@torchline/contracts';
import type { Store, Creator } from '@torchline/storage';
import { BOT_SCOPES, CREATOR_SCOPES, helix } from '@torchline/twitch';
import type { Fetcher, WebhookNotification } from '@torchline/twitch';
import type { AppConfig } from './app.ts';

const active = ['enabled', 'webhook_callback_verification_pending'];
export const callbackUrl = (config: AppConfig) =>
  `${new URL(config.baseUrl).origin}/integrations/twitch/eventsub`;
export function desiredSubscriptions(
  creator: Pick<Creator, 'id' | 'receive_opt_in'>,
  botId: string,
) {
  return [
    {
      type: 'channel.chat.message',
      version: '1',
      condition: { broadcaster_user_id: creator.id, user_id: botId } as Record<string, string>,
    },
    {
      type: 'stream.online',
      version: '1',
      condition: { broadcaster_user_id: creator.id } as Record<string, string>,
    },
    {
      type: 'stream.offline',
      version: '1',
      condition: { broadcaster_user_id: creator.id } as Record<string, string>,
    },
    ...(creator.receive_opt_in
      ? [
          {
            type: 'channel.raid',
            version: '1',
            condition: { to_broadcaster_user_id: creator.id } as Record<string, string>,
          },
        ]
      : []),
  ];
}
const sameCondition = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(a).every(([key, value]) => b[key] === value);
const ProviderSubscription = z.object({
  id: z.string().min(1),
  type: z.string(),
  version: z.string(),
  status: z.string(),
  condition: z.record(z.string(), z.string()),
  transport: z.object({ method: z.string(), callback: z.string().optional() }),
});
type Subscription = z.infer<typeof ProviderSubscription>;
const Page = z.object({
  data: z.array(ProviderSubscription),
  pagination: z.object({ cursor: z.string().optional() }).optional(),
});
export async function listProviderSubscriptions(
  clientId: string,
  token: string,
  fetcher: Fetcher = fetch,
) {
  const result: Subscription[] = [],
    cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = Page.parse(
      await helix(
        `eventsub/subscriptions?first=100${cursor ? `&after=${encodeURIComponent(cursor)}` : ''}`,
        clientId,
        token,
        {},
        fetcher,
      ),
    );
    result.push(...page.data);
    cursor = page.pagination?.cursor;
    if (cursor && (cursors.has(cursor) || cursors.size >= 100))
      throw new DomainError('TWITCH_API_FAILED', 'Subscription pagination did not terminate.');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return result;
}
export async function hasCurrentSubscription(
  store: Store,
  config: AppConfig,
  channel: string,
  type: string,
  botId: string,
) {
  const condition =
    type === 'channel.raid'
      ? { to_broadcaster_user_id: channel }
      : { broadcaster_user_id: channel, user_id: botId };
  return Boolean(
    (
      await store.pool.query(
        "SELECT 1 FROM subscriptions WHERE channel_id=$1 AND type=$2 AND status='enabled' AND version='1' AND callback=$3 AND condition=$4::jsonb AND confirmed_at IS NOT NULL",
        [channel, type, callbackUrl(config), JSON.stringify(condition)],
      )
    ).rowCount,
  );
}

export function twitchSubscriptions(
  store: Store,
  config: AppConfig,
  fetcher: Fetcher,
  applicationToken: () => Promise<string>,
) {
  const inFlight = new Map<string, Promise<void>>();
  async function bot() {
    return (
      await store.pool.query(
        "SELECT id FROM oauth_grants WHERE role='bot' AND scopes @> $1::text[] AND validated_at>now()-interval '1 hour' LIMIT 1",
        [BOT_SCOPES],
      )
    ).rows[0]?.id as string | undefined;
  }
  async function current(channel: string) {
    const creator = await store.creator(channel);
    const fresh = (
      await store.pool.query(
        "SELECT 1 FROM oauth_grants WHERE id=$1 AND role='creator' AND scopes @> $2::text[] AND validated_at>now()-interval '1 hour'",
        [channel, CREATOR_SCOPES],
      )
    ).rowCount;
    if (
      config.mode !== 'live' ||
      !creator ||
      creator.mode !== 'live' ||
      !creator.connected ||
      !fresh
    )
      throw new DomainError(
        'FORBIDDEN',
        'A connected broadcaster with current consent is required.',
      );
    return creator;
  }
  async function save(sub: Subscription, channel: string, confirmed: boolean) {
    // Terminal subscription IDs stay terminal. Twitch must issue a new ID after revocation.
    await store.pool.query(
      `INSERT INTO subscriptions(id,type,channel_id,status,version,condition,callback,verified_at,confirmed_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $4='enabled' THEN now() END,CASE WHEN $8 THEN now() END)
       ON CONFLICT(id) DO UPDATE SET
         status=CASE WHEN subscriptions.status='enabled' AND EXCLUDED.status='webhook_callback_verification_pending' THEN subscriptions.status ELSE EXCLUDED.status END,
         version=EXCLUDED.version,condition=EXCLUDED.condition,callback=EXCLUDED.callback,
         verified_at=COALESCE(subscriptions.verified_at,EXCLUDED.verified_at),
         confirmed_at=COALESCE(EXCLUDED.confirmed_at,subscriptions.confirmed_at)
       WHERE subscriptions.channel_id=EXCLUDED.channel_id AND subscriptions.type=EXCLUDED.type
         AND subscriptions.status IN ('enabled','webhook_callback_verification_pending')
         AND (subscriptions.callback='' OR (subscriptions.version=EXCLUDED.version AND subscriptions.condition=EXCLUDED.condition AND subscriptions.callback=EXCLUDED.callback))`,
      [
        sub.id,
        sub.type,
        channel,
        sub.status,
        sub.version,
        JSON.stringify(sub.condition),
        sub.transport.callback ?? '',
        confirmed,
      ],
    );
  }
  async function observe(notification: WebhookNotification) {
    const sub = ProviderSubscription.parse(notification.subscription);
    const channel = sub.condition.to_broadcaster_user_id ?? sub.condition.broadcaster_user_id ?? '';
    if (config.mode !== 'live')
      throw new DomainError('MODE_MISMATCH', 'Live EventSub is disabled in simulation.');
    const known = (await store.pool.query('SELECT * FROM subscriptions WHERE id=$1', [sub.id]))
      .rows[0];
    const knownMatches =
      known &&
      known.channel_id === channel &&
      known.type === sub.type &&
      known.version === sub.version &&
      known.callback === sub.transport.callback &&
      sameCondition(known.condition, sub.condition);
    if (notification.type === 'revocation') {
      if (active.includes(sub.status))
        throw new DomainError('FORBIDDEN', 'Unknown subscription revocation.');
      if (known) {
        if (!knownMatches)
          throw new DomainError('FORBIDDEN', 'Revocation identity does not match.');
        await store.pool.query('UPDATE subscriptions SET status=$2 WHERE id=$1', [
          sub.id,
          sub.status,
        ]);
      } else {
        // A revocation can beat both the creation response and the first challenge.
        const owner = await store.creator(channel);
        const shape = desiredSubscriptions(
          { id: channel, receive_opt_in: true },
          sub.condition.user_id ?? '',
        ).find((item) => item.type === sub.type);
        if (
          !owner ||
          owner.mode !== 'live' ||
          !shape ||
          sub.version !== shape.version ||
          !sameCondition(sub.condition, shape.condition) ||
          sub.transport.method !== 'webhook' ||
          sub.transport.callback !== callbackUrl(config)
        )
          throw new DomainError('FORBIDDEN', 'Unknown subscription revocation.');
        await save(sub, channel, false);
      }
      await record(notification.id, channel, sub.id, 'revocation');
      return { channel, challenge: false };
    }
    const creator = await current(channel);
    const botId = await bot();
    const expected = desiredSubscriptions(creator, botId ?? '').find(
      (item) => item.type === sub.type,
    );
    if (
      !expected ||
      sub.version !== expected.version ||
      !sameCondition(sub.condition, expected.condition) ||
      sub.transport.method !== 'webhook' ||
      sub.transport.callback !== callbackUrl(config) ||
      (sub.type === 'channel.chat.message' && !botId)
    )
      throw new DomainError(
        'FORBIDDEN',
        'Subscription identity does not match the current channel, bot or callback.',
      );
    if (notification.type === 'webhook_callback_verification') {
      if (!notification.challenge) throw new DomainError('INVALID_EVENT', 'Challenge missing.');
      await save({ ...sub, status: 'enabled' }, channel, false);
      await record(notification.id, channel, sub.id, 'challenge');
      return { channel, challenge: true };
    }
    if (
      !knownMatches ||
      known.status !== 'enabled' ||
      sub.status !== 'enabled' ||
      !known.confirmed_at
    )
      throw new DomainError(
        'FORBIDDEN',
        'The enabled subscription has not been confirmed by Twitch reconciliation.',
      );
    return { channel, challenge: false };
  }
  async function record(id: string, channel: string, subscription: string, kind: string) {
    await store.pool.query(
      'INSERT INTO integration_deliveries(message_id,channel_id,subscription_id,kind) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [id, channel, subscription, kind],
    );
  }
  async function perform(channel: string) {
    const creator = await current(channel);
    const botId = await bot();
    if (
      new URL(config.baseUrl).protocol !== 'https:' ||
      !config.eventsubSecret ||
      config.eventsubSecret.length < 10 ||
      config.eventsubSecret.length > 100
    )
      throw new DomainError(
        'NOT_CONFIGURED',
        'Public HTTPS and a 10–100 character EventSub secret are required.',
      );
    if (!botId)
      throw new DomainError(
        'NOT_CONFIGURED',
        'Authorize the dedicated bot with the required permissions.',
      );
    const token = await applicationToken();
    const provider = await listProviderSubscriptions(config.twitchClientId!, token, fetcher);
    const wanted = desiredSubscriptions(creator, botId);
    const matches = (sub: Subscription) =>
      wanted.some(
        (spec) =>
          spec.type === sub.type &&
          spec.version === sub.version &&
          sameCondition(spec.condition, sub.condition),
      ) &&
      sub.transport.method === 'webhook' &&
      sub.transport.callback === callbackUrl(config);
    const owned = (
      await store.pool.query('SELECT * FROM subscriptions WHERE channel_id=$1', [channel])
    ).rows;
    const deleted = new Set<string>();
    for (const row of owned) {
      const remote = provider.find((sub) => sub.id === row.id);
      if (
        remote &&
        (!matches(remote) || !active.includes(row.status) || !active.includes(remote.status))
      ) {
        await helix(
          `eventsub/subscriptions?id=${encodeURIComponent(row.id)}`,
          config.twitchClientId!,
          token,
          { method: 'DELETE' },
          fetcher,
        );
        deleted.add(row.id);
        await store.pool.query(
          "UPDATE subscriptions SET status=CASE WHEN status IN ('enabled','webhook_callback_verification_pending') THEN 'configuration_changed' ELSE status END WHERE id=$1",
          [row.id],
        );
      } else if (!remote && active.includes(row.status)) {
        await store.pool.query("UPDATE subscriptions SET status='provider_missing' WHERE id=$1", [
          row.id,
        ]);
      }
    }
    for (const spec of wanted) {
      let sub = provider.find(
        (item) =>
          !deleted.has(item.id) &&
          matches(item) &&
          item.type === spec.type &&
          active.includes(item.status),
      );
      if (!sub)
        sub = Page.parse(
          await helix(
            'eventsub/subscriptions',
            config.twitchClientId!,
            token,
            {
              method: 'POST',
              body: JSON.stringify({
                ...spec,
                transport: {
                  method: 'webhook',
                  callback: callbackUrl(config),
                  secret: config.eventsubSecret,
                },
              }),
            },
            fetcher,
          ),
        ).data[0];
      if (!sub || !matches(sub))
        throw new DomainError(
          'TWITCH_API_FAILED',
          'Twitch returned an unexpected subscription identity.',
        );
      await save(sub, channel, true);
      if ((await bot()) !== botId) {
        await store.pool.query(
          "UPDATE subscriptions SET status='configuration_changed' WHERE id=$1",
          [sub.id],
        );
        throw new DomainError(
          'SUBSCRIPTION_UNREADY',
          'Bot changed during reconciliation; retry with the current identity.',
        );
      }
    }
  }
  function reconcile(channel: string) {
    const existing = inFlight.get(channel);
    if (existing) return existing;
    const run = perform(channel)
      .then(
        async () => {
          await store.pool.query(
            'UPDATE creators SET reconciled_at=now(),reconcile_error=NULL WHERE id=$1',
            [channel],
          );
        },
        async (error: unknown) => {
          await store.pool.query(
            'UPDATE creators SET reconciled_at=now(),reconcile_error=$2 WHERE id=$1',
            [channel, error instanceof DomainError ? error.code : 'DEPENDENCY_FAILURE'],
          );
          throw error;
        },
      )
      .finally(() => inFlight.delete(channel));
    inFlight.set(channel, run);
    return run;
  }
  async function reconcileAll() {
    if (
      config.mode !== 'live' ||
      !config.twitchClientId ||
      !config.twitchClientSecret ||
      new URL(config.baseUrl).protocol !== 'https:'
    )
      return;
    const rows = (
      await store.pool.query(
        "SELECT c.id FROM creators c JOIN oauth_grants g ON g.id=c.id AND g.role='creator' WHERE c.connected AND c.mode='live' AND g.validated_at>now()-interval '1 hour' ORDER BY reconciled_at NULLS FIRST LIMIT 5",
      )
    ).rows;
    await Promise.allSettled(rows.map((row) => reconcile(row.id)));
  }
  async function status(channel: string): Promise<TwitchIntegrationStatus> {
    const creator = await store.creator(channel);
    const botId = await bot();
    const rows = (
      await store.pool.query(
        'SELECT * FROM subscriptions WHERE channel_id=$1 ORDER BY confirmed_at DESC NULLS LAST',
        [channel],
      )
    ).rows;
    const specs = desiredSubscriptions(
      creator ?? { id: channel, receive_opt_in: false },
      botId ?? '',
    );
    const subscriptions = specs.map((spec) => {
      const matches = rows.filter(
        (row) =>
          row.type === spec.type &&
          row.version === spec.version &&
          row.callback === callbackUrl(config) &&
          sameCondition(row.condition, spec.condition),
      );
      const row = matches.find((row) => row.status === 'enabled') ?? matches[0];
      return {
        type: spec.type,
        status: row?.status ?? 'missing',
        current: Boolean(row),
        providerConfirmed: Boolean(row?.confirmed_at),
      };
    });
    const counts = (
      await store.pool.query(
        'SELECT kind,count(*)::integer AS count FROM integration_deliveries WHERE channel_id=$1 GROUP BY kind',
        [channel],
      )
    ).rows;
    const count = (kind: string) => counts.find((row) => row.kind === kind)?.count ?? 0;
    const applied = (
      await store.pool.query(
        "SELECT count(*)::integer AS count FROM eventsub_inbox WHERE processed_at IS NOT NULL AND error IS NULL AND payload->>'kind'='chat' AND payload->>'channelId'=$1",
        [channel],
      )
    ).rows[0].count;
    const custody = (
      await store.pool.query(
        "SELECT count(*)::integer AS count FROM custody_events WHERE mode='live' AND (source_id=$1 OR target_id=$1)",
        [channel],
      )
    ).rows[0].count;
    const audit = (
      await store.pool.query('SELECT reconciled_at,reconcile_error FROM creators WHERE id=$1', [
        channel,
      ])
    ).rows[0];
    const replies = (
      await store.pool.query(
        'SELECT status,count(*)::integer AS count FROM bot_replies WHERE channel_id=$1 GROUP BY status',
        [channel],
      )
    ).rows;
    const replyCount = (status: string) => replies.find((row) => row.status === status)?.count ?? 0;
    const ready = (type: string) =>
      subscriptions.some(
        (sub) =>
          sub.type === type && sub.status === 'enabled' && sub.current && sub.providerConfirmed,
      );
    const inbox = (
      await store.pool.query(
        `SELECT count(*) FILTER(WHERE processed_at IS NULL)::integer AS pending,count(*) FILTER(WHERE processed_at IS NULL AND attempts>0)::integer AS retrying,count(*) FILTER(WHERE error='RETRY_EXHAUSTED')::integer AS quarantined,min(received_at) FILTER(WHERE processed_at IS NULL) AS oldest FROM eventsub_inbox WHERE payload->>'channelId'=$1`,
        [channel],
      )
    ).rows[0];
    return {
      inbox: {
        pending: inbox.pending,
        retrying: inbox.retrying,
        quarantined: inbox.quarantined,
        oldestAt: inbox.oldest?.toISOString() ?? null,
      },
      botAuthorized: Boolean(botId),
      chatReady: Boolean(botId) && ready('channel.chat.message'),
      raidReady: ready('channel.raid'),
      lastReconciledAt: audit?.reconciled_at?.toISOString() ?? null,
      reconcileError: audit?.reconcile_error ?? null,
      botReplies: {
        pending: replyCount('pending') + replyCount('sending'),
        sent: replyCount('sent'),
        failed: replyCount('failed'),
        uncertain: replyCount('uncertain'),
      },
      subscriptions,
      deliveries: {
        challenge: count('challenge'),
        chat: count('chat'),
        raid: count('raid'),
        appliedChat: applied,
        custodyChanges: custody,
      },
    };
  }
  return { observe, reconcile, reconcileAll, record, status };
}
