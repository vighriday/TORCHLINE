import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Command, LivewireRequest } from '@torchline/contracts';
import { mutateLivewire, readWorldHistory } from '@torchline/storage';
import type { Creator, Store } from '@torchline/storage';
import { createApp } from '../apps/server/src/app.ts';
import type { AppConfig } from '../apps/server/src/app.ts';
import { database } from './helpers.ts';

const config: AppConfig = {
  mode: 'simulation',
  baseUrl: 'http://localhost:3000',
  sessionSecret: 'ab'.repeat(32),
  tokenKey: 'cd'.repeat(32),
  botSetupSecret: 'fixture',
};
const header = { 'x-torchline-request': '1' };
async function command(store: Store, id: string, creator: Creator, input: Command) {
  return store.command(
    id,
    { id: 'private-actor', role: 'host', community: creator.id },
    creator.mode,
    (await store.get(id)).revision,
    randomUUID(),
    input,
  );
}
async function transfer(store: Store, before?: (id: string, source: Creator) => Promise<void>) {
  const source = await store.ensureCreator('sim-alpha', 'First community', 'simulation');
  const target = await store.ensureCreator('sim-beta', 'Next community', 'simulation');
  await store.optIn(target.id, true);
  const id = await store.create(source);
  await before?.(id, source);
  for (const input of [
    { type: 'start' },
    { type: 'close-challenge' },
    { type: 'commit', option: 'burn-navigation' },
  ] as Command[])
    await command(store, id, source, input);
  const intent = await store.prepare(id, source, target.id, (await store.get(id)).revision);
  await store.observeRaid({
    messageId: randomUUID(),
    sourceId: source.id,
    targetId: target.id,
    mode: 'simulation',
    subscriptionId: 'simulation',
    notificationAt: new Date(intent.prepared_at.getTime() + 10).toISOString(),
  });
  await store.accept(intent.id, target);
  return { source, target, id, intent };
}
const session = async (app: Awaited<ReturnType<typeof createApp>>, channel: string) => {
  const login = await app.inject({
    method: 'POST',
    url: '/api/simulator/login',
    payload: { channel },
    headers: header,
  });
  return {
    ...header,
    cookie: login.cookies.map((item) => `${item.name}=${item.value}`).join('; '),
  };
};

