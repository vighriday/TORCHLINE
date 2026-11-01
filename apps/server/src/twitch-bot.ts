import type { Store } from '@torchline/storage';
import type { WorldState } from '@torchline/contracts';
import { DomainError, attributeSummary } from '@torchline/contracts';
import { BOT_SCOPES, CREATOR_SCOPES, sendChatMessage } from '@torchline/twitch';
import type { Fetcher } from '@torchline/twitch';
import type { AppConfig } from './app.ts';
import { callbackUrl } from './twitch-subscriptions.ts';

export function twitchBot(
  store: Store,
  config: AppConfig,
  fetcher: Fetcher,
  applicationToken: () => Promise<string>,
) {
  let sending: Promise<void> | null = null;
  async function enqueue(
    id: string,
    channel: string,
    messageId: string,
    query: 'status' | 'history',
  ) {
    if (config.mode !== 'live')
      throw new DomainError('MODE_MISMATCH', 'Bot replies are disabled in simulation.');
    if (config.botRepliesEnabled === false) return;
    await store.transaction(async (c) => {
      await store.lockChannels(c, [channel]);
      const creator = (
        await c.query("SELECT id FROM creators WHERE id=$1 AND connected AND mode='live'", [
          channel,
        ])
      ).rows[0];
      if (!creator) return;
      const inserted = await c.query(
        'INSERT INTO chat_message_dedup(channel_id,message_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING 1',
        [channel, messageId],
      );
      if (!inserted.rowCount) return;
      const limit = (
        await c.query(
          'SELECT 1 FROM bot_channel_limits WHERE channel_id=$1 AND next_reply_at>now()',
          [channel],
        )
      ).rowCount;
      if (limit) return;
      const row = (
        await c.query(
          "SELECT w.id,w.state FROM channel_slots s JOIN worlds w ON w.id=s.world_id WHERE s.channel_id=$1 AND w.mode='live'",
          [channel],
        )
      ).rows[0];
      const state = row?.state as WorldState | undefined;
      let body = 'TORCHLINE: No active Ark. The broadcaster can create, resume or inherit a world.';
      if (state && query === 'status') {
        const r = state.resources;
        body = `TORCHLINE: Chapter ${state.chapter}/5, ${state.phase}${state.outcome ? `, ${state.outcome}` : ''}. Hull ${r.hull}, oxygen ${r.oxygen}, power ${r.power}, navigation ${r.navigation}, supplies ${r.supplies}, passengers ${r.passengers}. ${state.phase === 'challenge' ? (state.chapter === 3 ? 'Use !scan and !patch to complete the displayed repair work order.' : 'Use !scan to discover clues, then !route with a candidate path.') : state.phase === 'decision' ? 'Use !vote 1 or !vote 2; the host commits the final choice.' : 'The host controls when the next chapter starts.'}`;
      } else if (state) {
        const events = (
          await c.query(
            "SELECT e.event->>'summary' AS summary,e.event->'actor'->>'community' AS community,c.label FROM world_events e LEFT JOIN creators c ON c.id=e.event->'actor'->>'community' WHERE e.world_id=$1 AND e.event->'command'->>'type'='commit' ORDER BY e.sequence DESC LIMIT 2",
            [row.id],
          )
        ).rows;
        body = events.length
          ? `TORCHLINE history: ${events
              .reverse()
              .map((item) => attributeSummary(item.summary, item.community, item.label))
              .join(' | ')}`
          : 'TORCHLINE history: This Ark has not committed a chapter decision yet.';
      }
      await c.query(
        'INSERT INTO bot_replies(id,channel_id,body) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [id, channel, body.slice(0, 500)],
      );
      await c.query(
        "INSERT INTO bot_channel_limits(channel_id,next_reply_at) VALUES($1,now()+interval '10 seconds') ON CONFLICT(channel_id) DO UPDATE SET next_reply_at=EXCLUDED.next_reply_at",
        [channel],
      );
    });
  }
  async function recover() {
    if (config.mode === 'live')
      await store.pool.query(
        "UPDATE bot_replies SET status='uncertain',outcome_code='PROCESS_RESTART' WHERE status='sending'",
      );
  }
  async function perform() {
    if (config.mode !== 'live' || config.botRepliesEnabled === false) return;
    const reply = await store.transaction(async (c) => {
      const row = (
        await c.query(
          "SELECT * FROM bot_replies WHERE status='pending' ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1",
        )
      ).rows[0];
      if (!row) return null;
      if (Date.now() - row.created_at.getTime() > 30000) {
        await c.query(
          "UPDATE bot_replies SET status='failed',outcome_code='STALE_REPLY' WHERE id=$1",
          [row.id],
        );
        return null;
      }
      const bot = (
        await c.query(
          "SELECT id FROM oauth_grants WHERE role='bot' AND scopes @> $1::text[] AND validated_at>now()-interval '1 hour'",
          [BOT_SCOPES],
        )
      ).rows[0];
      const creator = (
        await c.query(
          "SELECT 1 FROM creators c JOIN oauth_grants g ON g.id=c.id AND g.role='creator' WHERE c.id=$1 AND c.connected AND c.mode='live' AND g.scopes @> $2::text[] AND g.validated_at>now()-interval '1 hour'",
          [row.channel_id, CREATOR_SCOPES],
        )
      ).rowCount;
      const subscription =
        bot &&
        (
          await c.query(
            "SELECT 1 FROM subscriptions WHERE channel_id=$1 AND type='channel.chat.message' AND status='enabled' AND version='1' AND callback=$2 AND confirmed_at IS NOT NULL AND condition=$3::jsonb",
            [
              row.channel_id,
              callbackUrl(config),
              JSON.stringify({ broadcaster_user_id: row.channel_id, user_id: bot.id }),
            ],
          )
        ).rowCount;
      if (!bot || !creator || !subscription) {
        await c.query(
          "UPDATE bot_replies SET status='failed',outcome_code='AUTH_UNREADY' WHERE id=$1",
          [row.id],
        );
        return null;
      }
      await c.query(
        'INSERT INTO bot_send_limits(bot_id,next_send_at) VALUES($1,now()) ON CONFLICT DO NOTHING',
        [bot.id],
      );
      const permitted = await c.query(
        "UPDATE bot_send_limits SET next_send_at=now()+interval '2 seconds' WHERE bot_id=$1 AND next_send_at<=now() RETURNING 1",
        [bot.id],
      );
      if (!permitted.rowCount) return null;
      await c.query(
        "UPDATE bot_replies SET status='sending',sender_id=$2,sending_at=clock_timestamp() WHERE id=$1",
        [row.id, bot.id],
      );
      return { ...row, botId: bot.id };
    });
    if (!reply) return;
    try {
      const result = await sendChatMessage(
        config.twitchClientId!,
        await applicationToken(),
        reply.channel_id,
        reply.botId,
        reply.body,
        fetcher,
      );
      await store.pool.query(
        'UPDATE bot_replies SET status=$2,provider_message_id=$3,outcome_code=$4 WHERE id=$1',
        [
          reply.id,
          result.is_sent ? 'sent' : 'failed',
          result.message_id || null,
          result.drop_reason?.code ?? null,
        ],
      );
    } catch (error) {
      const limited = error instanceof DomainError && error.code === 'TWITCH_RATE_LIMITED';
      await store.pool.query('UPDATE bot_replies SET status=$2,outcome_code=$3 WHERE id=$1', [
        reply.id,
        limited ? 'failed' : 'uncertain',
        error instanceof DomainError ? error.code : 'SEND_UNCERTAIN',
      ]);
      if (limited)
        await store.pool.query(
          "UPDATE bot_send_limits SET next_send_at=now()+interval '30 seconds' WHERE bot_id=$1",
          [reply.botId],
        );
    }
  }
  function tick() {
    if (sending) return sending;
    sending = perform().finally(() => {
      sending = null;
    });
    return sending;
  }
  async function close() {
    await sending;
  }
  return { enqueue, recover, tick, close };
}
