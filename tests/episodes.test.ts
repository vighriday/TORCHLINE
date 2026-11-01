import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { advanceEpisodes, configureEpisode, recoverEpisodes, Store } from '@torchline/storage';
import type { Creator } from '@torchline/storage';
import type { Command } from '@torchline/contracts';
import { replayEvents } from '@torchline/engine';
import { parseChatCommand } from '@torchline/twitch';
import { createApp } from '../apps/server/src/app.ts';
import { database } from './helpers.ts';
const config = {
  mode: 'simulation' as const,
  baseUrl: 'http://localhost:3000',
  sessionSecret: 'ab'.repeat(32),
  tokenKey: 'cd'.repeat(32),
  botSetupSecret: 'operator-secret',
};
async function setup(store: Store, mode: Creator['mode'] = 'simulation') {
  const creator = await store.ensureCreator(`captain-${mode}`, 'Captain', mode);
  return { creator, id: await store.create(creator) };
}
async function command(store: Store, id: string, creator: Creator, command: Command) {
  return store.command(
    id,
    { id: creator.id, role: 'host', community: creator.id },
    creator.mode,
    (await store.get(id)).revision,
    randomUUID(),
    command,
  );
}
async function expire(store: Store, id: string) {
  await store.pool.query(
    "UPDATE episode_clocks SET deadline_at=clock_timestamp()-interval '1 second' WHERE world_id=$1",
    [id],
  );
}

