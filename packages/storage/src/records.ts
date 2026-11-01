import type { PoolClient } from 'pg';
import { createHash } from 'node:crypto';
import { DomainError, attributeSummary } from '@torchline/contracts';
import type { WorldHistoryPage } from '@torchline/contracts';
import type { Creator, StoredWorld, Store } from './index.ts';

const deny = (): never => {
  throw new DomainError('FORBIDDEN', 'This world record is unavailable to this creator.');
};
async function connected(c: PoolClient, creator: Creator) {
  const row = (await c.query('SELECT connected,mode FROM creators WHERE id=$1', [creator.id]))
    .rows[0];
  if (!row?.connected || row.mode !== creator.mode) deny();
}
async function owned(c: PoolClient, creator: Creator, id: string) {
  await connected(c, creator);
  const row = (
    await c.query(
      'SELECT w.*,p.label FROM worlds w JOIN creators p ON p.id=w.custodian_id WHERE w.id=$1 FOR SHARE OF w',
      [id],
    )
  ).rows[0];
  if (!row || row.custodian_id !== creator.id || row.mode !== creator.mode) deny();
  return row;
}
async function projected(c: PoolClient, row: Omit<StoredWorld, 'events'>): Promise<StoredWorld> {
  const events = (
    await c.query(
      "SELECT event FROM world_events WHERE world_id=$1 AND sequence<=$2 AND event->'command'->>'type' NOT IN ('vote','allocate','inspect') ORDER BY sequence DESC LIMIT 30",
      [row.id, row.state.version],
    )
  ).rows
    .map((item) => item.event)
    .reverse();
  const clock = (await c.query('SELECT * FROM episode_clocks WHERE world_id=$1', [row.id])).rows[0];
  const communities = new Set<string>([row.custodian_id]);
  for (const event of events) communities.add(event.actor.community);
  for (const system of Object.values(row.state.systems))
    for (const mark of system.marks) communities.add(mark.community);
  const labels = Object.fromEntries(
    (await c.query('SELECT id,label FROM creators WHERE id=ANY($1)', [[...communities]])).rows.map(
      (creator) => [creator.id as string, creator.label as string],
    ),
  );
  return { ...row, events, labels, clock };
}
export async function readWorldRecord(
  store: Store,
  creator: Creator,
  id: string,
): Promise<StoredWorld> {
  return store.transaction(async (c) => {
    await store.lockChannels(c, [creator.id]);
    return projected(c, await owned(c, creator, id));
  });
}
export async function readWorldHistory(
  store: Store,
  creator: Creator,
  id: string,
  query: HistoryQuery,
): Promise<WorldHistoryPage> {
  return store.transaction(async (c) => {
    await store.lockChannels(c, [creator.id]);
    return historyPage(c, await owned(c, creator, id), query);
  });
}
interface HistoryQuery {
  before?: number;
  through?: number;
  limit: number;
  custodyBefore?: string;
}
async function historyPage(
  c: PoolClient,
  row: { id: string; state: StoredWorld['state'] },
  query: HistoryQuery,
): Promise<WorldHistoryPage> {
  const id = row.id;
  const through = query.through ?? row.state.version;
  if (through > row.state.version)
    throw new DomainError('INVALID_CURSOR', 'History cannot extend beyond the saved world.');
  const events = (
    await c.query(
      `SELECT e.event,p.label AS community_label FROM world_events e LEFT JOIN creators p ON p.id=e.event->'actor'->>'community'
    WHERE e.world_id=$1 AND e.sequence<=$2 AND ($3::integer IS NULL OR e.sequence<$3) AND e.event->'command'->>'type' NOT IN ('vote','allocate','inspect')
    ORDER BY e.sequence DESC LIMIT $4`,
      [id, through, query.before ?? null, query.limit + 1],
    )
  ).rows;
  const custody = (
    await c.query(
      `SELECT h.id,h.created_at,s.id AS source_id,s.label AS source_label,t.id AS target_id,t.label AS target_label,h.mode
    FROM custody_events h JOIN creators s ON s.id=h.source_id JOIN creators t ON t.id=h.target_id
    WHERE h.world_id=$1 AND ($2::text IS NULL OR (h.created_at,h.id)<(SELECT created_at,id FROM custody_events WHERE world_id=$1 AND id=$2))
    ORDER BY h.created_at DESC,h.id DESC LIMIT $3`,
      [id, query.custodyBefore ?? null, query.limit + 1],
    )
  ).rows;
  const page = events.slice(0, query.limit);
  const steps = custody.slice(0, query.limit);
  return {
    schemaVersion: 'world-records-2026-10-27.1',
    worldId: id,
    throughSequence: through,
    events: page.map(({ event, community_label }) => ({
      id: event.id,
      sequence: event.sequence,
      chapter: event.chapter,
      at: event.at,
      community: { id: event.actor.community, label: community_label ?? event.actor.community },
      summary: attributeSummary(event.summary, event.actor.community, community_label),
      resourceDelta: event.resourceDelta,
      cues: event.cues,
      causes: event.causes,
    })),
    nextCursor: events.length > query.limit ? page.at(-1)!.event.sequence : null,
    custody: steps.map((item) => ({
      id: item.id,
      at: item.created_at.toISOString(),
      source: { id: item.source_id, label: item.source_label },
      target: { id: item.target_id, label: item.target_label },
      mode: item.mode,
    })),
    nextCustodyCursor: custody.length > query.limit ? steps.at(-1)!.id : null,
  };
}
/**
 * Publishes (or rotates) the caller's read-only public Chronicle link for a world they currently
 * command. Returns the token once; only its hash is stored.
 */
