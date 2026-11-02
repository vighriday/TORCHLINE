// CI check for the judges' own live setup (compose.live.yaml): with throwaway credentials, the server
// must start in live mode on its own PostgreSQL and send Twitch sign-in to the configured application
// and exact redirect. The probe runs inside the app container because this compose file publishes no
// port. The ngrok tunnel is not started, so nothing here contacts Twitch or ngrok.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const origin = 'https://torchline-judge.ngrok-free.dev';
const clientId = 'judgeciclient' + randomBytes(6).toString('hex');
const key = () => randomBytes(32).toString('hex');
writeFileSync(
  '.env.live',
  [
    'NGROK_AUTHTOKEN=unused-in-ci',
    `PUBLIC_BASE_URL=${origin}`,
    `TWITCH_CLIENT_ID=${clientId}`,
    `TWITCH_CLIENT_SECRET=${key()}`,
    `SESSION_SECRET=${key()}`,
    `TOKEN_ENCRYPTION_KEY=${key()}`,
    `BOT_SETUP_SECRET=${key()}`,
    `EVENTSUB_SECRET=${key()}`,
  ].join('\n') + '\n',
  { mode: 0o600 },
);
const compose = ['compose', '--env-file', '.env.live', '-f', 'compose.live.yaml'];
execFileSync(
  'docker',
  [...compose, 'up', '-d', '--build', '--wait', '--wait-timeout', '240', 'app'],
  {
    stdio: 'inherit',
  },
);

const probe = `(async () => {
  const live = await (await fetch('http://127.0.0.1:3000/health/live')).json();
  if (live.mode !== 'live') throw new Error('Expected live mode, got ' + live.mode);
  if (!(await fetch('http://127.0.0.1:3000/health/ready')).ok) throw new Error('Not ready');
  const start = await fetch('http://127.0.0.1:3000/auth/twitch', { redirect: 'manual' });
  const to = new URL(start.headers.get('location') ?? 'invalid:');
  const expected = ${JSON.stringify(origin)} + '/auth/twitch/callback';
  if (start.status < 300 || start.status > 399) throw new Error('Sign-in did not redirect: ' + start.status);
  if (to.origin + to.pathname !== 'https://id.twitch.tv/oauth2/authorize') throw new Error('Unexpected sign-in target');
  if (to.searchParams.get('client_id') !== ${JSON.stringify(clientId)}) throw new Error('Wrong client ID');
  if (to.searchParams.get('redirect_uri') !== expected) throw new Error('Wrong redirect: ' + to.searchParams.get('redirect_uri'));
  if (!(to.searchParams.get('scope') ?? '').split(' ').includes('channel:bot')) throw new Error('Missing channel:bot');
  console.log('Live compose ready: live mode, Twitch sign-in redirects to ' + expected);
})().catch((error) => { console.error(error.message); process.exit(1); });`;
execFileSync('docker', [...compose, 'exec', '-T', 'app', 'node', '-e', probe], {
  stdio: 'inherit',
});
