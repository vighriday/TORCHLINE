import { randomUUID } from 'node:crypto';
import { Store } from '@torchline/storage';
import { applyCommand } from '@torchline/engine';
import type { Actor, Command, WorldEvent, WorldState } from '@torchline/contracts';
export const host: Actor = { id: 'host', role: 'host', community: 'Community A' };
export const viewer: Actor = { id: 'viewer-one', role: 'viewer', community: 'Community A' };
export const context = (state: WorldState) => ({
  commandId: `test-command-${state.version + 1}`,
  at: '2026-10-26T10:00:00.000Z',
});
export function act(state: WorldState, command: Command, actor = host) {
  return applyCommand(state, command, actor, context(state));
}
export function play(state: WorldState, commands: Command[], actor = host) {
  const events: WorldEvent[] = [];
  for (const command of commands) {
    const next = act(state, command, actor);
    state = next.state;
    events.push(next.event);
  }
  return { state, events };
}
export async function database<T>(run: (store: Store, url: string) => Promise<T>): Promise<T> {
  if (!process.env.DATABASE_URL)
    throw new Error(
      'Integration tests require DATABASE_URL pointing to an isolated development database. Run pnpm db:up.',
    );
  const admin = new Store(process.env.DATABASE_URL, { statementMs: 60000 });
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('options', `-c search_path=${schema}`);
  await admin.pool.query(`CREATE SCHEMA "${schema}"`);
  const store = new Store(url.toString());
  try {
    await store.migrate();
    return await run(store, url.toString());
  } finally {
    await store.close();
    await admin.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.close();
  }
}
