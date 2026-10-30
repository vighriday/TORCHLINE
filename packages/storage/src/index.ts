import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { DomainError, CURRENT_RULES_VERSION } from '@torchline/contracts';
import { syncEpisode } from './episodes.ts';
import { admitInput, DEFAULT_INPUT_POLICY } from './admission.ts';
import type { InputPolicy } from './admission.ts';
export { DEFAULT_INPUT_POLICY, inputPolicy } from './admission.ts';
export type { InputPolicy } from './admission.ts';
export const REQUIRED_MIGRATION = '010_livewire_recovery_index.sql';
import type { EpisodeClock } from './episodes.ts';
export { advanceEpisodes, recoverEpisodes, configureEpisode } from './episodes.ts';
export { interruptEpisode, settleInterruption, CHAT_INTERRUPTED } from './interruptions.ts';
import type { Actor, Command, WorldEvent, WorldState } from '@torchline/contracts';
import { applyCommand, createWorld, livewireUnresolved } from '@torchline/engine';
import { recoverLivewire } from './livewire.ts';
export {
  mutateLivewire,
  readLivewire,
  castLivewire,
  recoverLivewire,
  expireLivewire,
} from './livewire.ts';
export { readWorldRecord, readWorldHistory, readHandoffPreview } from './records.ts';

export interface Creator {
  id: string;
  label: string;
  mode: 'simulation' | 'live';
  receive_opt_in: boolean;
  connected: boolean;
}
export interface StoredWorld {
  id: string;
  mode: 'simulation' | 'live';
  custodian_id: string;
  revision: number;
  state: WorldState;
  frozen_by: string | null;
  label: string;
  events: WorldEvent[];
  clock?: EpisodeClock;
  input_suspended?: boolean;
}
export interface Handoff {
  id: string;
  world_id: string;
  source_id: string;
  target_id: string;
  mode: 'simulation' | 'live';
  status: 'prepared' | 'verified' | 'committed' | 'cancelled' | 'expired' | 'declined';
  frozen_revision: number;
  proof_id: string | null;
  prepared_at: Date;
  expires_at: Date;
}
export interface RaidProof {
  messageId: string;
  sourceId: string;
  targetId: string;
  mode: 'simulation' | 'live';
  subscriptionId: string;
  notificationAt: string;
}
const error = (code: string, message: string): never => {
  throw new DomainError(code, message);
};
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const participantIdentity = (worldId: string, accountId: string, key: string) =>
  createHmac('sha256', key).update(`${worldId}:${accountId}`).digest('hex');

export interface DatabaseBudgets {
  statementMs?: number;
  lockMs?: number;
  idleTransactionMs?: number;
}
export const DEFAULT_DATABASE_BUDGETS = {
  statementMs: 10000,
  lockMs: 2000,
  idleTransactionMs: 15000,
};

