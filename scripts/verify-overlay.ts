import { randomBytes, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { Store } from '@torchline/storage';
import { chromium } from '@playwright/test';

if (process.env.WORLD_MODE !== 'live' || !process.env.DATABASE_URL)
  throw new Error('Use the separate live configuration.');
const origin = new URL(process.env.PUBLIC_BASE_URL ?? '');
if (origin.protocol !== 'https:')
  throw new Error('This acceptance helper requires real public HTTPS.');
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.local/browsers');
const health = await fetch(new URL('/health/live', origin), {
  headers: { 'ngrok-skip-browser-warning': 'true' },
  signal: AbortSignal.timeout(5000),
})
  .then(async (r) => r.ok && (await r.json()).mode === 'live')
  .catch(() => false);
if (!health) {
  console.log('BLOCKED: public live HTTPS readiness is unavailable; no overlay grant created.');
  process.exit(2);
}
if (
  !(await fetch(new URL('/health/ready', origin), {
    headers: { 'ngrok-skip-browser-warning': 'true' },
    signal: AbortSignal.timeout(5000),
  })
    .then((r) => r.ok)
    .catch(() => false))
) {
  console.log('BLOCKED: public live database readiness is unavailable; no overlay grant created.');
  process.exit(2);
}
const store = new Store(process.env.DATABASE_URL),
  token = randomBytes(32).toString('hex'),
  hash = createHash('sha256').update(token).digest('hex');
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  const creators = (
    await store.pool.query(
      "SELECT id FROM creators WHERE mode='live' AND connected AND ($1::text IS NULL OR id=$1)",
      [process.argv[2] ?? null],
    )
  ).rows;
  if (creators.length !== 1)
    throw new Error('Specify exactly one connected broadcaster ID as the argument.');
  const channel = creators[0].id as string;
  await store.transaction(async (client) => {
    await store.lockChannels(client, [channel]);
    if (
      !(
        await client.query("SELECT 1 FROM creators WHERE id=$1 AND mode='live' AND connected", [
          channel,
        ])
      ).rowCount
    )
      throw new Error('Broadcaster disconnected.');
    await client.query(
      "INSERT INTO overlay_grants(hash,channel_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '5 minutes')",
      [hash, channel],
    );
  });
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    reducedMotion: 'reduce',
    extraHTTPHeaders: { 'ngrok-skip-browser-warning': 'true' },
  });
  const page = await context.newPage();
  // No trace, screenshot, network dump or capability URL is printed or persisted.
  await page.goto(`${origin.origin}/overlay/${encodeURIComponent(channel)}/#${token}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => location.hash === '', null, { timeout: 15000 });
  const result = await page.evaluate(async (channel) => {
    const stream = await fetch(`/overlay/${encodeURIComponent(channel)}/events`),
      reader = stream.body?.getReader();
    if (!stream.ok || !reader) throw new Error('Feed did not connect.');
    const abort = setTimeout(() => {
      void reader.cancel();
    }, 8000);
    let text = '';
    try {
      while (!text.includes('\n\n')) {
        const part = await reader.read();
        if (part.done) break;
        text += new TextDecoder().decode(part.value);
      }
    } finally {
      clearTimeout(abort);
      await reader.cancel().catch(() => {});
    }
    const data = text.match(/data: (.*)/)?.[1];
    const snapshot = data ? JSON.parse(data) : null;
    const denied = await fetch('/api/worlds', {
      method: 'POST',
      headers: { 'x-torchline-request': '1', 'content-type': 'application/json' },
      body: '{}',
    });
    return {
      liveSnapshot: snapshot?.mode === 'live',
      privateDiagnosticsAbsent:
        !snapshot?.integration?.details && !snapshot?.worlds && !snapshot?.handoffs,
      writesDenied: denied.status === 401,
      controls: document.querySelectorAll('button,input,select,textarea').length,
      hasWorld: Boolean(snapshot?.world),
    };
  }, channel);
  if (
    !result.liveSnapshot ||
    !result.privateDiagnosticsAbsent ||
    !result.writesDenied ||
    result.controls !== 0
  )
    throw new Error('Public overlay boundary check failed.');
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        evidence:
          'Real public HTTPS + Chromium read-only cookie exchange/feed and anonymous mutation denial. This is not native OBS CEF.',
        ...result,
        nativeObs: 'unverified',
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    'Public overlay verification failed. No capability or browser diagnostics printed. Check HTTPS, connected broadcaster, installed Chromium and feed limits.',
  );
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  await store.pool.query('DELETE FROM overlay_grants WHERE hash=$1', [hash]);
  await store.close();
}
