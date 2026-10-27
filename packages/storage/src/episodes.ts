import type { PoolClient } from 'pg';
import { DomainError } from '@torchline/contracts';
import type { Command, WorldState } from '@torchline/contracts';
import type { Store, Creator } from './index.ts';
export const EPISODE_POLICY = {
  investigation: 30,
  challenge: 90,
  allocation: 45,
  decision: 60,
} as const;
export type Durations = Record<keyof typeof EPISODE_POLICY, number | null>;
export interface EpisodeClock {
  input_window: number;
  phase: string;
  deadline_at: Date | null;
  remaining_ms: number | null;
  observed_at: Date;
  recovery_reason: string | null;
  durations: Durations;
}

export async function syncEpisode(c: PoolClient, before: WorldState, next: WorldState, at: Date) {
  if (next.rulesVersion !== 'ark-v3') return;
  const row = (
    await c.query('SELECT * FROM episode_clocks WHERE world_id=$1 FOR UPDATE', [next.id])
  ).rows[0] as EpisodeClock | undefined;
  if (row && before.window === next.window && before.phase === next.phase) return;
  const durations = row?.durations ?? EPISODE_POLICY;
  const seconds = durations[next.phase as keyof Durations];
  const paused = next.phase === 'paused';
  const remaining = paused
    ? row?.deadline_at
      ? Math.max(0, row.deadline_at.getTime() - at.getTime())
      : (row?.remaining_ms ?? null)
    : null;
  const duration =
    before.phase === 'paused' && row?.remaining_ms != null
      ? row.remaining_ms
      : seconds == null
        ? null
        : seconds * 1000;
  const deadline =
    !paused && duration != null && next.phase in durations
      ? new Date(at.getTime() + duration)
      : null;
  await c.query(
    `INSERT INTO episode_clocks(world_id,input_window,phase,deadline_at,remaining_ms,observed_at,durations)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(world_id) DO UPDATE SET input_window=$2,phase=$3,deadline_at=$4,remaining_ms=$5,observed_at=$6,recovery_reason=NULL`,
    [next.id, next.window, next.phase, deadline, remaining, at, durations],
  );
}

export async function configureEpisode(
  store: Store,
  creator: Creator,
  id: string,
  durations: Durations,
) {
  await store.transaction(async (c) => {
    await store.lockChannels(c, [creator.id]);
    const row = (
      await c.query(
        'SELECT w.*,c.connected FROM worlds w JOIN creators c ON c.id=w.custodian_id WHERE w.id=$1 FOR UPDATE OF w',
        [id],
      )
    ).rows[0];
    if (!row || !row.connected || row.custodian_id !== creator.id || row.mode !== creator.mode)
      throw new DomainError('FORBIDDEN', 'Only the connected custodian can configure an episode.');
    if (row.frozen_by || row.state.rulesVersion !== 'ark-v3' || row.state.phase !== 'ready')
      throw new DomainError(
        'INVALID_PHASE',
        'Configure timing at a ready chapter boundary on a new ark-v3 world.',
      );
    for (const value of Object.values(durations))
      if (value !== null && (!Number.isInteger(value) || value < 15 || value > 1800))
        throw new DomainError('INVALID_TIMING', 'Use manual timing or 15–1800 seconds.');
    await c.query(
      `INSERT INTO episode_clocks(world_id,input_window,phase,durations) VALUES($1,$2,'ready',$3) ON CONFLICT(world_id) DO UPDATE SET durations=$3`,
      [id, row.state.window, durations],
    );
    await c.query('UPDATE worlds SET revision=revision+1 WHERE id=$1', [id]);
    await c.query(
      'INSERT INTO outbox(world_id,revision) SELECT id,revision FROM worlds WHERE id=$1',
      [id],
    );
  });
}

const closeCommands: Record<string, Command> = {
  investigation: { type: 'close-investigation' },
  challenge: { type: 'close-challenge' },
  allocation: { type: 'close-allocation' },
  decision: { type: 'close-voting' },
};
export async function advanceEpisodes(store: Store, mode: Creator['mode']) {
  const rows = (
    await store.pool.query(
      `SELECT w.id,w.revision,w.custodian_id,e.input_window,e.phase FROM episode_clocks e JOIN worlds w ON w.id=e.world_id JOIN channel_slots s ON s.world_id=w.id JOIN creators c ON c.id=w.custodian_id
    WHERE w.mode=$1 AND c.connected AND w.frozen_by IS NULL AND e.deadline_at<=clock_timestamp() ORDER BY e.deadline_at LIMIT 20`,
      [mode],
    )
  ).rows;
  for (const row of rows) {
    const command = closeCommands[row.phase];
    if (!command) continue;
    try {
      await store.command(
        row.id,
        { id: 'episode-clock', role: 'host', community: row.custodian_id },
        mode,
        row.revision,
        `deadline:${row.input_window}`,
        command,
        undefined,
        { window: row.input_window },
      );
    } catch (e) {
      if (!(
        e instanceof DomainError &&
        ['STALE_VERSION', 'INPUT_PENDING', 'FORBIDDEN', 'WORLD_PARKED', 'HANDOFF_PENDING'].includes(
          e.code,
        )
      ))
        throw e;
    }
  }
  await store.pool.query(
    `UPDATE episode_clocks e SET observed_at=clock_timestamp() FROM worlds w WHERE e.world_id=w.id AND w.mode=$1 AND e.deadline_at IS NOT NULL`,
    [mode],
  );
}

/** Freeze downtime at the last healthy observation. Startup never silently consumes a window. */
export async function recoverEpisodes(
  store: Store,
  mode: Creator['mode'],
  reason = 'Server restarted; captain resume required.',
  ids?: string[],
) {
  const rows = (
    await store.pool.query(
      `SELECT w.id,w.revision,w.custodian_id,e.input_window,e.observed_at,e.deadline_at FROM episode_clocks e JOIN worlds w ON w.id=e.world_id JOIN channel_slots s ON s.world_id=w.id JOIN creators c ON c.id=w.custodian_id WHERE w.mode=$1 AND c.connected AND e.deadline_at IS NOT NULL AND ($2::text[] IS NULL OR w.id=ANY($2))`,
      [mode, ids ?? null],
    )
  ).rows;
  for (const row of rows) {
    try {
      await store.command(
        row.id,
        { id: 'episode-recovery', role: 'host', community: row.custodian_id },
        mode,
        row.revision,
        `recovery:${row.revision}`,
        { type: 'pause' },
        undefined,
        {
          window: row.input_window,
          recovery: {
            remainingMs: Math.max(0, row.deadline_at.getTime() - row.observed_at.getTime()),
            reason,
          },
        },
      );
    } catch (e) {
      if (!(
        e instanceof DomainError &&
        ['STALE_VERSION', 'INPUT_PENDING', 'FORBIDDEN', 'HANDOFF_PENDING'].includes(e.code)
      ))
        throw e;
    }
  }
}
