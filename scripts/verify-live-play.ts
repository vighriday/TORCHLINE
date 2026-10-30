import { randomBytes, createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Store } from '@torchline/storage';
import { chromium } from '@playwright/test';
import { presentWorld } from '../apps/server/src/projection.ts';

// Observes genuine signed input only. No host command, chat send, simulation or custody mutation.
if (process.env.WORLD_MODE !== 'live' || !process.env.DATABASE_URL)
  throw new Error('Use the existing separate live configuration.');
const origin = new URL(process.env.PUBLIC_BASE_URL ?? '');
if (origin.protocol !== 'https:') throw new Error('Real public HTTPS required.');
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.local/browsers');
const store = new Store(process.env.DATABASE_URL);
const token = randomBytes(32).toString('hex');
const hash = createHash('sha256').update(token).digest('hex');
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let stop = false;
process.once('SIGINT', () => {
  stop = true;
});
process.once('SIGTERM', () => {
  stop = true;
});
try {
  await mkdir('.local', { recursive: true });
  await writeFile(
    '.local/live-play-result.json',
    JSON.stringify({ result: 'watching', generatedAt: new Date().toISOString() }) + '\n',
    { mode: 0o600 },
  );
  const creator = (
    await store.pool.query(
      "SELECT c.id FROM creators c JOIN channel_slots slot ON slot.channel_id=c.id WHERE c.connected AND c.mode='live' AND c.label=$1",
      [process.argv[2] ?? 'hriday29'],
    )
  ).rows[0];
  if (!creator) throw new Error('Connected creator with an active live Ark required.');
  const before = await store.active(creator.id, true);
  if (!before) throw new Error('Active live Ark required.');
  const startedAt = (await store.pool.query('SELECT clock_timestamp() AS at')).rows[0].at;
  await store.pool.query(
    "INSERT INTO overlay_grants(hash,channel_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '45 minutes')",
    [hash, creator.id],
  );
  // Private capability handoff for an optional installed-OBS test; never printed or staged.
  await writeFile(
    '.local/live-play-access.json',
    JSON.stringify({
      url: `${origin.origin}/overlay/${encodeURIComponent(creator.id)}/#${token}`,
      hash,
      channel: creator.id,
      expiresAt: new Date(Date.now() + 45 * 60000).toISOString(),
    }),
    { mode: 0o600 },
  );
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    reducedMotion: 'reduce',
    extraHTTPHeaders: { 'ngrok-skip-browser-warning': 'true' },
  });
  await page.goto(`${origin.origin}/overlay/${encodeURIComponent(creator.id)}/#${token}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('.mission', { timeout: 20000 });
  await page.screenshot({ path: '.local/live-play-before.png' });
  console.log(
    `Live observation ready: chapter ${before.state.chapter}, ${before.state.phase}. Watches native viewer actions and real public overlay for 40 minutes. No game action or chat sent.`,
  );
  const until = Date.now() + 40 * 60000;
  while (!stop && Date.now() < until) {
    const evidence = (
      await store.pool.query(
        `SELECT e.event FROM world_events e JOIN eventsub_inbox i ON e.event->>'commandId'='eventsub:'||i.message_id
       JOIN integration_deliveries d ON d.message_id=i.message_id AND d.kind='chat'
       WHERE e.world_id=$1 AND e.sequence>$2 AND d.received_at>$3 AND i.processed_at IS NOT NULL AND i.error IS NULL
       AND e.event->'actor'->>'role'='viewer' ORDER BY e.sequence LIMIT 1`,
        [before.id, before.state.version, startedAt],
      )
    ).rows[0]?.event;
    if (evidence) {
      const saved = await store.get(before.id);
      const projected = presentWorld(saved, false);
      const target = projected.challenge?.nodes.find(
        (n) => n.revealed && n.id === evidence.command.node,
      );
      const expected = evidence.command.type === 'scan' ? target?.clue : evidence.summary;
      if (!expected)
        throw new Error('Native action recorded but visible assertion needs a known command.');
      await page.waitForFunction((text) => document.body.innerText.includes(text), expected, {
        timeout: 15000,
      });
      const noControls = (await page.locator('button,input,select,textarea').count()) === 0;
      const observedWorld = await page.locator('.mission').getAttribute('data-world');
      if (!noControls || observedWorld !== before.id)
        throw new Error('Overlay authority/world assertion failed.');
      await page.screenshot({ path: '.local/live-play-after.png' });
      const response = await page.reload({ waitUntil: 'domcontentloaded' });
      if (!response?.ok()) throw new Error('Overlay reload failed.');
      await page.waitForFunction((text) => document.body.innerText.includes(text), expected, {
        timeout: 15000,
      });
      const report = {
        generatedAt: new Date().toISOString(),
        source:
          'Genuine signed Twitch delivery linked to processed inbox and canonical viewer event; real public HTTPS Chromium overlay.',
        result: 'passed',
        command: evidence.command.type,
        chapter: saved.state.chapter,
        nativeDeliveryLinked: true,
        canonicalChange: saved.state.version > before.state.version,
        visibleConsequence: true,
        survivesReload: true,
        readOnlyControlsAbsent: noControls,
        beforeGameVersion: before.state.version,
        afterGameVersion: saved.state.version,
        nativeObs: 'separate acceptance',
        visibleBotReply: 'separate acceptance',
        nativeRaid: 'separate acceptance',
      };
      await writeFile('.local/live-play-result.json', JSON.stringify(report, null, 2) + '\n', {
        mode: 0o600,
      });
      console.log(JSON.stringify(report));
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (stop || Date.now() >= until) {
    await writeFile(
      '.local/live-play-result.json',
      JSON.stringify({
        result: 'incomplete',
        generatedAt: new Date().toISOString(),
        reason: 'No observed valid native action completed the visible assertion in this window.',
      }) + '\n',
      { mode: 0o600 },
    );
    console.log(
      'Observation ended without asserting live gameplay success. Existing world and baseline preserved.',
    );
    process.exitCode = 2;
  }
} catch {
  await writeFile(
    '.local/live-play-result.json',
    JSON.stringify({ result: 'incomplete', generatedAt: new Date().toISOString() }) + '\n',
    { mode: 0o600 },
  ).catch(() => {});
  console.error(
    'Live gameplay observer did not complete. No success, synthetic proof or private URL printed. Check HTTPS, active phase, current grants and temporary overlay access.',
  );
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  await store.pool.query('DELETE FROM overlay_grants WHERE hash=$1', [hash]);
  await store.close();
}
