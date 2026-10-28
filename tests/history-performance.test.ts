import { expect, it } from 'vitest';
import { readWorldHistory } from '@torchline/storage';
import { database } from './helpers.ts';

it(
  'uses bounded public-history indexes despite a large synthetic ballot log',
  () =>
    database(async (store) => {
      const owner = await store.ensureCreator('history-owner', 'History fixture', 'simulation'),
        id = await store.create(owner);
      // Storage/query fixture only: these synthetic ballot rows are not an engine replay attestation.
      await store.pool.query(
        "INSERT INTO world_events(world_id,sequence,event) SELECT $1,n,jsonb_build_object('id','ballot-'||n,'sequence',n,'command',jsonb_build_object('type','vote')) FROM generate_series(1,50000) n",
        [id],
      );
      await store.pool.query(
        "UPDATE worlds SET state=jsonb_set(state,'{version}','50000'::jsonb) WHERE id=$1",
        [id],
      );
      await store.pool.query('ANALYZE world_events');
      const plan = (
        await store.pool.query(
          "EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT event FROM world_events WHERE world_id=$1 AND sequence<=$2 AND event->'command'->>'type' NOT IN ('vote','allocate','inspect') ORDER BY sequence DESC LIMIT 30",
          [id, 50000],
        )
      ).rows[0]['QUERY PLAN'];
      expect(JSON.stringify(plan)).toContain('world_events_public_tail');
      expect((await store.get(id, true)).events).toHaveLength(0);
      const history = await readWorldHistory(store, owner, id, {
        limit: 25,
        through: 50000,
        before: 45000,
      });
      expect(history.events).toEqual([]);
      expect(history.nextCursor).toBeNull();
      console.log(
        'Public history query fixture:',
        JSON.stringify({
          ballots: 50000,
          executionMs: plan[0]['Execution Time'],
          index: 'world_events_public_tail',
        }),
      );
    }),
  30000,
);
