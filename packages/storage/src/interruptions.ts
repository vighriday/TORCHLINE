import { applyCommand } from '@torchline/engine';
import { DomainError } from '@torchline/contracts';
import type { Store, Creator } from './index.ts';
import { syncEpisode } from './episodes.ts';
import { recoverLivewire } from './livewire.ts';

export const CHAT_INTERRUPTED = 'Twitch chat is unavailable. Repair the connection, then resume.';

/** Internal work, never native Twitch evidence. Freeze first; drain accepted input before pause. */
export async function interruptEpisode(store: Store, channel: string, mode: Creator['mode']) {
  if (mode !== 'live') return false;
  await recoverLivewire(store, mode, 'chat_unavailable', channel);
  return store.transaction(async (c) => {
    await store.lockChannels(c, [channel]);
    const world = (
      await c.query(
        'SELECT w.* FROM worlds w JOIN channel_slots s ON s.world_id=w.id WHERE s.channel_id=$1 AND w.mode=$2 FOR UPDATE OF w',
        [channel, mode],
      )
    ).rows[0];
    if (
      !world ||
      world.frozen_by ||
      !['investigation', 'challenge', 'allocation', 'decision'].includes(world.state.phase)
    )
      return false;
    const id = `interruption:${world.id}:${world.state.window}`;
    if ((await c.query('SELECT 1 FROM eventsub_inbox WHERE message_id=$1', [id])).rowCount)
      return false;
    const clock = (
      await c.query('SELECT * FROM episode_clocks WHERE world_id=$1 FOR UPDATE', [world.id])
    ).rows[0];
    const at = (await c.query('SELECT clock_timestamp() AS at')).rows[0].at as Date;
    const remainingMs = clock?.deadline_at
      ? Math.max(0, clock.deadline_at.getTime() - at.getTime())
      : (clock?.remaining_ms ?? null);
    await c.query('INSERT INTO eventsub_inbox(message_id,type,payload) VALUES($1,$2,$3)', [
      id,
      'torchline.episode.interruption',
      {
        kind: 'interruption',
        mode,
        channelId: channel,
        worldId: world.id,
        window: world.state.window,
        remainingMs,
        reason: CHAT_INTERRUPTED,
      },
    ]);
    await c.query(
      'UPDATE episode_clocks SET deadline_at=NULL,remaining_ms=$2,recovery_reason=$3 WHERE world_id=$1',
      [world.id, remainingMs, CHAT_INTERRUPTED],
    );
    await c.query('UPDATE worlds SET revision=revision+1 WHERE id=$1', [world.id]);
    await c.query('INSERT INTO outbox(world_id,revision) VALUES($1,$2)', [
      world.id,
      world.revision + 1,
    ]);
    return true;
  });
}

export async function settleInterruption(store: Store, message: string, mode: Creator['mode']) {
  if (mode !== 'live') return;
  const info = (
    await store.pool.query(
      "SELECT payload FROM eventsub_inbox WHERE message_id=$1 AND type='torchline.episode.interruption' AND processed_at IS NULL",
      [message],
    )
  ).rows[0]?.payload;
  if (!info || info.mode !== mode) return;
  await store.transaction(async (c) => {
    await store.lockChannels(c, [info.channelId]);
    const world = (await c.query('SELECT * FROM worlds WHERE id=$1 FOR UPDATE', [info.worldId]))
      .rows[0];
    const work = (
      await c.query('SELECT processed_at FROM eventsub_inbox WHERE message_id=$1 FOR UPDATE', [
        message,
      ])
    ).rows[0];
    if (!work || work.processed_at) return;
    const current =
      world &&
      world.mode === mode &&
      world.custodian_id === info.channelId &&
      world.state.window === info.window &&
      !world.frozen_by &&
      ['investigation', 'challenge', 'allocation', 'decision'].includes(world.state.phase) &&
      (
        await c.query('SELECT 1 FROM channel_slots WHERE channel_id=$1 AND world_id=$2', [
          info.channelId,
          info.worldId,
        ])
      ).rowCount;
    if (current) {
      if (
        (
          await c.query(
            "SELECT 1 FROM eventsub_inbox WHERE processed_at IS NULL AND payload->>'kind'='chat' AND payload->>'worldId'=$1 LIMIT 1",
            [world.id],
          )
        ).rowCount
      )
        throw new DomainError(
          'INPUT_PENDING',
          'Draining already accepted chat before recording the connection pause.',
        );
      const at = (await c.query('SELECT clock_timestamp() AS at')).rows[0].at as Date;
      const next = applyCommand(
        world.state,
        { type: 'pause' },
        { id: 'episode-interruption', role: 'host', community: info.channelId },
        { commandId: message, at: at.toISOString() },
      );
      await syncEpisode(c, world.state, next.state, at);
      await c.query(
        'UPDATE episode_clocks SET remaining_ms=$2,recovery_reason=$3 WHERE world_id=$1',
        [world.id, info.remainingMs, info.reason],
      );
      await c.query('UPDATE worlds SET state=$2,revision=revision+1,updated_at=now() WHERE id=$1', [
        world.id,
        next.state,
      ]);
      await c.query('INSERT INTO world_events(world_id,sequence,event) VALUES($1,$2,$3)', [
        world.id,
        next.event.sequence,
        next.event,
      ]);
      await c.query('INSERT INTO outbox(world_id,revision) VALUES($1,$2)', [
        world.id,
        world.revision + 1,
      ]);
    }
    await c.query(
      'UPDATE eventsub_inbox SET processed_at=clock_timestamp(),error=NULL WHERE message_id=$1',
      [message],
    );
  });
}