describe('persisted hosted episode policy', () => {
  it('closes each timed phase exactly once, never commits story, and replays all rules', () =>
    database(async (store) => {
      const { creator, id } = await setup(store);
      await command(store, id, creator, {
        type: 'configure-cooperation',
        budget: 5,
        investigation: true,
      });
      await command(store, id, creator, { type: 'start' });
      expect((await store.get(id)).clock?.phase).toBe('investigation');
      for (const phase of ['challenge', 'allocation', 'decision', 'awaiting-commit']) {
        await expire(store, id);
        await Promise.all([
          advanceEpisodes(store, 'simulation'),
          advanceEpisodes(store, 'simulation'),
        ]);
        expect((await store.get(id)).state.phase).toBe(phase);
      }
      const world = await store.get(id);
      expect(world.state.chapter).toBe(1);
      expect(world.state.outcome).toBeNull();
      expect(world.clock?.deadline_at).toBeNull();
      expect(replayEvents(id, world.events)).toEqual(world.state);
      expect(world.events.filter((e) => e.command.type === 'close-challenge')).toHaveLength(1);
    }));
  it('saves remaining time through pause, park, database reconnection and explicit resume', () =>
    database(async (store, url) => {
      const { creator, id } = await setup(store);
      await command(store, id, creator, { type: 'start' });
      await store.pool.query(
        "UPDATE episode_clocks SET deadline_at=clock_timestamp()+interval '40 seconds' WHERE world_id=$1",
        [id],
      );
      const before = (await store.get(id)).state.resources;
      await store.park(creator.id, id, false);
      let world = await store.get(id);
      expect(world.state.phase).toBe('paused');
      expect(world.clock?.deadline_at).toBeNull();
      expect(world.clock?.remaining_ms).toBeGreaterThan(39000);
      expect(world.clock?.remaining_ms).toBeLessThanOrEqual(40000);
      const reopened = new Store(url);
      try {
        world = await reopened.get(id);
        expect(world.state.resources).toEqual(before);
      } finally {
        await reopened.close();
      }
      await store.park(creator.id, id, true);
      expect((await store.get(id)).state.phase).toBe('paused');
      world = await command(store, id, creator, { type: 'resume' });
      expect(world.state.phase).toBe('challenge');
      expect(world.clock?.deadline_at?.getTime()).toBeGreaterThan(Date.now() + 38000);
      expect(replayEvents(id, world.events)).toEqual(world.state);
    }));
  it('restores the last healthy remaining duration on restart, once, without outage drain', () =>
    database(async (store) => {
      const { creator, id } = await setup(store);
      await command(store, id, creator, { type: 'start' });
      await store.pool.query(
        "UPDATE episode_clocks SET observed_at=clock_timestamp()-interval '5 minutes',deadline_at=clock_timestamp()-interval '4 minutes' WHERE world_id=$1",
        [id],
      );
      const resources = (await store.get(id)).state.resources;
      await recoverEpisodes(store, 'simulation');
      await recoverEpisodes(store, 'simulation');
      let world = await store.get(id);
      expect(world.state.phase).toBe('paused');
      expect(world.clock?.remaining_ms).toBe(60000);
      expect(world.clock?.recovery_reason).toContain('restart');
      expect(world.state.resources).toEqual(resources);
      expect(world.events.filter((e) => e.command.type === 'pause')).toHaveLength(1);
      world = await command(store, id, creator, { type: 'resume' });
      expect(world.clock?.deadline_at?.getTime()).toBeGreaterThan(Date.now() + 59000);
    }));
  it('drains pre-cutoff accepted chat and rejects late provider or browser input', () =>
    database(async (store) => {
      const { creator, id } = await setup(store, 'live');
      await command(store, id, creator, { type: 'start' });
      const timestamp = (
        await store.pool.query('SELECT clock_timestamp() AS at')
      ).rows[0].at.toISOString();
      await store.enqueueChat(
        'early',
        creator.id,
        'viewer',
        { type: 'scan', node: 'A' },
        timestamp,
      );
      await expire(store, id);
      await advanceEpisodes(store, 'live');
      expect((await store.get(id)).state.phase).toBe('challenge');
      await store.enqueueChat(
        'late',
        creator.id,
        'late-viewer',
        { type: 'scan', node: 'B' },
        timestamp,
      );
      expect(
        (await store.pool.query("SELECT payload FROM eventsub_inbox WHERE message_id='late'"))
          .rows[0].payload.kind,
      ).toBe('ignored');
      await expect(command(store, id, creator, { type: 'scan', node: 'C' })).rejects.toMatchObject({
        code: 'WINDOW_CLOSED',
      });
      const item = (
        await store.pool.query("SELECT payload FROM eventsub_inbox WHERE message_id='early'")
      ).rows[0].payload;
      await store.command(
        id,
        { id: item.actorId, role: 'viewer', community: creator.id },
        'live',
        (await store.get(id)).revision,
        'eventsub:early',
        item.command,
        { id: 'early', window: item.window },
      );
      await advanceEpisodes(store, 'live');
      const world = await store.get(id);
      expect(world.state.phase).toBe('decision');
      expect(world.state.challenge.scanned).toContain('A');
    }));
  it('supports manual settings at ready boundaries and denies unrelated or mid-phase changes', () =>
    database(async (store) => {
      const { creator, id } = await setup(store);
      const other = await store.ensureCreator('other', 'Other', 'simulation');
      const manual = { investigation: null, challenge: null, allocation: null, decision: null };
      await expect(configureEpisode(store, other, id, manual)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await configureEpisode(store, creator, id, manual);
      await command(store, id, creator, { type: 'start' });
      expect((await store.get(id)).clock?.deadline_at).toBeNull();
      await expect(configureEpisode(store, creator, id, manual)).rejects.toMatchObject({
        code: 'INVALID_PHASE',
      });
      await advanceEpisodes(store, 'simulation');
      expect((await store.get(id)).state.phase).toBe('challenge');
    }));
  it('fences a second worker and releases ownership on close', () =>
    database(async (store) => {
      const first = await createApp(store, config);
      const second = await createApp(store, config);
      try {
        await first.ready();
        await expect(second.ready()).rejects.toThrow('Another TORCHLINE worker');
      } finally {
        await second.close();
        await first.close();
      }
      const replacement = await createApp(store, config);
      try {
        await replacement.ready();
      } finally {
        await replacement.close();
      }
    }));
  it('parses bounded real-chat cooperation without host authority', () => {
    expect(parseChatCommand('!inspect LIFE')).toEqual({ type: 'inspect', area: 'life' });
    expect(parseChatCommand('!allocate 3 2')).toEqual({ type: 'allocate', hull: 3, oxygen: 2 });
    expect(parseChatCommand('!allocate hull 3 oxygen 2')).toEqual({
      type: 'allocate',
      hull: 3,
      oxygen: 2,
    });
    expect(parseChatCommand('!allocate O2 4 HULL 1')).toEqual({
      type: 'allocate',
      hull: 1,
      oxygen: 4,
    });
    expect(parseChatCommand('!allocate hull 2')).toEqual({ type: 'allocate', hull: 2, oxygen: 0 });
    for (const value of [
      '!allocate hull 3 hull 2',
      '!allocate hull 4 oxygen 4',
      '!allocate power 3',
      '!allocate hull',
      '!allocate 5 5',
      '!allocate 0 0',
      '!allocate -1 2',
      '!allocate 1e0 2',
      '!allocate 1 2 3',
      '!inspect reactor',
      '!close-allocation',
      '!configure-cooperation 10',
    ])
      expect(parseChatCommand(value)).toBeNull();
  });
});
