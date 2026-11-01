import { expect, it } from 'vitest';
import { database } from './helpers.ts';
import { sweepRetention, RETENTION_POLICY } from '@torchline/storage';

const ago = (days: number) => `now() - interval '${days} days'`;

it('sweeps terminal operational rows while preserving pending input and every proof record', () =>
  database(async (store) => {
    const creator = await store.ensureCreator('live-alpha', 'Live alpha', 'live');
    const source = await store.ensureCreator('live-source', 'Live source', 'live');
    const id = await store.create(creator);
    await store.pool.query(
      'INSERT INTO channel_slots(channel_id,world_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [creator.id, id],
    );
    const chat = (message: string, age: number, processed: boolean, error: string | null = null) =>
      store.pool.query(
        `INSERT INTO eventsub_inbox(message_id,type,payload,received_at,processed_at,error)
         VALUES($1,'channel.chat.message',$2,${ago(age)},${processed ? 'now()' : 'NULL'},$3)`,
        [message, { kind: 'chat', channelId: creator.id, worldId: id }, error],
      );
    for (let i = 0; i < 3; i++) await chat(`old-applied-${i}`, 30, true);
    await chat('old-quarantined', 30, true, 'RETRY_EXHAUSTED');
    await chat('old-rejected', 30, false, 'INPUT_REJECTED');
    await chat('recent-applied', 1, true);
    await chat('pending-input', 30, false);
    await store.pool.query(
      `INSERT INTO chat_message_dedup(channel_id,message_id,received_at)
       SELECT $1,'dedup-'||i,${ago(30)} FROM generate_series(1,4) AS i`,
      [creator.id],
    );
    await store.pool.query(
      `INSERT INTO chat_message_dedup(channel_id,message_id,received_at) VALUES($1,'dedup-recent',now())`,
      [creator.id],
    );
    await store.pool.query(
      `INSERT INTO outbox(world_id,revision,delivered_at,created_at)
       SELECT $1,i,now(),${ago(30)} FROM generate_series(1,2) AS i`,
      [id],
    );
    await store.pool.query(
      `INSERT INTO outbox(world_id,revision,delivered_at,created_at) VALUES($1,9,NULL,${ago(30)})`,
      [id],
    );
    await store.pool.query(
      `INSERT INTO sessions(hash,channel_id,expires_at) VALUES
        ('expired-old',$1,now()-interval '3 days'),('expired-recent',$1,now()-interval '10 minutes'),
        ('current',$1,now()+interval '1 hour')`,
      [creator.id],
    );
    await store.pool.query(
      `INSERT INTO oauth_states(hash,role,expires_at) VALUES
        ('state-old','creator',now()-interval '2 hours'),('state-current','creator',now()+interval '1 hour')`,
    );
    await store.pool.query(
      `INSERT INTO input_limits(world_id,input_window,subject,tokens,observed_at)
       VALUES($1,1,'viewer',0.5,${ago(30)}),($1,1,'recent',0.5,now())`,
      [id],
    );
    await store.pool.query(
      `INSERT INTO input_rejections(world_id,input_window,reason,dropped) VALUES($1,1,'RATE_LIMITED',3)`,
      [id],
    );
    // Proof and history: a sweep that removed any of these would be destroying the record.
    await store.pool.query(
      `INSERT INTO world_events(world_id,sequence,event) VALUES($1,1,'{"summary":"launched"}')`,
      [id],
    );
    await store.pool.query(
      `INSERT INTO world_commands(world_id,actor_id,command_id,request_hash) VALUES($1,'captain','cmd-1','hash')`,
      [id],
    );
    await store.pool.query(
      `INSERT INTO raid_proofs(message_id,mode,source_id,target_id,subscription_id,notification_at,received_at)
       VALUES('raid-1','live','live-source',$1,'sub-1',${ago(30)},${ago(30)})`,
      [creator.id],
    );
    await store.pool.query(
      `INSERT INTO handoffs(id,world_id,source_id,target_id,mode,status,frozen_revision,proof_id,prepared_at,expires_at)
       VALUES('handoff-1',$1,'live-source',$2,'live','expired',1,'raid-1',${ago(30)},${ago(30)})`,
      [id, creator.id],
    );
    await store.pool.query(
      `INSERT INTO custody_events(id,world_id,source_id,target_id,proof_id,mode,created_at)
       VALUES('custody-1',$1,'live-source',$2,'raid-1','live',${ago(30)})`,
      [id, creator.id],
    );
    const appliedTotals = async () => {
      const live = (
        await store.pool.query(
          "SELECT count(*)::integer AS count FROM eventsub_inbox WHERE processed_at IS NOT NULL AND error IS NULL AND payload->>'kind'='chat' AND payload->>'channelId'=$1",
          [creator.id],
        )
      ).rows[0].count as number;
      const folded = (
        await store.pool.query(
          "SELECT value::integer AS value FROM retention_totals WHERE channel_id=$1 AND kind='applied_chat'",
          [creator.id],
        )
      ).rows[0]?.value as number | undefined;
      return live + (folded ?? 0);
    };
    expect(await appliedTotals()).toBe(4);

    const result = await sweepRetention(store);
    expect(result).toMatchObject({
      foldedChat: 3,
      foldedQuarantined: 1,
      inbox: 5,
      dedup: 4,
      outbox: 2,
      sessions: 1,
      oauthStates: 1,
      inputLimits: 1,
      inputRejections: 0,
    });
    // The lifetime diagnostics the dashboard reads are unchanged by the sweep.
    expect(await appliedTotals()).toBe(4);
    expect(
      (
        await store.pool.query(
          "SELECT value::integer AS value FROM retention_totals WHERE channel_id=$1 AND kind='quarantined'",
          [creator.id],
        )
      ).rows[0].value,
    ).toBe(1);
    const remaining = (
      await store.pool.query('SELECT message_id FROM eventsub_inbox ORDER BY message_id')
    ).rows.map((row) => row.message_id);
    expect(remaining).toEqual(['pending-input', 'recent-applied']);
    expect(
      (await store.pool.query('SELECT count(*)::integer AS count FROM chat_message_dedup')).rows[0]
        .count,
    ).toBe(1);
    const pendingOutbox = (await store.pool.query('SELECT delivered_at FROM outbox')).rows;
    expect(pendingOutbox.every((row) => row.delivered_at === null)).toBe(true);
    expect(pendingOutbox.length).toBeGreaterThan(0);
    expect(
      (await store.pool.query('SELECT hash FROM sessions ORDER BY hash')).rows.map(
        (row) => row.hash,
      ),
    ).toEqual(['current', 'expired-recent']);
    expect(
      (await store.pool.query('SELECT hash FROM oauth_states')).rows.map((row) => row.hash),
    ).toEqual(['state-current']);
    expect(
      (await store.pool.query('SELECT subject FROM input_limits')).rows.map((row) => row.subject),
    ).toEqual(['recent']);
    for (const [table, count] of [
      ['world_events', 1],
      ['world_commands', 1],
      ['raid_proofs', 1],
      ['handoffs', 1],
      ['custody_events', 1],
    ] as const)
      expect(
        (await store.pool.query(`SELECT count(*)::integer AS count FROM ${table}`)).rows[0].count,
      ).toBe(count);
    // A second sweep finds nothing left and changes no total.
    const again = await sweepRetention(store);
    expect(again.inbox + again.dedup + again.outbox).toBe(0);
    expect(await appliedTotals()).toBe(4);
  }));

it('bounds each sweep so a first run on a long-lived channel cannot block the worker', () =>
  database(async (store) => {
    const creator = await store.ensureCreator('live-alpha', 'Live alpha', 'live');
    await store.pool.query(
      `INSERT INTO eventsub_inbox(message_id,type,payload,received_at,processed_at)
       SELECT 'bulk-'||i,'channel.chat.message',$1,${ago(30)},now() FROM generate_series(1,7) AS i`,
      [{ kind: 'chat', channelId: creator.id }],
    );
    const result = await sweepRetention(store, { ...RETENTION_POLICY, batch: 4 });
    expect(result.inbox).toBe(4);
    expect(
      (await store.pool.query('SELECT count(*)::integer AS count FROM eventsub_inbox')).rows[0]
        .count,
    ).toBe(3);
    const second = await sweepRetention(store, { ...RETENTION_POLICY, batch: 4 });
    expect(second.inbox).toBe(3);
    await expect(sweepRetention(store, { ...RETENTION_POLICY, batch: 0 })).rejects.toThrow(
      'bounded whole numbers',
    );
  }));