describe('custody arrival briefing', () => {
  it("attributes the inherited Ark to the sending community and clears on the receiver's first command", () =>
    database(async (store) => {
      const { source, target, id } = await transfer(store);
      const app = await createApp(store, config, { workers: false });
      try {
        const receiver = await session(app, 'beta');
        const arrived = await app.inject({ url: '/api/state', headers: receiver });
        expect(arrived.statusCode).toBe(200);
        const world = arrived.json().world;
        expect(world.arrival.from).toEqual({ id: source.id, label: 'First community' });
        expect(world.arrival.briefing).toContain('Received from First community');
        expect(world.arrival.briefing).toContain('216 passengers aboard');
        expect(world.arrival.briefing).toContain('chapter 1');
        expect(Number.isFinite(Date.parse(world.arrival.at))).toBe(true);
        // The source's first chapter ended by burning navigation; the receiver inherits that loss.
        expect(world.arrival.lostSystems).toEqual(['navigation']);
        // The dossier names the decision and the debt it created, attributed to its community.
        expect(world.arrival.decisions).toEqual([
          expect.objectContaining({
            chapter: 1,
            choice: 'Sacrifice navigation',
            community: 'First community',
          }),
        ]);
        expect(world.arrival.debts).toEqual([
          {
            kind: 'blind-jump',
            dueChapter: 2,
            origin: world.arrival.decisions[0],
          },
        ]);
        expect(world.arrival.communities).toBe(2);
        // Presentation names communities; saved events keep the immutable IDs replay needs.
        expect(world.events.at(-1).summary).toContain('committed by First community.');
        expect(world.events.at(-1).summary).not.toContain(source.id);
        expect(
          world.systems.find((system: { id: string }) => system.id === 'navigation').marks[0]
            .community,
        ).toBe('First community');
        expect((await store.get(id)).events.at(-1)?.summary).toContain(
          `committed by ${source.id}.`,
        );
        // The transfer stays attributable in the archive after the briefing clears. Labels are read
        // from the current creator record, so this is checked before the simulator login below
        // replaces that label.
        const history = await readWorldHistory(store, target, id, { limit: 20 });
        expect(history.custody[0].source).toEqual({ id: source.id, label: 'First community' });
        expect(history.custody[0].target.id).toBe(target.id);
        // The previous host no longer owns the record, so no arrival is claimed for them.
        const previous = await session(app, 'alpha');
        expect(
          (await app.inject({ url: '/api/state', headers: previous })).json().world,
        ).toBeNull();

        // The receiver's first command ends the briefing: it is news about an arrival, not decoration.
        await command(store, id, target, { type: 'start' });
        const moved = await app.inject({ url: '/api/state', headers: receiver });
        expect(moved.json().world.arrival).toBeUndefined();
        expect(moved.json().world.phase).not.toBe('ready');
        // The archive keeps the transfer attributable even after the briefing has cleared.
        const later = await readWorldHistory(store, target, id, { limit: 20 });
        expect(later.custody).toHaveLength(1);
        expect(later.custody[0].id).toBe(history.custody[0].id);
      } finally {
        await app.close();
      }
    }));

  it('names every community in the season record once a relayed voyage ends', () =>
    database(async (store) => {
      const { target, id } = await transfer(store);
      for (const option of ['chart-route', 'repair-life', 'salvage', 'land'])
        for (const input of [
          { type: 'start' },
          { type: 'close-challenge' },
          { type: 'commit', option },
        ] as Command[])
          await command(store, id, target, input);
      const app = await createApp(store, config, { workers: false });
      try {
        const receiver = await session(app, 'beta');
        const world = (await app.inject({ url: '/api/state', headers: receiver })).json().world;
        expect(world.outcome).toBeTruthy();
        expect(world.season.relays).toBe(1);
        expect(world.season.communities).toBe(2);
        expect(world.season.decisions.map((item: { choice: string }) => item.choice)).toEqual([
          'Sacrifice navigation',
          'Rebuild navigation',
          'Restore life support',
          'Risk the cargo station',
          'Standard atmospheric entry',
        ]);
        expect(world.season.decisions[0].community).toBe('First community');
        expect(world.season.decisions[1].community).toBe('Simulation beta');
      } finally {
        await app.close();
      }
    }));
  it('names what another game did to the Ark in the dossier and the season record', () =>
    database(async (store) => {
      const mission = async (id: string, creator: Creator, action: LivewireRequest['action']) =>
        mutateLivewire(
          store,
          creator,
          id,
          { expectedVersion: (await store.get(id)).revision, commandId: randomUUID(), action },
          true,
        );
      const { target, id } = await transfer(store, async (id, source) => {
        await mission(id, source, {
          type: 'open',
          preset: 'challenge',
          game: 'Minecraft',
          label: 'Lava gap jump',
        });
        const stakeId = (await store.get(id)).state.livewire!.stake.id;
        await mission(id, source, { type: 'lock', stakeId, solo: 'hull' });
        await mission(id, source, { type: 'resolve', stakeId, outcome: 'failure' });
      });
      const app = await createApp(store, { ...config, livewireEnabled: true }, { workers: false });
      try {
        const receiver = await session(app, 'beta');
        const arrived = (await app.inject({ url: '/api/state', headers: receiver })).json().world;
        // The receiver learns which game cracked the hull and who attested it, before acting.
        expect(arrived.arrival.missions).toEqual([
          expect.objectContaining({
            chapter: 0,
            game: 'Minecraft',
            attempt: 'Lava gap jump',
            outcome: 'failure',
            target: 'hull',
            delta: -6,
            community: 'First community',
          }),
        ]);
        for (const option of ['chart-route', 'repair-life', 'salvage', 'land'])
          for (const input of [
            { type: 'start' },
            { type: 'close-challenge' },
            { type: 'commit', option },
          ] as Command[])
            await command(store, id, target, input);
        const ended = (await app.inject({ url: '/api/state', headers: receiver })).json().world;
        expect(ended.outcome).toBeTruthy();
        expect(ended.season.missions).toEqual([
          expect.objectContaining({ game: 'Minecraft', outcome: 'failure', delta: -6 }),
        ]);
      } finally {
        await app.close();
      }
    }));
  it('reports the inherited damage it can name and never invents an arrival for an untransferred world', () =>
    database(async (store) => {
      const solo = await store.ensureCreator('sim-gamma', 'Solo community', 'simulation');
      const soloWorld = await store.create(solo);
      await command(store, soloWorld, solo, { type: 'start' });
      await command(store, soloWorld, solo, { type: 'close-challenge' });
      await command(store, soloWorld, solo, { type: 'commit', option: 'burn-navigation' });
      const app = await createApp(store, config, { workers: false });
      try {
        const creator = await session(app, 'gamma');
        const state = await app.inject({ url: '/api/state', headers: creator });
        expect(state.json().world.arrival).toBeUndefined();
        const transferred = await transfer(store);
        expect((await store.get(transferred.id)).state.systems.navigation.integrity).toBeLessThan(
          100,
        );
        const receiver = await session(app, 'beta');
        const inherited = await app.inject({ url: '/api/state', headers: receiver });
        expect(inherited.json().world.arrival.from.label).toBe('First community');
        expect(inherited.json().world.arrival.briefing).toContain('lasting marks');
      } finally {
        await app.close();
      }
    }));
});
