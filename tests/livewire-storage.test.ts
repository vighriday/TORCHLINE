import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  castLivewire,
  mutateLivewire,
  readLivewire,
  recoverLivewire,
  expireLivewire,
  Store,
} from '@torchline/storage';
import type { Creator } from '@torchline/storage';
import type { LivewireRequest } from '@torchline/contracts';
import { replayEvents, applyCommand } from '@torchline/engine';
import { database } from './helpers.ts';

async function setup(store: Store) {
  const creator = await store.ensureCreator('sim-alpha', 'Alpha', 'simulation');
  const id = await store.create(creator);
  return { creator, id };
}
async function action(store: Store, creator: Creator, id: string, a: LivewireRequest['action']) {
  const request = {
    expectedVersion: (await store.get(id)).revision,
    commandId: randomUUID(),
    action: a,
  };
  await mutateLivewire(store, creator, id, request, true);
  return request;
}
async function open(store: Store, creator: Creator, id: string) {
  await action(store, creator, id, {
    type: 'open',
    preset: 'boss',
    game: 'A game',
    label: 'Boss attempt',
  });
  return (await store.get(id)).state.livewire!.stake.id;
}
async function vote(
  store: Store,
  creator: Creator,
  target: 'hull' | 'oxygen' | 'navigation',
  actor = 'viewer',
  overrides = {},
) {
  return castLivewire(store, {
    channel: creator.id,
    actor,
    target,
    providerAt: (await store.pool.query('SELECT clock_timestamp() AS at')).rows[0].at.toISOString(),
    deliveryId: randomUUID(),
    messageId: randomUUID(),
    mode: 'simulation',
    participantKey: 'private-test-fixture',
    ...overrides,
  });
}
describe('LIVEWIRE real PostgreSQL transactions', () => {
  it('orders nanosecond Twitch timestamps before using the delivery-ID tie break', () =>
    database(async (store) => {
      const { creator, id } = await setup(store);
      await open(store, creator, id);
      const second = new Date(Date.now() + 1000).toISOString().slice(0, 19);
      await vote(store, creator, 'hull', 'nano', {
        providerAt: `${second}.123456780Z`,
        deliveryId: `zz-${randomUUID()}`,
      });
      await vote(store, creator, 'oxygen', 'nano', {
        providerAt: `${second}.123456789Z`,
        deliveryId: `aa-${randomUUID()}`,
      });
      await vote(store, creator, 'navigation', 'nano', {
        providerAt: `${second}.123456781Z`,
        deliveryId: `zz-${randomUUID()}`,
      });
      expect((await readLivewire(store, (await store.get(id)).state)).tallies).toEqual([0, 0, 1]);
    }));
  it('expires an overdue canonical fixture once under competing workers without awarding or refunding resources', () =>
    database(async (store) => {
      const { creator, id } = await setup(store);
      const initial = await store.get(id);
      const next = applyCommand(
        initial.state,
        {
          type: 'livewire-open',
          stakeId: randomUUID(),
          preset: 'boss',
          game: 'Game',
          label: 'Expired attempt',
        },
        { id: creator.id, role: 'host', community: creator.id },
        { commandId: 'expiry-fixture', at: new Date(Date.now() - 60000).toISOString() },
      );
      await store.transaction(async (c) => {
        await c.query('UPDATE worlds SET state=$2,revision=1 WHERE id=$1', [id, next.state]);
        await c.query('INSERT INTO world_events(world_id,sequence,event) VALUES($1,1,$2)', [
          id,
          next.event,
        ]);
        const stake = next.state.livewire!.stake;
        await c.query(
          'INSERT INTO livewire_stakes(id,world_id,channel_id,chapter,status,deadline_at) VALUES($1,$2,$3,0,$4,$5)',
          [stake.id, id, creator.id, stake.status, stake.deadlineAt],
        );
      });
      await Promise.all([expireLivewire(store, 'simulation'), expireLivewire(store, 'simulation')]);
      const world = await store.get(id);
      expect(world.state.livewire!.stake.status).toBe('expired');
      expect(world.state.resources).toEqual(next.state.resources);
      expect(world.events.filter((e) => e.command.type === 'livewire-expire')).toHaveLength(1);
      expect(replayEvents(id, world.events)).toEqual(world.state);
    }));
  it('serializes vote versus lock and rejects a same-viewer flood without growing canonical JSON', () =>
    database(async (store) => {
      const { creator, id } = await setup(store);
      const stakeId = await open(store, creator, id);
      await vote(store, creator, 'navigation', 'first');
      await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          vote(store, creator, 'hull', 'flood', {
            providerAt: new Date(Date.now() + i).toISOString(),
          }),
        ),
      );
      expect((await readLivewire(store, (await store.get(id)).state)).participants).toBe(2);
      expect(
        (await store.pool.query("SELECT 1 FROM eventsub_inbox WHERE error='INPUT_RATE_LIMITED'"))
          .rowCount,
      ).toBeGreaterThan(0);
      const before = (await store.get(id)).state;
      await Promise.all([
        vote(store, creator, 'hull', 'second'),
        action(store, creator, id, { type: 'lock', stakeId }),
      ]);
      const locked = await store.get(id);
      const tallies = locked.state.livewire!.stake.tallies!;
      expect(tallies.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(2);
      await vote(store, creator, 'oxygen', 'late');
      expect((await store.get(id)).state).toEqual(locked.state);
      expect(JSON.stringify(before)).not.toContain('flood');
      expect(replayEvents(id, locked.events)).toEqual(locked.state);
    }));
  it('serializes competing opens, exact retries, stale requests and one success/failure effect', () =>
    database(async (store) => {
      const { creator, id } = await setup(store);
      const req = {
        expectedVersion: 0,
        commandId: randomUUID(),
        action: { type: 'open', preset: 'match', game: 'Rocket League', label: 'Ranked match' },
      } as const;
      await Promise.all([
        mutateLivewire(store, creator, id, req, true),
        mutateLivewire(store, creator, id, req, true),
      ]);
      expect(
        (await store.pool.query('SELECT count(*)::integer AS n FROM livewire_stakes')).rows[0].n,
      ).toBe(1);
      await expect(
        mutateLivewire(store, creator, id, { ...req, commandId: randomUUID() }, true),
      ).rejects.toMatchObject({ code: 'STALE_VERSION' });
      await expect(
        mutateLivewire(
          store,
          creator,
          id,
          { ...req, action: { ...req.action, label: 'Changed' } },
          true,
        ),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      const stakeId = (await store.get(id)).state.livewire!.stake.id;
      await action(store, creator, id, { type: 'lock', stakeId, solo: 'hull' });
      const revision = (await store.get(id)).revision;
      const [a, b] = await Promise.allSettled(
        ['success', 'failure'].map((outcome) =>
          mutateLivewire(
            store,
            creator,
            id,
            {
              expectedVersion: revision,
              commandId: randomUUID(),
              action: { type: 'resolve', stakeId, outcome: outcome as 'success' | 'failure' },
            },
            true,
          ),
        ),
      );
      expect([a, b].filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const world = await store.get(id);
      expect(world.events.filter((e) => e.command.type === 'livewire-resolve')).toHaveLength(1);
      expect(replayEvents(id, world.events)).toEqual(world.state);
      await expect(
        action(store, creator, id, {
          type: 'open',
          preset: 'boss',
          game: 'Game',
          label: 'Another',
        }),
      ).rejects.toMatchObject({ code: 'CHARGE_SPENT' });
    }));
  it('keeps one latest ballot, deduplicates delivery/message IDs and rejects closed/wrong channels', () =>
    database(async (store) => {
      const { creator, id } = await setup(store);
      const stakeId = await open(store, creator, id);
      const deliveryId = randomUUID(),
        messageId = randomUUID();
      await vote(store, creator, 'hull', 'viewer', { deliveryId, messageId });
      await vote(store, creator, 'oxygen', 'viewer', { deliveryId, messageId });
      await vote(store, creator, 'oxygen', 'viewer', { messageId });
      expect((await readLivewire(store, (await store.get(id)).state)).tallies).toEqual([0, 1, 0]);
      await vote(store, creator, 'oxygen', 'viewer', {
        providerAt: new Date(Date.now() + 10).toISOString(),
      });
      expect((await readLivewire(store, (await store.get(id)).state)).tallies).toEqual([0, 0, 1]);
      const other = await store.ensureCreator('other', 'Other', 'simulation');
      expect(await vote(store, other, 'hull')).toBe(false);
      const lockRequest = await action(store, creator, id, { type: 'lock', stakeId });
      await vote(store, creator, 'hull', 'later');
      expect((await store.get(id)).state.livewire!.stake.tallies).toEqual([0, 0, 1]);
      await mutateLivewire(store, creator, id, lockRequest, true);
      expect(
        (await store.pool.query('SELECT count(*)::integer AS n FROM livewire_ballots')).rows[0].n,
      ).toBe(1);
      await expect(
        mutateLivewire(
          store,
          other,
          id,
          {
            expectedVersion: (await store.get(id)).revision,
            commandId: randomUUID(),
            action: { type: 'cancel', stakeId },
          },
          true,
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }));
  it('recovers selection across a new database client and rejects pre-resume messages', () =>
    database(async (store, url) => {
      const { creator, id } = await setup(store);
      const stakeId = await open(store, creator, id);
      const oldTimestamp = new Date().toISOString();
      await recoverLivewire(store, 'simulation');
      const replacement = new Store(url);
      try {
        expect((await replacement.get(id)).state.livewire!.stake.status).toBe('paused');
        await vote(replacement, creator, 'hull');
        expect(
          (await readLivewire(replacement, (await replacement.get(id)).state)).participants,
        ).toBe(0);
        await action(replacement, creator, id, { type: 'resume', stakeId });
        await vote(replacement, creator, 'hull', 'old', { providerAt: oldTimestamp });
        expect(
          (await readLivewire(replacement, (await replacement.get(id)).state)).participants,
        ).toBe(0);
        await vote(replacement, creator, 'oxygen');
        await action(replacement, creator, id, { type: 'lock', stakeId });
        await action(replacement, creator, id, { type: 'resolve', stakeId, outcome: 'failure' });
        const world = await replacement.get(id);
        expect(replayEvents(id, world.events)).toEqual(world.state);
      } finally {
        await replacement.close();
      }
    }));
  it('rolls back world, event and result on a database failure, then safely retries after restart', () =>
    database(async (store, url) => {
      const { creator, id } = await setup(store);
      const stakeId = await open(store, creator, id);
      await action(store, creator, id, { type: 'lock', stakeId, solo: 'hull' });
      const before = await store.get(id);
      const request: LivewireRequest = {
        expectedVersion: before.revision,
        commandId: randomUUID(),
        action: { type: 'resolve', stakeId, outcome: 'success' },
      };
      await store.pool.query(
        "CREATE FUNCTION fail_result() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event->'command'->>'type'='livewire-resolve' THEN RAISE EXCEPTION 'injected commit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_result BEFORE INSERT ON world_events FOR EACH ROW EXECUTE FUNCTION fail_result()",
      );
      await expect(mutateLivewire(store, creator, id, request, true)).rejects.toThrow(
        'injected commit failure',
      );
      expect((await store.get(id)).state).toEqual(before.state);
      expect(
        (await store.pool.query('SELECT status FROM livewire_stakes WHERE id=$1', [stakeId]))
          .rows[0].status,
      ).toBe('locked');
      await store.pool.query('DROP TRIGGER fail_result ON world_events');
      const replacement = new Store(url);
      try {
        await mutateLivewire(replacement, creator, id, request, true);
        await mutateLivewire(replacement, creator, id, request, true);
        const after = await replacement.get(id);
        expect(after.state.resources.hull).toBe(before.state.resources.hull + 3);
        expect(after.events.filter((e) => e.command.type === 'livewire-resolve')).toHaveLength(1);
      } finally {
        await replacement.close();
      }
    }));
  it('blocks chapter start, parking and handoff until cancelled; rejects raw internal commands', () =>
    database(async (store) => {
      const { creator, id } = await setup(store);
      const target = await store.ensureCreator('sim-beta', 'Beta', 'simulation');
      await store.optIn(target.id, true);
      const stakeId = await open(store, creator, id);
      const world = await store.get(id);
      await expect(
        store.command(
          id,
          { id: creator.id, role: 'host', community: creator.id },
          'simulation',
          world.revision,
          randomUUID(),
          { type: 'start' },
        ),
      ).rejects.toMatchObject({ code: 'LIVEWIRE_PENDING' });
      await expect(
        store.command(
          id,
          { id: creator.id, role: 'host', community: creator.id },
          'simulation',
          world.revision,
          randomUUID(),
          { type: 'livewire-cancel', stakeId },
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(store.park(creator.id, id, false)).rejects.toMatchObject({
        code: 'LIVEWIRE_PENDING',
      });
      await expect(store.prepare(id, creator, target.id, world.revision)).rejects.toMatchObject({
        code: 'LIVEWIRE_PENDING',
      });
      await action(store, creator, id, { type: 'cancel', stakeId });
      await store.park(creator.id, id, false);
      await expect(
        action(store, creator, id, { type: 'open', preset: 'boss', game: 'Game', label: 'Parked' }),
      ).rejects.toMatchObject({ code: 'WORLD_PARKED' });
    }));
  it('bounds a 10,000-participant SQL fixture and keeps canonical state and four projections small', () =>
    database(async (store) => {
      const { creator, id } = await setup(store);
      const stakeId = await open(store, creator, id);
      const before = JSON.stringify((await store.get(id)).state).length;
      await store.pool.query(
        "INSERT INTO livewire_ballots(stake_id,participant,target,provider_at,delivery_key,provider_order) SELECT $1,lpad(to_hex(n),64,'0'),CASE WHEN n<=5000 THEN 'navigation' WHEN n<=8000 THEN 'hull' ELSE 'oxygen' END,clock_timestamp(),n::text,'2026-10-30T10:00:00.000000000Z' FROM generate_series(1,10000) n",
        [stakeId],
      );
      await store.pool.query(
        'UPDATE livewire_stakes SET navigation=5000,hull=3000,oxygen=2000,participants=10000,ballot_revision=10000 WHERE id=$1',
        [stakeId],
      );
      const start = performance.now();
      const outputs = await Promise.all(
        Array.from({ length: 4 }, async () =>
          readLivewire(store, (await store.get(id, true)).state),
        ),
      );
      expect(outputs.every((o) => JSON.stringify(o).length < 250 && o.participants === 10000)).toBe(
        true,
      );
      expect(performance.now() - start).toBeLessThan(2000);
      await vote(store, creator, 'hull', 'participant-10001');
      expect((await readLivewire(store, (await store.get(id)).state)).participants).toBe(10000);
      expect(JSON.stringify((await store.get(id)).state).length).toBe(before);
      await action(store, creator, id, { type: 'lock', stakeId });
      const world = await store.get(id);
      expect(world.state.livewire!.stake.target).toBe('navigation');
      expect(replayEvents(id, world.events)).toEqual(world.state);
    }));
});