export class Store {
  readonly pool: Pool;
  constructor(connectionString: string, budgets: DatabaseBudgets = {}) {
    const limits = { ...DEFAULT_DATABASE_BUDGETS, ...budgets };
    for (const value of Object.values(limits))
      if (!Number.isInteger(value) || value < 1 || value > 60000)
        throw new Error('Database execution budgets must be 1–60000 milliseconds.');
    if (limits.lockMs >= limits.statementMs)
      throw new Error('Database lock budget must be shorter than the statement budget.');
    this.pool = new Pool({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 5000,
      statement_timeout: limits.statementMs,
      lock_timeout: limits.lockMs,
      idle_in_transaction_session_timeout: limits.idleTransactionMs,
    });
    // Idle sockets may fail between queries. pg removes them; do not crash the process
    // or log a connection string. Subsequent work obtains a fresh connection.
    this.pool.on('error', (cause: Error & { code?: string }) => {
      console.error('Database idle connection lost', { code: cause.code ?? 'CONNECTION_LOST' });
    });
  }
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    let broken: Error | undefined;
    const lost = (cause: Error) => {
      broken = cause;
    };
    client.on('error', lost);
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch (cause) {
        broken = cause instanceof Error ? cause : new Error('Rollback failed.');
      }
      throw e;
    } finally {
      client.removeListener('error', lost);
      client.release(broken);
    }
  }
  async migrate() {
    await this.transaction(async (c) => {
      // Bounded release-only allowance, reverted at transaction end; runtime stays strict.
      await c.query("SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='10s'");
      await c.query('SELECT pg_advisory_xact_lock(833016)');
      await c.query(
        'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
      );
      const dir = new URL('../migrations/', import.meta.url);
      for (const file of (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort()) {
        if ((await c.query('SELECT 1 FROM schema_migrations WHERE name=$1', [file])).rowCount)
          continue;
        await c.query(await readFile(new URL(file, dir), 'utf8'));
        await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      }
    });
  }
  async creator(id: string): Promise<Creator | null> {
    return (await this.pool.query('SELECT * FROM creators WHERE id=$1', [id])).rows[0] ?? null;
  }
  async ensureCreator(id: string, label: string, mode: Creator['mode'], client?: PoolClient) {
    const db = client ?? this.pool;
    await db.query(
      'INSERT INTO creators(id,label,mode,connected) VALUES($1,$2,$3,true) ON CONFLICT(id) DO UPDATE SET label=EXCLUDED.label,connected=true WHERE creators.mode=EXCLUDED.mode',
      [id, label, mode],
    );
    const creator = ((await db.query('SELECT * FROM creators WHERE id=$1', [id])).rows[0] ??
      null) as Creator | null;
    if (!creator || creator.mode !== mode) error('MODE_MISMATCH', 'Creator mode mismatch.');
    return creator!;
  }
  async optIn(id: string, enabled: boolean) {
    await this.transaction(async (c) => {
      await this.lockChannels(c, [id]);
      await this.requireConnected(c, id);
      await c.query('UPDATE creators SET receive_opt_in=$2 WHERE id=$1', [id, enabled]);
    });
  }
  async disconnectCreator(channel: string) {
    await recoverLivewire(this, 'live', 'disconnected', channel);
    await this.transaction(async (c) => {
      await this.lockChannels(c, [channel]);
      await c.query('UPDATE creators SET connected=false,receive_opt_in=false WHERE id=$1', [
        channel,
      ]);
      await c.query('DELETE FROM oauth_grants WHERE id=$1', [channel]);
      await c.query('DELETE FROM sessions WHERE channel_id=$1', [channel]);
      await c.query('DELETE FROM overlay_grants WHERE channel_id=$1', [channel]);
      await c.query(
        "UPDATE subscriptions SET status='app_disconnected' WHERE channel_id=$1 AND status IN ('enabled','webhook_callback_verification_pending')",
        [channel],
      );
      await c.query(
        "UPDATE eventsub_inbox SET processed_at=now(),error='AUTH_ENDED' WHERE processed_at IS NULL AND payload->>'channelId'=$1",
        [channel],
      );
      const world = (
        await c.query(
          'SELECT w.* FROM worlds w JOIN channel_slots s ON s.world_id=w.id WHERE s.channel_id=$1 FOR UPDATE OF w',
          [channel],
        )
      ).rows[0];
      if (world && !world.frozen_by && !['ready', 'paused', 'ended'].includes(world.state.phase)) {
        const at = (await c.query('SELECT clock_timestamp() AS at')).rows[0].at as Date;
        const next = applyCommand(
          world.state,
          { type: 'pause' },
          { id: 'authorization-recovery', role: 'host', community: channel },
          { commandId: `disconnect:${world.revision}`, at: at.toISOString() },
        );
        await syncEpisode(c, world.state, next.state, at);
        await c.query('UPDATE worlds SET state=$2,revision=revision+1 WHERE id=$1', [
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
    });
    const pending = (
      await this.pool.query(
        "SELECT id,source_id FROM handoffs WHERE (source_id=$1 OR target_id=$1) AND status IN ('prepared','verified')",
        [channel],
      )
    ).rows;
    for (const intent of pending)
      await this.cancel(
        intent.id,
        channel,
        intent.source_id === channel ? 'cancelled' : 'declined',
      );
  }
  async enqueueChat(
    deliveryId: string,
    channel: string,
    actorId: string,
    command: Command,
    timestamp: string,
    participantKey?: string,
    chatMessageId?: string,
    policy: InputPolicy = DEFAULT_INPUT_POLICY,
  ) {
    await this.transaction(async (c) => {
      await this.lockChannels(c, [channel]);
      if (
        (await c.query('SELECT 1 FROM eventsub_inbox WHERE message_id=$1', [deliveryId])).rowCount
      )
        return;
      const row = (
        await c.query(
          "SELECT w.*,EXISTS(SELECT 1 FROM eventsub_inbox i WHERE i.processed_at IS NULL AND i.payload->>'kind'='interruption' AND i.payload->>'worldId'=w.id AND (i.payload->>'window')::integer=(w.state->>'window')::integer) AS input_suspended FROM worlds w JOIN channel_slots s ON s.world_id=w.id WHERE s.channel_id=$1 FOR UPDATE OF w",
          [channel],
        )
      ).rows[0];
      const connected = (
        await c.query('SELECT 1 FROM creators WHERE id=$1 AND connected', [channel])
      ).rowCount;
      const eligible =
        connected &&
        row &&
        row.mode === 'live' &&
        !row.input_suspended &&
        !row.frozen_by &&
        ['investigation', 'challenge', 'allocation', 'decision'].includes(row.state.phase) &&
        row.state.windowOpenedAt &&
        Date.parse(timestamp) >= Date.parse(row.state.windowOpenedAt);
      let duplicate = false;
      if (chatMessageId)
        duplicate = !(
          await c.query(
            'INSERT INTO chat_message_dedup(channel_id,message_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING 1',
            [channel, chatMessageId],
          )
        ).rowCount;
      const clock = row
        ? (await c.query('SELECT deadline_at FROM episode_clocks WHERE world_id=$1', [row.id]))
            .rows[0]
        : null;
      // Cutoff is both provider-time and durable receipt-time: delayed past-cutoff messages
      // cannot enter a closed window. Already accepted work is drained before closing.
      const at = (await c.query('SELECT clock_timestamp() AS at')).rows[0].at as Date;
      const withinDeadline =
        !clock?.deadline_at ||
        (Date.parse(timestamp) < clock.deadline_at.getTime() && at < clock.deadline_at);
      const phaseCommands: Record<string, string[]> = {
        investigation: ['inspect'],
        challenge: ['scan', 'route', 'patch'],
        allocation: ['allocate'],
        decision: ['vote'],
      };
      const supported = row && phaseCommands[row.state.phase]?.includes(command.type);
      const participantId = row
        ? participantIdentity(row.id, actorId, participantKey ?? channel)
        : '';
      const rejection =
        eligible && !duplicate && withinDeadline && supported
          ? await admitInput(c, row.id, row.state.window, participantId, at, policy)
          : null;
      const accepted = eligible && !duplicate && withinDeadline && supported && !rejection;
      const appliedParticipantId =
        accepted && participantKey ? participantIdentity(row.id, actorId, participantKey) : actorId;
      const payload = accepted
        ? {
            kind: 'chat',
            worldId: row.id,
            channelId: channel,
            actorId: appliedParticipantId,
            command,
            window: row.state.window,
          }
        : { kind: 'ignored' };
      await c.query(
        'INSERT INTO eventsub_inbox(message_id,type,payload,processed_at,error) VALUES($1,$2,$3,$4,$5) ON CONFLICT(message_id) DO NOTHING',
        [deliveryId, 'channel.chat.message', payload, accepted ? null : at, rejection],
      );
      if (rejection)
        await c.query(
          'INSERT INTO input_rejections(world_id,input_window,reason) VALUES($1,$2,$3) ON CONFLICT(world_id,input_window,reason) DO UPDATE SET dropped=input_rejections.dropped+1',
          [row.id, row.state.window, rejection],
        );
    });
  }
  async lockChannels(c: PoolClient, ids: string[]) {
    await c.query('SELECT id FROM creators WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE', [
      [...new Set(ids)],
    ]);
  }
  private async requireConnected(c: PoolClient, id: string, mode?: Creator['mode']) {
    const row = (await c.query('SELECT connected,mode FROM creators WHERE id=$1', [id])).rows[0];
    if (!row?.connected || (mode && row.mode !== mode))
      error('FORBIDDEN', 'The creator authorization ended.');
  }
  async create(owner: Creator): Promise<string> {
    return this.transaction(async (c) => {
      await this.lockChannels(c, [owner.id]);
      await this.requireConnected(c, owner.id, owner.mode);
      if ((await c.query('SELECT 1 FROM channel_slots WHERE channel_id=$1', [owner.id])).rowCount)
        error('CHANNEL_BUSY', 'Park or finish the current world first.');
      const id = randomUUID();
      const state = createWorld(id, CURRENT_RULES_VERSION);
      await c.query('INSERT INTO worlds(id,mode,custodian_id,state) VALUES($1,$2,$3,$4)', [
        id,
        owner.mode,
        owner.id,
        state,
      ]);
      await c.query('INSERT INTO channel_slots(channel_id,world_id) VALUES($1,$2)', [owner.id, id]);
      await c.query('INSERT INTO outbox(world_id,revision) VALUES($1,0)', [id]);
      return id;
    });
  }
  async get(id: string, recentOnly = false): Promise<StoredWorld> {
    const row = (
      await this.pool.query(
        "SELECT w.*,c.label,EXISTS(SELECT 1 FROM eventsub_inbox i WHERE i.processed_at IS NULL AND i.payload->>'kind'='interruption' AND i.payload->>'worldId'=w.id AND (i.payload->>'window')::integer=(w.state->>'window')::integer) AS input_suspended FROM worlds w JOIN creators c ON c.id=w.custodian_id WHERE w.id=$1",
        [id],
      )
    ).rows[0];
    if (!row) error('NOT_FOUND', 'World not found.');
    const events = (
      await this.pool.query(
        recentOnly
          ? "SELECT event FROM world_events WHERE world_id=$1 AND sequence<=$2 AND event->'command'->>'type' NOT IN ('vote','allocate','inspect') ORDER BY sequence DESC LIMIT 30"
          : 'SELECT event FROM world_events WHERE world_id=$1 AND sequence<=$2 ORDER BY sequence',
        [id, row.state.version],
      )
    ).rows.map((row) => row.event);
    const clock = (
      await this.pool.query(
        'SELECT * FROM episode_clocks WHERE world_id=$1 AND input_window=$2 AND phase=$3',
        [id, row.state.window, row.state.phase],
      )
    ).rows[0];
    return { ...row, events: recentOnly ? events.reverse() : events, clock };
  }
  async active(channel: string, recentOnly = false): Promise<StoredWorld | null> {
    const row = (
      await this.pool.query('SELECT world_id FROM channel_slots WHERE channel_id=$1', [channel])
    ).rows[0];
    return row ? this.get(row.world_id, recentOnly) : null;
  }
  async library(channel: string) {
    return (
      await this.pool.query(
        'SELECT id,revision,state,mode,NOT EXISTS(SELECT 1 FROM channel_slots s WHERE s.world_id=w.id) AS parked FROM worlds w WHERE custodian_id=$1 ORDER BY created_at DESC LIMIT 50',
        [channel],
      )
    ).rows;
  }
  async park(channel: string, id: string, resume: boolean) {
    await this.transaction(async (c) => {
      await this.lockChannels(c, [channel]);
      await this.requireConnected(c, channel);
      const row = (await c.query('SELECT * FROM worlds WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!row || row.custodian_id !== channel)
        error('FORBIDDEN', 'Only the custodian can host this world.');
      if (row.frozen_by) error('HANDOFF_PENDING', 'Cancel the pending handoff first.');
      if (livewireUnresolved(row.state))
        error('LIVEWIRE_PENDING', 'Resolve or cancel the mission before changing hosting.');
      if (resume) {
        if ((await c.query('SELECT 1 FROM channel_slots WHERE channel_id=$1', [channel])).rowCount)
          error('CHANNEL_BUSY', 'This channel already hosts a world.');
        await c.query('INSERT INTO channel_slots(channel_id,world_id) VALUES($1,$2)', [
          channel,
          id,
        ]);
      } else {
        if (!['ready', 'paused', 'ended'].includes(row.state.phase)) {
          if (
            (
              await c.query(
                "SELECT 1 FROM eventsub_inbox WHERE processed_at IS NULL AND payload->>'kind'='chat' AND payload->>'worldId'=$1 LIMIT 1",
                [id],
              )
            ).rowCount
          )
            error('INPUT_PENDING', 'Wait for accepted chat before parking.');
          const at = (await c.query('SELECT clock_timestamp() AS at')).rows[0].at as Date;
          const next = applyCommand(
            row.state,
            { type: 'pause' },
            { id: channel, role: 'host', community: channel },
            { commandId: `park:${row.revision}`, at: at.toISOString() },
          );
          await syncEpisode(c, row.state, next.state, at);
          await c.query('UPDATE worlds SET state=$2 WHERE id=$1', [id, next.state]);
          await c.query('INSERT INTO world_events(world_id,sequence,event) VALUES($1,$2,$3)', [
            id,
            next.event.sequence,
            next.event,
          ]);
        }
        await c.query('DELETE FROM channel_slots WHERE channel_id=$1 AND world_id=$2', [
          channel,
          id,
        ]);
      }
      await c.query('UPDATE worlds SET revision=revision+1 WHERE id=$1', [id]);
      await c.query(
        'INSERT INTO outbox(world_id,revision) SELECT id,revision FROM worlds WHERE id=$1',
        [id],
      );
    });
  }
  async command(
    id: string,
    actor: Actor,
    mode: Creator['mode'],
    expectedRevision: number,
    commandId: string,
    command: Command,
    ingress?: { id: string; window: number },
    due?: { window: number; recovery?: { remainingMs: number; reason: string } },
  ) {
    if (command.type.startsWith('livewire-'))
      error(
        'FORBIDDEN',
        'Use the dedicated mission API; internal effect inputs are not public commands.',
      );
    await this.transaction(async (c) => {
      await this.lockChannels(c, [actor.community]);
      await this.requireConnected(c, actor.community, mode);
      const row = (await c.query('SELECT * FROM worlds WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!row || row.custodian_id !== actor.community)
        error('FORBIDDEN', 'This community does not control the world.');
      if (row.mode !== mode) error('MODE_MISMATCH', 'Simulation cannot change a live world.');
      if (ingress) {
        const item = (
          await c.query('SELECT processed_at FROM eventsub_inbox WHERE message_id=$1 FOR UPDATE', [
            ingress.id,
          ])
        ).rows[0];
        if (!item || item.processed_at) return;
        if (row.state.window !== ingress.window) {
          await c.query(
            "UPDATE eventsub_inbox SET processed_at=now(),error='WINDOW_CLOSED' WHERE message_id=$1",
            [ingress.id],
          );
          return;
        }
      } else if (
        [
          'close-investigation',
          'close-challenge',
          'close-allocation',
          'close-voting',
          'commit',
          'pause',
        ].includes(command.type)
      ) {
        if (
          (
            await c.query(
              "SELECT 1 FROM eventsub_inbox WHERE processed_at IS NULL AND payload->>'kind'='chat' AND payload->>'worldId'=$1 LIMIT 1",
              [id],
            )
          ).rowCount
        )
          error(
            'INPUT_PENDING',
            'Previously accepted chat input is processing. Try again after the live update.',
          );
      }
      const requestHash = hash({ command, expectedRevision });
      const existing = (
        await c.query(
          'SELECT request_hash FROM world_commands WHERE world_id=$1 AND actor_id=$2 AND command_id=$3',
          [id, actor.id, commandId],
        )
      ).rows[0];
      if (existing) {
        if (existing.request_hash !== requestHash)
          error('IDEMPOTENCY_CONFLICT', 'Command ID was reused with different input.');
        return;
      }
      if (
        !ingress &&
        command.type !== 'pause' &&
        (
          await c.query(
            "SELECT 1 FROM eventsub_inbox WHERE processed_at IS NULL AND payload->>'kind'='interruption' AND payload->>'worldId'=$1 AND (payload->>'window')::integer=$2 LIMIT 1",
            [id, row.state.window],
          )
        ).rowCount
      )
        error(
          'INPUT_SUSPENDED',
          'Chat connection interrupted. Wait for the saved pause, repair the connection, then resume.',
        );
      if (row.frozen_by) error('HANDOFF_PENDING', 'This world is frozen for handoff.');
      if (
        !(
          await c.query('SELECT 1 FROM channel_slots WHERE channel_id=$1 AND world_id=$2', [
            actor.community,
            id,
          ])
        ).rowCount
      )
        error('WORLD_PARKED', 'Resume this world before playing.');
      if (row.revision !== expectedRevision)
        error('STALE_VERSION', 'The world changed. Refresh and try again.');
      const at = (await c.query('SELECT clock_timestamp() AS at')).rows[0].at as Date;
      if (
        !ingress &&
        ['inspect', 'scan', 'route', 'patch', 'allocate', 'vote'].includes(command.type)
      ) {
        const clock = (
          await c.query('SELECT deadline_at FROM episode_clocks WHERE world_id=$1', [id])
        ).rows[0];
        if (clock?.deadline_at && clock.deadline_at <= at)
          error('WINDOW_CLOSED', 'The server deadline has passed. Wait for the next phase.');
      }
      if (due) {
        const clock = (
          await c.query('SELECT deadline_at FROM episode_clocks WHERE world_id=$1 FOR UPDATE', [id])
        ).rows[0];
        if (
          row.state.window !== due.window ||
          !clock?.deadline_at ||
          (!due.recovery && clock.deadline_at > at)
        )
          return;
      }
      const next = applyCommand(row.state, command, actor, {
        commandId,
        at: at.toISOString(),
      });
      await syncEpisode(c, row.state, next.state, at);
      if (due?.recovery)
        await c.query(
          'UPDATE episode_clocks SET remaining_ms=$2,recovery_reason=$3 WHERE world_id=$1',
          [id, due.recovery.remainingMs, due.recovery.reason],
        );
      await c.query('UPDATE worlds SET state=$2,revision=revision+1,updated_at=now() WHERE id=$1', [
        id,
        next.state,
      ]);
      await c.query('INSERT INTO world_events(world_id,sequence,event) VALUES($1,$2,$3)', [
        id,
        next.event.sequence,
        next.event,
      ]);
      await c.query(
        'INSERT INTO world_commands(world_id,actor_id,command_id,request_hash) VALUES($1,$2,$3,$4)',
        [id, actor.id, commandId, requestHash],
      );
      await c.query('INSERT INTO outbox(world_id,revision) VALUES($1,$2)', [id, row.revision + 1]);
      if (ingress)
        await c.query(
          'UPDATE eventsub_inbox SET processed_at=now(),error=NULL WHERE message_id=$1',
          [ingress.id],
        );
    });
    return this.get(id, Boolean(ingress));
  }
  async handoffs(channel: string): Promise<Handoff[]> {
    return (
      await this.pool.query(
        'SELECT * FROM handoffs WHERE source_id=$1 OR target_id=$1 ORDER BY prepared_at DESC LIMIT 20',
        [channel],
      )
    ).rows;
  }
  async prepare(
    id: string,
    source: Creator,
    targetId: string,
    expectedRevision: number,
    ttlMs = 180000,
  ): Promise<Handoff> {
    if (source.id === targetId) error('INVALID_TARGET', 'Choose another creator.');
    return this.transaction(async (c) => {
      await this.lockChannels(c, [source.id, targetId]);
      const currentSource = (
        await c.query('SELECT connected,mode FROM creators WHERE id=$1', [source.id])
      ).rows[0];
      if (!currentSource?.connected || currentSource.mode !== source.mode)
        error('FORBIDDEN', 'The source authorization ended.');
      const target = (await c.query('SELECT * FROM creators WHERE id=$1', [targetId])).rows[0];
      const w = (await c.query('SELECT * FROM worlds WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!w || w.custodian_id !== source.id || w.mode !== source.mode)
        error('FORBIDDEN', 'Invalid source custody.');
      if (!target || target.mode !== source.mode || !target.receive_opt_in || !target.connected)
        error('TARGET_UNAVAILABLE', 'Target must connect and opt in in the same mode.');
      if (w.revision !== expectedRevision)
        error('STALE_VERSION', 'The world changed. Refresh before preparing.');
      if (livewireUnresolved(w.state))
        error('LIVEWIRE_PENDING', 'Resolve or cancel the mission before preparing custody.');
      if (w.state.phase !== 'ready' || w.state.chapter === 0 || w.frozen_by)
        error('INVALID_PHASE', 'Finish a chapter before preparing a handoff.');
      if ((await c.query('SELECT 1 FROM channel_slots WHERE channel_id=$1', [targetId])).rowCount)
        error('TARGET_BUSY', 'The receiving channel already hosts a world.');
      if (
        !(
          await c.query('SELECT 1 FROM channel_slots WHERE channel_id=$1 AND world_id=$2', [
            source.id,
            id,
          ])
        ).rowCount
      )
        error('WORLD_PARKED', 'Resume this world before preparing a handoff.');
      if (
        (
          await c.query(
            "SELECT 1 FROM handoffs WHERE source_id=$1 AND target_id=$2 AND status IN ('cancelled','declined','expired') AND expires_at>now()-interval '10 minutes'",
            [source.id, targetId],
          )
        ).rowCount
      )
        error(
          'PAIR_COOLDOWN',
          'Wait ten minutes after a cancelled or expired handoff before retrying this pair.',
        );
      const intentId = randomUUID();
      const intent = (
        await c.query(
          "INSERT INTO handoffs(id,world_id,source_id,target_id,mode,status,frozen_revision,expires_at) VALUES($1,$2,$3,$4,$5,'prepared',$6,$7) RETURNING *",
          [
            intentId,
            id,
            source.id,
            targetId,
            source.mode,
            w.revision + 1,
            new Date(Date.now() + ttlMs),
          ],
        )
      ).rows[0];
      await c.query('UPDATE worlds SET frozen_by=$2,revision=revision+1 WHERE id=$1', [
        id,
        intentId,
      ]);
      await c.query('INSERT INTO outbox(world_id,revision) VALUES($1,$2)', [id, w.revision + 1]);
      return intent;
    });
  }
  async observeRaid(proof: RaidProof) {
    const timestamp = Date.parse(proof.notificationAt);
    if (
      !Number.isFinite(timestamp) ||
      timestamp < Date.now() - 600000 ||
      timestamp > Date.now() + 30000
    )
      error('PROOF_STALE', 'Raid evidence is outside the freshness window.');
    await this.transaction(async (c) => {
      await this.lockChannels(c, [proof.sourceId, proof.targetId]);
      const existing = (
        await c.query('SELECT * FROM raid_proofs WHERE message_id=$1', [proof.messageId])
      ).rows[0];
      if (existing) {
        if (
          existing.mode !== proof.mode ||
          existing.source_id !== proof.sourceId ||
          existing.target_id !== proof.targetId
        )
          error('PROOF_CONFLICT', 'Duplicate proof ID has different identities.');
        return;
      }
      await c.query(
        'INSERT INTO raid_proofs(message_id,mode,source_id,target_id,subscription_id,notification_at) VALUES($1,$2,$3,$4,$5,$6)',
        [
          proof.messageId,
          proof.mode,
          proof.sourceId,
          proof.targetId,
          proof.subscriptionId,
          proof.notificationAt,
        ],
      );
      const intent = (
        await c.query(
          "SELECT * FROM handoffs WHERE source_id=$1 AND target_id=$2 AND mode=$3 AND status='prepared' AND expires_at>now() AND prepared_at<=$4::timestamptz AND expires_at>=$4::timestamptz FOR UPDATE",
          [proof.sourceId, proof.targetId, proof.mode, proof.notificationAt],
        )
      ).rows[0];
      if (!intent) return;
      await c.query("UPDATE handoffs SET status='verified',proof_id=$2 WHERE id=$1", [
        intent.id,
        proof.messageId,
      ]);
    });
  }
  async accept(intentId: string, receiver: Creator) {
    const info = (await this.pool.query('SELECT * FROM handoffs WHERE id=$1', [intentId]))
      .rows[0] as Handoff | undefined;
    if (!info || info.target_id !== receiver.id || info.mode !== receiver.mode)
      error('FORBIDDEN', 'Only the intended receiving creator can accept.');
    await this.transaction(async (c) => {
      await this.lockChannels(c, [info!.source_id, receiver.id]);
      const w = (await c.query('SELECT * FROM worlds WHERE id=$1 FOR UPDATE', [info!.world_id]))
        .rows[0];
      const intent = (await c.query('SELECT * FROM handoffs WHERE id=$1 FOR UPDATE', [intentId]))
        .rows[0] as Handoff;
      if (intent.status === 'committed') return;
      if (intent.status !== 'verified' || !intent.proof_id)
        error('PROOF_REQUIRED', 'A verified native raid is required before acceptance.');
      if (intent.expires_at.getTime() <= Date.now())
        error('INTENT_EXPIRED', 'The prepared handoff expired.');
      const target = (await c.query('SELECT * FROM creators WHERE id=$1', [receiver.id])).rows[0];
      const source = (
        await c.query('SELECT connected FROM creators WHERE id=$1', [intent.source_id])
      ).rows[0];
      if (!source?.connected) error('SOURCE_UNAVAILABLE', 'The source authorization ended.');
      if (!target.receive_opt_in || !target.connected)
        error('TARGET_UNAVAILABLE', 'Receiver is no longer opted in or connected.');
      if (
        w.frozen_by !== intent.id ||
        w.revision !== intent.frozen_revision ||
        w.custodian_id !== intent.source_id
      )
        error('STALE_VERSION', 'Custody or frozen state changed.');
      if (
        (await c.query('SELECT 1 FROM channel_slots WHERE channel_id=$1', [receiver.id])).rowCount
      )
        error('TARGET_BUSY', 'The receiving channel now hosts another world.');
      const proof = (
        await c.query('SELECT * FROM raid_proofs WHERE message_id=$1 FOR UPDATE', [intent.proof_id])
      ).rows[0];
      if (
        !proof ||
        proof.consumed_by ||
        proof.mode !== intent.mode ||
        proof.source_id !== intent.source_id ||
        proof.target_id !== intent.target_id
      )
        error('PROOF_REQUIRED', 'Proof was consumed or does not match.');
      await c.query('DELETE FROM channel_slots WHERE channel_id=$1 AND world_id=$2', [
        intent.source_id,
        intent.world_id,
      ]);
      await c.query('INSERT INTO channel_slots(channel_id,world_id) VALUES($1,$2)', [
        receiver.id,
        intent.world_id,
      ]);
      await c.query(
        'UPDATE worlds SET custodian_id=$2,frozen_by=NULL,revision=revision+1 WHERE id=$1',
        [intent.world_id, receiver.id],
      );
      // Ready-boundary custody inherits game rules and scars, not the previous host's pacing.
      await c.query('DELETE FROM episode_clocks WHERE world_id=$1', [intent.world_id]);
      await c.query('UPDATE raid_proofs SET consumed_by=$2 WHERE message_id=$1', [
        intent.proof_id,
        intent.id,
      ]);
      await c.query("UPDATE handoffs SET status='committed' WHERE id=$1", [intent.id]);
      await c.query(
        'INSERT INTO custody_events(id,world_id,source_id,target_id,proof_id,mode) VALUES($1,$2,$3,$4,$5,$6)',
        [
          intent.id,
          intent.world_id,
          intent.source_id,
          intent.target_id,
          intent.proof_id,
          intent.mode,
        ],
      );
      await c.query('INSERT INTO outbox(world_id,revision) VALUES($1,$2)', [
        intent.world_id,
        w.revision + 1,
      ]);
    });
    return this.get(info!.world_id);
  }
  async cancel(intentId: string, channel: string, status: 'cancelled' | 'declined' | 'expired') {
    const info = (await this.pool.query('SELECT * FROM handoffs WHERE id=$1', [intentId])).rows[0];
    if (
      !info ||
      (status === 'cancelled' && info.source_id !== channel) ||
      (status === 'declined' && info.target_id !== channel)
    )
      error('FORBIDDEN', 'Not a party to this handoff.');
    await this.transaction(async (c) => {
      await this.lockChannels(c, [info.source_id, info.target_id]);
      await c.query('SELECT id FROM worlds WHERE id=$1 FOR UPDATE', [info.world_id]);
      const intent = (await c.query('SELECT * FROM handoffs WHERE id=$1 FOR UPDATE', [intentId]))
        .rows[0];
      if (!['prepared', 'verified'].includes(intent.status)) return;
      if (status === 'expired' && intent.expires_at.getTime() > Date.now()) return;
      await c.query(
        'UPDATE handoffs SET status=$2,expires_at=LEAST(expires_at,now()) WHERE id=$1',
        [intentId, status],
      );
      await c.query(
        'UPDATE worlds SET frozen_by=NULL,revision=revision+1 WHERE id=$1 AND frozen_by=$2',
        [info.world_id, intentId],
      );
      await c.query(
        'INSERT INTO outbox(world_id,revision) SELECT id,revision FROM worlds WHERE id=$1',
        [info.world_id],
      );
    });
  }
  async expire(mode?: Creator['mode']) {
    const rows = (
      await this.pool.query(
        "SELECT id FROM handoffs WHERE status IN ('prepared','verified') AND expires_at<=now() AND ($1::text IS NULL OR mode=$1) LIMIT 50",
        [mode ?? null],
      )
    ).rows;
    for (const row of rows) await this.cancel(row.id, '', 'expired');
  }
  async close() {
    await this.pool.end();
  }
}
