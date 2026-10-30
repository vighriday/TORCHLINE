import type { Store } from '@torchline/storage';

/** Read only. Presence of configured live records is evidence of backend delivery,
 * not visible chat/OBS, automatic game detection or genuine raid acceptance. */
export async function livewireAcceptance(store: Store) {
  return store.transaction(async (c) => {
    await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const table = (await c.query("SELECT to_regclass('livewire_stakes') IS NOT NULL AS present"))
      .rows[0].present;
    if (!table)
      return {
        status: 'not_deployed',
        signedBallots: 0,
        attestedEffects: 0,
        backendPathObserved: false,
      };
    const row = (
      await c.query(`SELECT w.id,w.state,l.id AS stake_id,l.status FROM worlds w JOIN channel_slots s ON s.world_id=w.id
    JOIN livewire_stakes l ON l.world_id=w.id AND l.id::text=w.state->'livewire'->'stake'->>'id'
    WHERE w.mode='live' ORDER BY w.updated_at DESC LIMIT 1`)
    ).rows[0];
    if (!row)
      return {
        status: 'waiting_for_live_mission',
        signedBallots: 0,
        attestedEffects: 0,
        backendPathObserved: false,
      };
    const ballots = (
      await c.query(
        `SELECT count(*)::integer AS n FROM eventsub_inbox i JOIN integration_deliveries d ON d.message_id=i.message_id
    WHERE i.type='channel.chat.message' AND d.kind='chat' AND d.channel_id=i.payload->>'channelId'
    AND i.processed_at IS NOT NULL AND i.error IS NULL AND i.payload->>'kind'='livewire_ballot'
    AND i.payload->>'accepted'='true' AND i.payload->>'evidence'='twitch_signed' AND i.payload->>'stakeId'=$1`,
        [row.stake_id],
      )
    ).rows[0].n as number;
    const result = (
      await c.query(
        `SELECT event FROM world_events WHERE world_id=$1 AND event->>'extensionVersion'='livewire-v0'
    AND event->>'evidence'='streamer_attested' AND event->'command'->>'type'='livewire-resolve'
    AND event->'command'->>'stakeId'=$2 ORDER BY sequence`,
        [row.id, row.stake_id],
      )
    ).rows;
    const lock = (
      await c.query(
        `SELECT event FROM world_events WHERE world_id=$1 AND event->>'extensionVersion'='livewire-v0'
    AND event->'command'->>'type'='livewire-lock' AND event->'command'->>'stakeId'=$2 ORDER BY sequence DESC LIMIT 1`,
        [row.id, row.stake_id],
      )
    ).rows[0]?.event;
    const crew =
      lock?.command.evidence === 'twitch_signed' &&
      lock.command.tallies.reduce((a: number, b: number) => a + b, 0) > 0;
    const linked =
      result.length === 1 &&
      crew &&
      result[0].event.causes.includes(lock.id) &&
      result[0].event.sequence > lock.sequence;
    return {
      status: row.status,
      worldId: row.id,
      stakeId: row.stake_id,
      signedBallots: ballots,
      attestedEffects: result.length,
      backendPathObserved: ballots > 0 && linked,
      selectedSystem: row.state.livewire.stake.target ?? null,
      selection: row.state.livewire.stake.selection ?? null,
      resources: row.state.resources,
      evidence:
        'Streamer-attested result; signed input records. OBS, actual game outcome and native raid are separate acceptance gates.',
    };
  });
}
