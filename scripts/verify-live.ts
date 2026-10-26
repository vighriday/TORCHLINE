import { mkdir, writeFile } from 'node:fs/promises';
import { Store } from '@torchline/storage';
import {
  BOT_SCOPES,
  CREATOR_SCOPES,
  decryptSecret,
  helix,
  requestToken,
  validateToken,
} from '@torchline/twitch';
import { DomainError } from '@torchline/contracts';
type Check = { name: string; status: 'verified' | 'blocked' | 'failed'; detail: string };
const checks: Check[] = [];
const check = (name: string, status: Check['status'], detail: string) =>
  checks.push({ name, status, detail });
const origin = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3001';
const client = process.env.TWITCH_CLIENT_ID,
  secret = process.env.TWITCH_CLIENT_SECRET;
if (process.env.WORLD_MODE !== 'live')
  throw new Error('Run this read-only live verification with .env.live.');
const publicHeaders = { 'ngrok-skip-browser-warning': 'true', 'x-torchline-request': '1' };
let serverConfigured = false;
if (new URL(origin).protocol !== 'https:')
  check('public HTTPS', 'blocked', 'Set the confirmed tunnel/host origin in .env.live.');
else {
  for (const [name, path, method, payload, expected] of [
    ['live health', '/health/live', 'GET', undefined, 200],
    ['database readiness', '/health/ready', 'GET', undefined, 200],
    ['anonymous state projection', '/api/state', 'GET', undefined, 200],
    ['private world controls', '/api/worlds', 'POST', {}, 401],
    ['simulation disabled', '/api/simulator/login', 'POST', { channel: 'alpha' }, 403],
    ['private integration status', '/api/twitch/status', 'GET', undefined, 401],
    ['unsigned webhook denial', '/integrations/twitch/eventsub', 'POST', {}, 403],
  ] as const) {
    try {
      const response = await fetch(new URL(path, origin), {
        method,
        headers: { ...publicHeaders, ...(payload ? { 'content-type': 'application/json' } : {}) },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });
      const body = await response.json();
      let valid = response.status === expected;
      if (name === 'live health') valid &&= body.mode === 'live' && body.ok === true;
      if (name === 'anonymous state projection') {
        valid &&= body.me === null && body.world === null;
        serverConfigured = body.integration?.credentialsConfigured === true;
      }
      check(
        name,
        valid ? 'verified' : 'failed',
        `Public HTTPS returned ${response.status}; expected ${expected}.`,
      );
    } catch {
      check(
        name,
        'failed',
        'Public request failed or returned an unexpected response; no credentials printed.',
      );
    }
  }
}
if (!client || !secret)
  check(
    'Twitch application identity',
    'blocked',
    'Add the registered client ID/secret to .env.live.',
  );
else {
  try {
    const app = await requestToken({
      client_id: client,
      client_secret: secret,
      grant_type: 'client_credentials',
    });
    const identity = await validateToken(app.access_token);
    if (identity.client_id !== client || identity.user_id)
      throw new Error('Unexpected application identity.');
    check(
      'Twitch application identity',
      'verified',
      'Real Twitch client-credentials token minted and validated; token not retained in the report.',
    );
    if (!serverConfigured)
      check(
        'server credentials loaded',
        'blocked',
        'Restart the live server after saving .env.live.',
      );
    const store = new Store(process.env.DATABASE_URL!);
    try {
      const grants = (await store.pool.query('SELECT id,role,scopes,encrypted FROM oauth_grants'))
        .rows;
      for (const role of ['creator', 'bot']) {
        const selected = grants.filter((grant) => grant.role === role);
        if (!selected.length) {
          check(
            `Twitch ${role} authorization`,
            'blocked',
            `Complete ${role === 'bot' ? 'the separate operator-initiated bot flow' : 'broadcaster consent in the browser'}.`,
          );
          continue;
        }
        let valid = 0;
        for (const grant of selected) {
          try {
            const token = decryptSecret<{ access_token: string }>(
              grant.encrypted,
              process.env.TOKEN_ENCRYPTION_KEY!,
            );
            const result = await validateToken(token.access_token);
            if (
              result.user_id !== grant.id ||
              result.client_id !== client ||
              !(role === 'bot' ? BOT_SCOPES : CREATOR_SCOPES).every((scope) =>
                result.scopes.includes(scope),
              )
            )
              throw new Error('Unexpected identity/scopes.');
            valid++;
          } catch {
            check(
              `Twitch ${role} authorization`,
              'failed',
              'An existing grant did not validate against Twitch; reconnect through the application.',
            );
          }
        }
        if (valid === selected.length)
          check(
            `Twitch ${role} authorization`,
            'verified',
            `${valid} real ${role} grant(s) validated against Twitch with required identity/scopes.`,
          );
      }
      const page = await helix('eventsub/subscriptions?first=100', client, app.access_token);
      check(
        'Twitch EventSub API',
        'verified',
        `Real provider returned ${page.data?.length ?? 0} subscription(s) on the first page; this count alone does not verify a channel or callback.`,
      );
      const counts = (
        await store.pool.query(
          'SELECT kind,count(*)::integer AS count FROM integration_deliveries GROUP BY kind',
        )
      ).rows;
      const delivered = (kind: string) => counts.find((row) => row.kind === kind)?.count ?? 0;
      check(
        'signed callback delivery',
        delivered('challenge') ? 'verified' : 'blocked',
        `${delivered('challenge')} signed challenge delivery record(s) in the separate live database.`,
      );
      const applied = (
        await store.pool.query(
          "SELECT count(*)::integer AS count FROM eventsub_inbox WHERE processed_at IS NOT NULL AND error IS NULL AND payload->>'kind'='chat'",
        )
      ).rows[0].count;
      check(
        'live chat action',
        applied ? 'verified' : 'blocked',
        `${applied} accepted chat action(s) applied; send a valid command in the active broadcaster's Twitch chat.`,
      );
      const transfers = (
        await store.pool.query(
          "SELECT count(*)::integer AS count FROM custody_events WHERE mode='live'",
        )
      ).rows[0].count;
      check(
        'raid custody transaction',
        transfers ? 'verified' : 'blocked',
        `${transfers} live-mode custody change(s). Genuine raid acceptance also needs the two-broadcaster session evidence; this script does not synthesize proof.`,
      );
    } finally {
      await store.close();
    }
  } catch (error) {
    check(
      'Twitch provider access',
      'failed',
      error instanceof DomainError
        ? error.code
        : 'Provider verification failed; no credentials printed.',
    );
  }
}
const report = {
  source: 'real HTTPS/provider calls; no fixture fetcher or synthetic notifications',
  generatedAt: new Date().toISOString(),
  scope:
    'Provider calls are read-only. Public route probes exercise unauthenticated denial; no authenticated game action, chat, raid, synthetic proof or subscription change is sent.',
  checks,
  externalAcceptance:
    'Actual OBS and a recorded native two-broadcaster raid session remain separate from automated diagnostics.',
};
await mkdir('.local', { recursive: true });
await writeFile('.local/live-verification.json', JSON.stringify(report, null, 2) + '\n', {
  mode: 0o600,
});
console.log(JSON.stringify(report, null, 2));
process.exitCode = checks.some((item) => item.status === 'failed')
  ? 1
  : checks.some((item) => item.status === 'blocked')
    ? 2
    : 0;
