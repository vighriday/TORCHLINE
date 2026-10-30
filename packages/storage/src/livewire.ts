import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DomainError, LivewireRequestSchema } from '@torchline/contracts';
import type {
  LivewireCommand,
  LivewireRequest,
  LivewireTarget,
  WorldState,
} from '@torchline/contracts';
import { applyCommand, livewireUnresolved } from '@torchline/engine';
import type { Creator, Store } from './index.ts';
import { participantIdentity } from './index.ts';
import { admitInput, DEFAULT_INPUT_POLICY } from './admission.ts';
import type { InputPolicy } from './admission.ts';

function fail(code: string, message: string): never {
  throw new DomainError(code, message);
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function liveChatAuthority(c: PoolClient, channel: string) {
  return Boolean(
    (
      await c.query(
        `SELECT 1 FROM oauth_grants g JOIN oauth_grants b ON b.role='bot'
    JOIN subscriptions s ON s.channel_id=g.id AND s.type='channel.chat.message'
    WHERE g.id=$1 AND g.role='creator' AND g.scopes @> ARRAY['channel:bot']::text[] AND g.validated_at>now()-interval '1 hour'
    AND b.scopes @> ARRAY['user:read:chat','user:write:chat','user:bot']::text[] AND b.validated_at>now()-interval '1 hour'
    AND s.status='enabled' AND s.version='1' AND s.confirmed_at IS NOT NULL
    AND s.condition=jsonb_build_object('broadcaster_user_id',g.id,'user_id',b.id) LIMIT 1`,
        [channel],
      )
    ).rowCount,
  );
}

async function commit(
  c: PoolClient,
  row: { id: string; state: WorldState; revision: number; custodian_id: string },
  command: LivewireCommand,
  author: string,
  commandId: string,
  at: Date,
) {
  const next = applyCommand(
    row.state,
    command,
    { id: author, role: 'host', community: row.custodian_id },
    { commandId, at: at.toISOString() },
  );
  await c.query('UPDATE worlds SET state=$2,revision=revision+1,updated_at=$3 WHERE id=$1', [
    row.id,
    next.state,
    at,
  ]);
  await c.query('INSERT INTO world_events(world_id,sequence,event) VALUES($1,$2,$3)', [
    row.id,
    next.event.sequence,
    next.event,
  ]);
  await c.query('INSERT INTO outbox(world_id,revision) VALUES($1,$2)', [row.id, row.revision + 1]);
  const stake = next.state.livewire!.stake;
  if (command.type === 'livewire-open')
    await c.query(
      'INSERT INTO livewire_stakes(id,world_id,channel_id,chapter,status,deadline_at) VALUES($1,$2,$3,$4,$5,$6)',
      [stake.id, row.id, stake.channel, stake.chapter, stake.status, stake.deadlineAt],
    );
  else
    await c.query('UPDATE livewire_stakes SET status=$2,deadline_at=$3 WHERE id=$1', [
      stake.id,
      stake.status,
      stake.deadlineAt,
    ]);
  return next;
}

export async function mutateLivewire(
  store: Store,
  creator: Creator,
  id: string,
  raw: LivewireRequest,
  chatReady: boolean,
) {
  const request = LivewireRequestSchema.parse(raw);
  return store.transaction(async (c) => {
    await store.lockChannels(c, [creator.id]);
    const row = (
      await c.query(
        'SELECT w.*,c.connected FROM worlds w JOIN creators c ON c.id=w.custodian_id WHERE w.id=$1 FOR UPDATE OF w',
        [id],
      )
    ).rows[0];
    if (!row || !row.connected || row.custodian_id !== creator.id || row.mode !== creator.mode)
      fail('FORBIDDEN', 'Only the connected current custodian controls this Ark.');
    if (row.frozen_by) fail('HANDOFF_PENDING', 'The Ark is frozen for handoff.');
    if (
      !(
        await c.query('SELECT 1 FROM channel_slots WHERE channel_id=$1 AND world_id=$2', [
          creator.id,
          id,
        ])
      ).rowCount
    )
      fail('WORLD_PARKED', 'Host this Ark before opening a mission.');
    const requestHash = hash(request);
    const existing = (
      await c.query(
        'SELECT request_hash FROM world_commands WHERE world_id=$1 AND actor_id=$2 AND command_id=$3',
        [id, creator.id, request.commandId],
      )
    ).rows[0];
    if (existing) {
      if (existing.request_hash !== requestHash)
        fail('IDEMPOTENCY_CONFLICT', 'The request key was reused with different content.');
      return;
    }
    if (row.revision !== request.expectedVersion)
      fail('STALE_VERSION', 'The Ark changed. Refresh before committing.');
    const action = request.action;
    // Cancel always remains available during degraded chat or a disabled feature.
    if (action.type !== 'cancel' && creator.mode === 'live') {
      const healthy = await liveChatAuthority(c, creator.id);
      if (!chatReady || !healthy)
        fail(
          'SUBSCRIPTION_UNREADY',
          'Restore verified Twitch chat before continuing this mission.',
        );
    }
    const at = (await c.query('SELECT clock_timestamp() AS at')).rows[0].at as Date;
    let command: LivewireCommand;
    if (action.type === 'open')
      command = { ...action, type: 'livewire-open', stakeId: randomUUID() };
    else if (action.type === 'lock') {
      const tally = (
        await c.query('SELECT * FROM livewire_stakes WHERE id=$1 AND world_id=$2', [
          action.stakeId,
          id,
        ])
      ).rows[0];
      if (!tally) fail('STAKE_MISMATCH', 'Mission not found on this Ark.');
      command = {
        type: 'livewire-lock',
        stakeId: action.stakeId,
        tallies: [tally.navigation, tally.hull, tally.oxygen],
        evidence: creator.mode === 'live' ? 'twitch_signed' : 'simulation',
        ...(action.solo ? { solo: action.solo } : {}),
      };
    } else command = { ...action, type: `livewire-${action.type}` } as LivewireCommand;
    await commit(c, row, command, creator.id, request.commandId, at);
    await c.query(
      'INSERT INTO world_commands(world_id,actor_id,command_id,request_hash) VALUES($1,$2,$3,$4)',
      [id, creator.id, request.commandId, requestHash],
    );
  });
}

export async function readLivewire(store: Store, state: WorldState) {
  const stake = state.livewire?.stake;
  if (!stake)
    return {
      tallies: [0, 0, 0] as [number, number, number],
      participants: 0,
      revision: 0,
      lastInputAt: null,
    };
  const row = (
    await store.pool.query(
      'SELECT navigation,hull,oxygen,participants,ballot_revision,last_input_at FROM livewire_stakes WHERE id=$1',
      [stake.id],
    )
  ).rows[0];
  return {
    tallies: (stake.tallies ?? [row?.navigation ?? 0, row?.hull ?? 0, row?.oxygen ?? 0]) as [
      number,
      number,
      number,
    ],
    participants: row?.participants ?? 0,
    revision: row?.ballot_revision ?? 0,
    lastInputAt: row?.last_input_at?.toISOString() ?? null,
  };
}

/** Called only after the signed webhook's identity/subscription checks, or isolated simulator auth.
 * The small ballot transaction IS the durable ingress. No whole-world clone or voter map. */
export async function castLivewire(
  store: Store,
  input: {
    channel: string;
    actor: string;
    target: LivewireTarget;
    providerAt: string;
    deliveryId: string;
    messageId: string;
    mode: Creator['mode'];
    participantKey: string;
  },
  policy: InputPolicy = DEFAULT_INPUT_POLICY,
) {
  return store.transaction(async (c) => {
    await store.lockChannels(c, [input.channel]);
    const row = (
      await c.query(
        'SELECT w.*,c.connected FROM worlds w JOIN channel_slots s ON s.world_id=w.id JOIN creators c ON c.id=s.channel_id WHERE s.channel_id=$1 FOR UPDATE OF w',
        [input.channel],
      )
    ).rows[0];
    if (!row || row.mode !== input.mode || !livewireUnresolved(row.state)) return false;
    if (
      (await c.query('SELECT 1 FROM eventsub_inbox WHERE message_id=$1', [input.deliveryId]))
        .rowCount
    )
      return true;
    const at = (await c.query('SELECT clock_timestamp() AS at')).rows[0].at as Date;
    const stake = row.state.livewire.stake;
    const provider = Date.parse(input.providerAt);
    const since = Date.parse(stake.windowOpenedAt ?? stake.openedAt);
    const duplicate = !(
      await c.query(
        'INSERT INTO chat_message_dedup(channel_id,message_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING 1',
        [input.channel, input.messageId],
      )
    ).rowCount;
    const connected = input.mode === 'simulation' || (await liveChatAuthority(c, input.channel));
    let rejection: string | null =
      !row.connected || !connected
        ? 'SUBSCRIPTION_UNREADY'
        : row.frozen_by
          ? 'HANDOFF_PENDING'
          : duplicate
            ? 'DUPLICATE_MESSAGE'
            : stake.status !== 'open' ||
                row.state.phase !== 'ready' ||
                stake.channel !== input.channel ||
                !stake.deadlineAt ||
                !Number.isFinite(provider) ||
                provider < since ||
                provider >= Date.parse(stake.deadlineAt) ||
                at.getTime() >= Date.parse(stake.deadlineAt) ||
                provider > at.getTime() + 30000
              ? 'WINDOW_CLOSED'
              : !stake.options.some((o: { target: string }) => o.target === input.target)
                ? 'INVALID_OPTION'
                : null;
    const participant = participantIdentity(row.id, input.actor, input.participantKey);
    if (!rejection)
      rejection = await admitInput(c, row.id, -(stake.chapter + 1), participant, at, policy);
    if (!rejection) {
      // Keep Twitch's nanosecond ordering; pg Date decoding only retains milliseconds.
      const fraction = input.providerAt.match(/\.(\d{1,9})(?:Z|[+-]\d{2}:\d{2})$/)?.[1] ?? '0';
      const providerOrder =
        new Date(provider).toISOString().slice(0, 19) + '.' + fraction.padEnd(9, '0') + 'Z';
      const tally = (
        await c.query('SELECT participants FROM livewire_stakes WHERE id=$1', [stake.id])
      ).rows[0];
      const old = (
        await c.query('SELECT * FROM livewire_ballots WHERE stake_id=$1 AND participant=$2', [
          stake.id,
          participant,
        ])
      ).rows[0];
      if (!old && tally.participants >= 10000) rejection = 'BALLOT_LIMIT';
      else if (
        old &&
        (old.provider_order > providerOrder ||
          (old.provider_order === providerOrder && old.delivery_key >= input.deliveryId))
      )
        rejection = 'OLDER_BALLOT';
      else {
        await c.query(
          'INSERT INTO livewire_ballots(stake_id,participant,target,provider_at,delivery_key,provider_order) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(stake_id,participant) DO UPDATE SET target=$3,provider_at=$4,delivery_key=$5,provider_order=$6',
          [stake.id, participant, input.target, input.providerAt, input.deliveryId, providerOrder],
        );
        const delta = (target: string) =>
          Number(input.target === target) - Number(old?.target === target);
        await c.query(
          'UPDATE livewire_stakes SET navigation=navigation+$2,hull=hull+$3,oxygen=oxygen+$4,participants=participants+$5,ballot_revision=ballot_revision+1,last_input_at=$6 WHERE id=$1',
          [stake.id, delta('navigation'), delta('hull'), delta('oxygen'), old ? 0 : 1, at],
        );
        await c.query('INSERT INTO outbox(world_id,revision) VALUES($1,$2)', [
          row.id,
          row.revision,
        ]);
      }
    }
    await c.query(
      'INSERT INTO eventsub_inbox(message_id,type,payload,processed_at,error) VALUES($1,$2,$3,$4,$5)',
      [
        input.deliveryId,
        input.mode === 'live' ? 'channel.chat.message' : 'torchline.simulation.livewire',
        {
          kind: 'livewire_ballot',
          worldId: row.id,
          stakeId: stake.id,
          channelId: input.channel,
          evidence: input.mode === 'live' ? 'twitch_signed' : 'simulation',
          accepted: !rejection,
        },
        at,
        rejection,
      ],
    );
    return true;
  });
}

export async function recoverLivewire(
  store: Store,
  mode: Creator['mode'],
  reason: 'restart' | 'chat_unavailable' | 'offline' | 'disconnected' = 'restart',
  channel?: string,
) {
  const rows = (
    await store.pool.query(
      "SELECT l.world_id,l.channel_id FROM livewire_stakes l JOIN worlds w ON w.id=l.world_id WHERE w.mode=$1 AND l.status='open' AND ($2::text IS NULL OR l.channel_id=$2) ORDER BY l.world_id LIMIT 100",
      [mode, channel ?? null],
    )
  ).rows;
  for (const entry of rows)
    await store.transaction(async (c) => {
      await store.lockChannels(c, [entry.channel_id]);
      const row = (await c.query('SELECT * FROM worlds WHERE id=$1 FOR UPDATE', [entry.world_id]))
        .rows[0];
      const stake = row?.state.livewire?.stake;
      if (!stake || stake.status !== 'open' || row.custodian_id !== entry.channel_id) return;
      const at = (await c.query('SELECT clock_timestamp() AS at')).rows[0].at as Date;
      await commit(
        c,
        row,
        { type: 'livewire-pause', stakeId: stake.id, reason },
        'mission-recovery',
        `livewire:pause:${row.revision}`,
        at,
      );
    });
}

export async function expireLivewire(store: Store, mode: Creator['mode']) {
  const rows = (
    await store.pool.query(
      "SELECT l.world_id,l.channel_id FROM livewire_stakes l JOIN worlds w ON w.id=l.world_id WHERE w.mode=$1 AND l.status IN ('open','locked') AND l.deadline_at<=clock_timestamp() ORDER BY l.deadline_at LIMIT 20",
      [mode],
    )
  ).rows;
  for (const entry of rows)
    await store.transaction(async (c) => {
      await store.lockChannels(c, [entry.channel_id]);
      const row = (await c.query('SELECT * FROM worlds WHERE id=$1 FOR UPDATE', [entry.world_id]))
        .rows[0];
      const stake = row?.state.livewire?.stake;
      const at = (await c.query('SELECT clock_timestamp() AS at')).rows[0].at as Date;
      if (
        !stake?.deadlineAt ||
        !['open', 'locked'].includes(stake.status) ||
        Date.parse(stake.deadlineAt) > at.getTime() ||
        row.custodian_id !== entry.channel_id
      )
        return;
      await commit(
        c,
        row,
        { type: 'livewire-expire', stakeId: stake.id },
        'mission-expiry',
        `livewire:expire:${stake.id}`,
        at,
      );
    });
}
