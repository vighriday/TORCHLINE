import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DomainError } from '@torchline/contracts';
import type { Command } from '@torchline/contracts';
import { replayEvents } from '@torchline/engine';
import { Store } from '@torchline/storage';
import { database } from './helpers.ts';

async function boundaryWorld(store: Store, sourceId: string) {
  const creator = await store.ensureCreator(sourceId, sourceId, 'simulation');
  const id = await store.create(creator);
  for (const command of [
    { type: 'start' },
    { type: 'close-challenge' },
    { type: 'commit', option: 'burn-navigation' },
  ] as Command[]) {
    const world = await store.get(id);
    await store.command(
      id,
      { id: sourceId, role: 'host', community: sourceId },
      'simulation',
      world.revision,
      randomUUID(),
      command,
    );
  }
  return { creator, id };
}
describe('real PostgreSQL consistency', () => {
  it('rejects stale creator mutations and new chat ingress after explicit disconnection', () =>
    database(async (store) => {
      const creator = await store.ensureCreator('42', 'Creator', 'live');
      const id = await store.create(creator);
      const actor = { id: creator.id, community: creator.id, role: 'host' as const };
      await store.command(id, actor, 'live', 0, randomUUID(), { type: 'start' });
      const before = await store.get(id);
      await store.disconnectCreator(creator.id);
      await expect(store.create(creator)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(store.park(creator.id, id, false)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(store.optIn(creator.id, true)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        store.command(id, actor, 'live', before.revision, randomUUID(), {
          type: 'close-challenge',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await store.enqueueChat(
        'late-input',
        creator.id,
        'viewer',
        { type: 'scan', node: 'A' },
        new Date().toISOString(),
      );
      expect(
        (
          await store.pool.query(
            "SELECT processed_at,payload FROM eventsub_inbox WHERE message_id='late-input'",
          )
        ).rows[0],
      ).toMatchObject({ payload: { kind: 'ignored' } });
      expect((await store.get(id)).state).toMatchObject({
        phase: 'paused',
        resumePhase: before.state.phase,
        resources: before.state.resources,
        systems: before.state.systems,
      });
      expect((await store.pool.query('SELECT 1 FROM worlds')).rowCount).toBe(1);
    }));
  it('cancels an incoming offer on disconnect and preserves source custody and game state', () =>
    database(async (store) => {
      const source = await boundaryWorld(store, 'source');
      const receiver = await store.ensureCreator('receiver', 'Receiver', 'simulation');
      await store.optIn(receiver.id, true);
      const before = await store.get(source.id);
      const intent = await store.prepare(source.id, source.creator, receiver.id, before.revision);
      await store.disconnectCreator(receiver.id);
      expect((await store.get(source.id)).state).toEqual(before.state);
      expect((await store.get(source.id)).custodian_id).toBe(source.creator.id);
      expect((await store.get(source.id)).frozen_by).toBeNull();
      expect((await store.handoffs(receiver.id)).find((row) => row.id === intent.id)?.status).toBe(
        'declined',
      );
    }));
  it('persists across repository reconnection and reconstructs JSONB history exactly', () =>
    database(async (store, url) => {
      const { creator, id } = await boundaryWorld(store, 'source');
      const before = await store.get(id);
      expect(replayEvents(id, before.events)).toEqual(before.state);
      const reopened = new Store(url);
      try {
        expect((await reopened.get(id)).state).toEqual(before.state);
      } finally {
        await reopened.close();
      }
      await store.park(creator.id, id, false);
      expect(await store.active(creator.id)).toBeNull();
      await store.park(creator.id, id, true);
      expect((await store.active(creator.id))?.state).toEqual(before.state);
      await expect(
        store.pool.query(
          "UPDATE worlds SET state=jsonb_set(state,'{resources,hull}','-1') WHERE id=$1",
          [id],
        ),
      ).rejects.toHaveProperty('code', '23514');
    }));
  it('releases a finished voyage so the captain can launch the next Ark', () =>
    database(async (store) => {
      const owner = await store.ensureCreator('captain', 'Captain', 'simulation');
      const first = await store.create(owner);
      const actor = { id: owner.id, role: 'host' as const, community: owner.id };
      for (const option of ['burn-navigation', 'chart-route', 'repair-life', 'salvage', 'land']) {
        for (const command of [
          { type: 'start' },
          { type: 'close-challenge' },
          { type: 'commit', option },
        ] as Command[])
          await store.command(
            first,
            actor,
            'simulation',
            (await store.get(first)).revision,
            randomUUID(),
            command,
          );
      }
      const finished = await store.get(first);
      expect(finished.state).toMatchObject({ phase: 'ended', outcome: 'colony' });
      const second = await store.create(owner);
      expect(second).not.toBe(first);
      expect((await store.active(owner.id))?.id).toBe(second);
      // The memorial keeps its exact final state and remains in the captain's library.
      expect((await store.get(first)).state).toEqual(finished.state);
      expect((await store.get(first)).revision).toBe(finished.revision + 1);
      expect((await store.library(owner.id)).map((row) => row.id)).toEqual(
        expect.arrayContaining([first, second]),
      );
      // An unfinished world still blocks a second launch.
      await expect(store.create(owner)).rejects.toMatchObject({ code: 'CHANNEL_BUSY' });
    }));
  it('lets a receiver whose voyage ended inherit another Ark without losing the memorial', () =>
    database(async (store) => {
      const receiver = await store.ensureCreator('receiver', 'Receiver', 'simulation');
      const finished = await store.create(receiver);
      await store.pool.query(
        "UPDATE worlds SET state=jsonb_set(jsonb_set(state,'{phase}','\"ended\"'),'{outcome}','\"wreck\"') WHERE id=$1",
        [finished],
      );
      await store.optIn(receiver.id, true);
      const source = await boundaryWorld(store, 'source');
      const intent = await store.prepare(
        source.id,
        source.creator,
        receiver.id,
        (await store.get(source.id)).revision,
      );
      // Preparing never edits the receiver's channel; only their explicit acceptance does.
      expect((await store.active(receiver.id))?.id).toBe(finished);
      await store.observeRaid({
        messageId: 'finished-receiver-proof',
        mode: 'simulation',
        sourceId: source.creator.id,
        targetId: receiver.id,
        subscriptionId: 'simulation-only',
        // Evidence must fall inside the offer window measured by the database clock.
        notificationAt: new Date(intent.prepared_at.getTime() + 10).toISOString(),
      });
      await store.accept(intent.id, receiver);
      expect((await store.active(receiver.id))?.id).toBe(source.id);
      expect((await store.get(finished)).state).toMatchObject({ phase: 'ended', outcome: 'wreck' });
      expect((await store.library(receiver.id)).map((row) => row.id)).toContain(finished);
    }));
  it('returns a bounded projection from commands however long the saved log grows', () =>
    database(async (store) => {
      const owner = await store.ensureCreator('captain', 'Captain', 'simulation');
      const id = await store.create(owner);
      const host = { id: owner.id, role: 'host' as const, community: owner.id };
      for (const command of [{ type: 'start' }, { type: 'close-challenge' }] as Command[])
        await store.command(
          id,
          host,
          'simulation',
          (await store.get(id)).revision,
          randomUUID(),
          command,
        );
      for (let index = 0; index < 45; index++)
        await store.command(
          id,
          { id: `viewer-${index}`, role: 'viewer', community: owner.id },
          'simulation',
          (await store.get(id, true)).revision,
          randomUUID(),
          { type: 'vote', option: String((index % 2) + 1) },
        );
      const returned = await store.command(
        id,
        host,
        'simulation',
        (await store.get(id, true)).revision,
        randomUUID(),
        { type: 'commit', option: 'seal-habitat' },
      );
      expect((await store.get(id)).events.length).toBeGreaterThan(45);
      // Votes stay out of the recent projection, and it never carries the whole log.
      expect(returned.events.length).toBeLessThanOrEqual(30);
      expect(returned.events.some((event) => event.command.type === 'vote')).toBe(false);
      expect(returned.state.phase).toBe('ready');
    }));
  it('deduplicates commands and refuses a reused ID with different content', () =>
    database(async (store) => {
      const owner = await store.ensureCreator('source', 'A', 'simulation');
      const id = await store.create(owner);
      const commandId = randomUUID();
      await store.command(
        id,
        { id: 'source', role: 'host', community: 'source' },
        'simulation',
        0,
        commandId,
        { type: 'start' },
      );
      await store.command(
        id,
        { id: 'source', role: 'host', community: 'source' },
        'simulation',
        0,
        commandId,
        { type: 'start' },
      );
      expect((await store.get(id)).events.length).toBe(1);
      await expect(
        store.command(
          id,
          { id: 'source', role: 'host', community: 'source' },
          'simulation',
          1,
          commandId,
          { type: 'close-challenge' },
        ),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    }));
  it('allows exactly one concurrent mutation at a known revision', () =>
    database(async (store) => {
      const owner = await store.ensureCreator('source', 'A', 'simulation');
      const id = await store.create(owner);
      const results = await Promise.allSettled(
        [1, 2].map(() =>
          store.command(
            id,
            { id: 'source', role: 'host', community: 'source' },
            'simulation',
            0,
            randomUUID(),
            { type: 'start' },
          ),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await store.get(id)).state.resources.hull).toBe(70);
    }));
  it('requires proof and receiver consent, then preserves the entire physical world exactly once', () =>
    database(async (store) => {
      const { creator, id } = await boundaryWorld(store, 'source');
      const target = await store.ensureCreator('target', 'B', 'simulation');
      await store.optIn(target.id, true);
      const before = await store.get(id);
      const intent = await store.prepare(id, creator, target.id, before.revision);
      await expect(store.accept(intent.id, target)).rejects.toMatchObject({
        code: 'PROOF_REQUIRED',
      });
      await expect(
        store.command(
          id,
          { id: creator.id, role: 'host', community: creator.id },
          'simulation',
          intent.frozen_revision,
          randomUUID(),
          { type: 'start' },
        ),
      ).rejects.toMatchObject({ code: 'HANDOFF_PENDING' });
      const proof = {
        messageId: 'native-fixture',
        sourceId: creator.id,
        targetId: target.id,
        mode: 'simulation' as const,
        subscriptionId: 'test',
        notificationAt: new Date(
          Math.max(Date.now(), intent.prepared_at.getTime() + 1),
        ).toISOString(),
      };
      await store.observeRaid(proof);
      await store.observeRaid(proof);
      await Promise.all([store.accept(intent.id, target), store.accept(intent.id, target)]);
      const inherited = await store.get(id);
      expect(inherited.state).toEqual(before.state);
      expect(inherited.state.systems.navigation.condition).toBe('destroyed');
      expect(inherited.custodian_id).toBe(target.id);
      expect(before.clock).toBeDefined();
      expect(inherited.clock).toBeUndefined();
      expect(await store.active(creator.id)).toBeNull();
      expect((await store.pool.query('SELECT * FROM custody_events')).rows).toHaveLength(1);
      await expect(
        store.command(
          id,
          { id: creator.id, role: 'host', community: creator.id },
          'simulation',
          inherited.revision,
          randomUUID(),
          { type: 'start' },
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(replayEvents(id, inherited.events)).toEqual(inherited.state);
    }));
  it('serializes competing source worlds claiming one destination without losing either world', () =>
    database(async (store) => {
      const a = await boundaryWorld(store, 'source-a');
      const b = await boundaryWorld(store, 'source-b');
      const target = await store.ensureCreator('target', 'Target', 'simulation');
      await store.optIn(target.id, true);
      const ia = await store.prepare(a.id, a.creator, target.id, (await store.get(a.id)).revision);
      const ib = await store.prepare(b.id, b.creator, target.id, (await store.get(b.id)).revision);
      for (const intent of [ia, ib])
        await store.observeRaid({
          messageId: randomUUID(),
          sourceId: intent.source_id,
          targetId: target.id,
          mode: 'simulation',
          subscriptionId: 'test',
          notificationAt: new Date(
            Math.max(Date.now(), intent.prepared_at.getTime() + 1),
          ).toISOString(),
        });
      const results = await Promise.allSettled([
        store.accept(ia.id, target),
        store.accept(ib.id, target),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        (await store.pool.query('SELECT * FROM channel_slots WHERE channel_id=$1', [target.id]))
          .rowCount,
      ).toBe(1);
      expect((await store.pool.query('SELECT * FROM worlds')).rowCount).toBe(2);
      const loser = results[0].status === 'fulfilled' ? ib : ia;
      expect((await store.get(loser.world_id)).custodian_id).toBe(loser.source_id);
      expect(
        (results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason,
      ).toBeInstanceOf(DomainError);
    }));
  it('fails closed for wrong mode, late proof, opt-out, cancellation and expiry', () =>
    database(async (store) => {
      const { creator, id } = await boundaryWorld(store, 'source');
      const target = await store.ensureCreator('target', 'B', 'simulation');
      await store.optIn(target.id, true);
      const intent = await store.prepare(id, creator, target.id, (await store.get(id)).revision);
      await expect(store.cancel(intent.id, target.id, 'cancelled')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(store.cancel(intent.id, creator.id, 'declined')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await store.observeRaid({
        messageId: 'wrong-mode',
        sourceId: creator.id,
        targetId: target.id,
        mode: 'live',
        subscriptionId: 'test',
        notificationAt: new Date(
          Math.max(Date.now(), intent.prepared_at.getTime() + 1),
        ).toISOString(),
      });
      await expect(store.accept(intent.id, target)).rejects.toMatchObject({
        code: 'PROOF_REQUIRED',
      });
      await store.observeRaid({
        messageId: 'valid-fixture',
        sourceId: creator.id,
        targetId: target.id,
        mode: 'simulation',
        subscriptionId: 'test',
        notificationAt: new Date(
          Math.max(Date.now(), intent.prepared_at.getTime() + 1),
        ).toISOString(),
      });
      await store.optIn(target.id, false);
      await expect(store.accept(intent.id, target)).rejects.toMatchObject({
        code: 'TARGET_UNAVAILABLE',
      });
      await store.cancel(intent.id, creator.id, 'cancelled');
      expect((await store.get(id)).frozen_by).toBeNull();
      expect((await store.get(id)).custodian_id).toBe(creator.id);
      await store.optIn(target.id, true);
      await expect(
        store.prepare(id, creator, target.id, (await store.get(id)).revision),
      ).rejects.toMatchObject({ code: 'PAIR_COOLDOWN' });
      const alternative = await store.ensureCreator('another', 'C', 'simulation');
      await store.optIn(alternative.id, true);
      const expired = await store.prepare(
        id,
        creator,
        alternative.id,
        (await store.get(id)).revision,
        -1,
      );
      await store.expire();
      expect((await store.handoffs(creator.id)).find((h) => h.id === expired.id)?.status).toBe(
        'expired',
      );
      expect((await store.get(id)).frozen_by).toBeNull();
    }));
  it('drains accepted chat before closing and rejects messages from an old resumed window', () =>
    database(async (store) => {
      const owner = await store.ensureCreator('live-channel', 'Live', 'live');
      const id = await store.create(owner);
      let world = await store.get(id);
      await store.command(
        id,
        { id: owner.id, community: owner.id, role: 'host' },
        'live',
        world.revision,
        randomUUID(),
        { type: 'start' },
      );
      world = await store.get(id);
      await store.enqueueChat(
        'msg-1',
        owner.id,
        'viewer-hash',
        { type: 'scan', node: 'A' },
        (await store.pool.query('SELECT clock_timestamp() AS at')).rows[0].at.toISOString(),
      );
      await expect(
        store.command(
          id,
          { id: owner.id, community: owner.id, role: 'host' },
          'live',
          world.revision,
          randomUUID(),
          { type: 'close-challenge' },
        ),
      ).rejects.toMatchObject({ code: 'INPUT_PENDING' });
      const item = (
        await store.pool.query('SELECT payload FROM eventsub_inbox WHERE message_id=$1', ['msg-1'])
      ).rows[0].payload;
      await store.command(
        id,
        { id: item.actorId, role: 'viewer', community: owner.id },
        'live',
        world.revision,
        'eventsub:msg-1',
        item.command,
        { id: 'msg-1', window: item.window },
      );
      world = await store.get(id);
      expect(world.state.challenge.scanned).toContain('A');
      await store.command(
        id,
        { id: owner.id, community: owner.id, role: 'host' },
        'live',
        world.revision,
        randomUUID(),
        { type: 'close-challenge' },
      );
      await store.enqueueChat(
        'old-message',
        owner.id,
        'viewer-hash',
        { type: 'vote', option: '1' },
        '2000-01-01T00:00:00.000Z',
      );
      expect(
        (
          await store.pool.query('SELECT processed_at FROM eventsub_inbox WHERE message_id=$1', [
            'old-message',
          ])
        ).rows[0].processed_at,
      ).not.toBeNull();
    }));
});
