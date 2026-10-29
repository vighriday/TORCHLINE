import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Store } from '@torchline/storage';

if (process.env.WORLD_MODE !== 'live' || !process.env.DATABASE_URL)
  throw new Error('Use the separate live configuration.');
const store = new Store(process.env.DATABASE_URL),
  path = '.local/live-acceptance-baseline.json';
try {
  const identity = (
    await store.pool.query(
      'SELECT current_database() AS db,current_schema() AS schema,clock_timestamp() AS at',
    )
  ).rows[0];
  const source = createHash('sha256')
    .update(new URL(process.env.DATABASE_URL).host + ':' + identity.db + ':' + identity.schema)
    .digest('hex');
  if (process.argv[2] === 'begin') {
    await mkdir('.local', { recursive: true });
    await writeFile(path, JSON.stringify({ source, since: identity.at.toISOString() }) + '\n', {
      mode: 0o600,
      flag: process.argv.includes('--replace') ? 'w' : 'wx',
    });
    console.log(
      'Live acceptance baseline saved. No game, chat, subscription or custody mutation sent. Use check after actual participation; --replace is required to reset a baseline.',
    );
  } else if (process.argv[2] === 'check') {
    const baseline = JSON.parse(await readFile(path, 'utf8'));
    if (baseline.source !== source || !Number.isFinite(Date.parse(baseline.since)))
      throw new Error('Baseline does not match this database.');
    const counts = (
      await store.pool.query(
        `SELECT
      (SELECT count(*)::integer FROM integration_deliveries WHERE kind='chat' AND received_at>$1) AS "signedChat",
      (SELECT count(*)::integer FROM eventsub_inbox i WHERE i.received_at>$1 AND i.processed_at IS NOT NULL AND i.error IS NULL AND i.payload->>'kind'='chat' AND EXISTS(SELECT 1 FROM world_events e WHERE e.world_id=i.payload->>'worldId' AND e.event->>'commandId'='eventsub:'||i.message_id)) AS "persistedChatActions",
      (SELECT count(*)::integer FROM bot_replies WHERE created_at>$1 AND status='sent' AND provider_message_id IS NOT NULL) AS "nativeAcceptedReplies",
      (SELECT count(*)::integer FROM integration_deliveries WHERE kind='raid' AND received_at>$1) AS "signedRaids",
      (SELECT count(*)::integer FROM custody_events c JOIN raid_proofs p ON p.message_id=c.proof_id JOIN handoffs h ON h.id=c.id JOIN integration_deliveries d ON d.message_id=p.message_id AND d.kind='raid' WHERE c.created_at>$1 AND p.received_at>$1 AND c.mode='live' AND p.mode='live' AND h.mode='live' AND h.status='committed' AND p.consumed_by=h.id AND h.proof_id=p.message_id AND c.world_id=h.world_id AND c.source_id=p.source_id AND c.target_id=p.target_id) AS "linkedLiveTransfers"`,
        [baseline.since],
      )
    ).rows[0];
    const botOutcomes = (
      await store.pool.query(
        'SELECT status,outcome_code AS code,count(*)::integer AS count FROM bot_replies WHERE created_at>$1 GROUP BY status,outcome_code ORDER BY status,outcome_code',
        [baseline.since],
      )
    ).rows;
    const report = {
      generatedAt: identity.at.toISOString(),
      since: baseline.since,
      source:
        'Read-only counters in the separate live database since the explicit baseline; no fixture provider or synthetic notification sent.',
      counts,
      botOutcomes,
      manualEvidenceRequired: [
        'Actual chat reply visibility',
        'Actual OBS CEF render/reconnect',
        'Two consenting broadcasters: native raid and inherited condition/history plus revoked former custody',
      ],
    };
    await writeFile('.local/live-acceptance-result.json', JSON.stringify(report, null, 2) + '\n', {
      mode: 0o600,
    });
    console.log(JSON.stringify(report, null, 2));
    if (
      !counts.persistedChatActions ||
      !counts.nativeAcceptedReplies ||
      !counts.linkedLiveTransfers
    )
      process.exitCode = 2;
  } else throw new Error('Use begin or check.');
} finally {
  await store.close();
}
