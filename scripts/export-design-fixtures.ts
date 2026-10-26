import { mkdir, writeFile } from 'node:fs/promises';
import { applyCommand, createWorld } from '@torchline/engine';
import type { Command, WorldEvent } from '@torchline/contracts';
import { presentWorld } from '../apps/server/src/projection.ts';
import type { StoredWorld } from '@torchline/storage';
const prefix: Command[] = [
  { type: 'start' },
  { type: 'close-challenge' },
  { type: 'commit', option: 'burn-navigation' },
  { type: 'start' },
  { type: 'close-challenge' },
  { type: 'commit', option: 'chart-route' },
  { type: 'start' },
];
const work: Command[] = ['A', 'B', 'C'].flatMap((node) => [
  { type: 'scan', node },
  { type: 'patch', node },
]) as Command[];
const cargo: Command[] = [
  ...prefix,
  { type: 'close-challenge' },
  { type: 'commit', option: 'repair-life' },
  { type: 'start' },
  { type: 'close-challenge' },
  { type: 'commit', option: 'jettison' },
];
const scenarios: Record<string, Command[]> = {
  pristine: [],
  'navigation-sacrificed': prefix.slice(0, 3),
  leaking: prefix,
  'repaired-with-scars': [...prefix, ...work],
  'cargo-jettisoned': cargo,
  inherited: prefix.slice(0, 3),
  wreck: [
    { type: 'start' },
    { type: 'close-challenge' },
    { type: 'commit', option: 'burn-navigation' },
    { type: 'start' },
    { type: 'close-challenge' },
    { type: 'commit', option: 'manual-flight' },
    { type: 'start' },
    { type: 'close-challenge' },
    { type: 'commit', option: 'repair-life' },
    { type: 'start' },
    { type: 'close-challenge' },
    { type: 'commit', option: 'salvage' },
  ],
};
await mkdir('docs/design/fixtures', { recursive: true });
for (const [name, commands] of Object.entries(scenarios)) {
  let state = createWorld('design-fixture-ark');
  const events: WorldEvent[] = [];
  for (const command of commands) {
    const next = applyCommand(
      state,
      command,
      {
        id: command.type === 'patch' ? 'fixture-viewer' : 'fixture-host',
        role: command.type === 'patch' ? 'viewer' : 'host',
        community: 'Fixture community A',
      },
      { commandId: `fixture-${state.version + 1}`, at: '2026-10-26T10:00:00.000Z' },
    );
    state = next.state;
    events.push(next.event);
  }
  const world: StoredWorld = {
    id: state.id,
    mode: 'simulation',
    custodian_id: name === 'inherited' ? 'fixture-b' : 'fixture-a',
    revision: state.version + (name === 'inherited' ? 2 : 0),
    state,
    frozen_by: null,
    label: name === 'inherited' ? 'Fixture community B' : 'Fixture community A',
    events,
  };
  await writeFile(
    `docs/design/fixtures/${name}.json`,
    JSON.stringify(presentWorld(world), null, 2) + '\n',
  );
}
console.log(
  'Exported seven deterministic, simulation-labeled design fixtures from actual engine actions.',
);