export async function shareWorld(store: Store, creator: Creator, id: string, token: string) {
  await store.transaction(async (c) => {
    await store.lockChannels(c, [creator.id]);
    await owned(c, creator, id);
    await c.query('DELETE FROM world_shares WHERE world_id=$1 AND created_by=$2', [id, creator.id]);
    await c.query('INSERT INTO world_shares(hash,world_id,created_by) VALUES($1,$2,$3)', [
      createHash('sha256').update(token).digest('hex'),
      id,
      creator.id,
    ]);
  });
}
/** Reads a shared world's public record. Unknown or withdrawn links reveal nothing. */
export async function readSharedChronicle(store: Store, token: string, query: HistoryQuery) {
  return store.transaction(async (c) => {
    const row = (
      await c.query(
        'SELECT w.*,p.label FROM world_shares s JOIN worlds w ON w.id=s.world_id JOIN creators p ON p.id=w.custodian_id WHERE s.hash=$1 FOR SHARE OF w',
        [createHash('sha256').update(token).digest('hex')],
      )
    ).rows[0];
    if (!row)
      throw new DomainError('NOT_FOUND', 'This Chronicle link is unknown or was withdrawn.');
    return { world: await projected(c, row), history: await historyPage(c, row, query) };
  });
}
export async function readHandoffPreview(store: Store, creator: Creator, id: string) {
  const info = (
    await store.pool.query('SELECT source_id,target_id,world_id FROM handoffs WHERE id=$1', [id])
  ).rows[0];
  if (!info || ![info.source_id, info.target_id].includes(creator.id)) deny();
  return store.transaction(async (c) => {
    await store.lockChannels(c, [info.source_id, info.target_id]);
    await connected(c, creator);
    const row = (
      await c.query(
        'SELECT w.*,p.label FROM worlds w JOIN creators p ON p.id=w.custodian_id WHERE w.id=$1 FOR SHARE OF w',
        [info.world_id],
      )
    ).rows[0];
    const intent = (
      await c.query(
        'SELECT *,expires_at>clock_timestamp() AS current FROM handoffs WHERE id=$1 FOR SHARE',
        [id],
      )
    ).rows[0];
    const source = (
      await c.query('SELECT id,label,connected,mode FROM creators WHERE id=$1', [info.source_id])
    ).rows[0];
    const target = (
      await c.query('SELECT id,label,connected,receive_opt_in,mode FROM creators WHERE id=$1', [
        info.target_id,
      ])
    ).rows[0];
    const slot = (
      await c.query('SELECT 1 FROM channel_slots WHERE channel_id=$1 AND world_id=$2', [
        source?.id,
        row?.id,
      ])
    ).rowCount;
    if (
      !intent?.current ||
      !['prepared', 'verified'].includes(intent.status) ||
      !row ||
      row.mode !== creator.mode ||
      row.custodian_id !== source?.id ||
      row.frozen_by !== id ||
      row.revision !== intent.frozen_revision ||
      !slot ||
      !source?.connected ||
      !target?.connected ||
      !target.receive_opt_in ||
      source.mode !== creator.mode ||
      target.mode !== creator.mode
    )
      deny();
    return {
      schemaVersion: 'world-records-2026-10-27.1' as const,
      intentId: id,
      status: intent.status as 'prepared' | 'verified',
      expiresAt: intent.expires_at.toISOString(),
      source: { id: source.id, label: source.label },
      target: { id: target.id, label: target.label },
      world: await projected(c, row),
    };
  });
}
