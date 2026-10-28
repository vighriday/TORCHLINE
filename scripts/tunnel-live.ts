import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.env.WORLD_MODE !== 'live') throw new Error('Use the separate .env.live configuration.');
const origin = new URL(process.env.PUBLIC_BASE_URL ?? '');
const assigned = process.argv.includes('--assigned-domain');
if (
  origin.protocol !== 'https:' ||
  origin.username ||
  origin.password ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash
)
  throw new Error('PUBLIC_BASE_URL must be an HTTPS origin without credentials, path or query.');
if (process.env.TWITCH_REDIRECT_URI !== `${origin.origin}/auth/twitch/callback`)
  throw new Error('The registered OAuth redirect must match the configured public origin.');
if (!process.env.NGROK_AUTHTOKEN) {
  console.log('BLOCKED: add NGROK_AUTHTOKEN to the ignored .env.live. Never paste it into chat.');
  process.exit(2);
}
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid live PORT.');
const local = await fetch(`http://127.0.0.1:${port}/health/live`, {
  signal: AbortSignal.timeout(5000),
})
  .then((r) => r.json())
  .catch(() => null);
if (local?.ok !== true || local.mode !== 'live')
  throw new Error('Start the live service before its HTTPS tunnel.');
const existing = await fetch(new URL('/health/live', origin), {
  headers: { 'ngrok-skip-browser-warning': 'true' },
  signal: AbortSignal.timeout(5000),
})
  .then((r) => r.json())
  .catch(() => null);
if (!assigned && existing?.ok === true && existing.mode === 'live') {
  console.log('The configured public live origin is already reachable; no second tunnel started.');
  process.exit(0);
}
const binary =
  process.env.NGROK_BIN ??
  (process.platform === 'win32' ? resolve('.tools/ngrok/ngrok.exe') : 'ngrok');
if (process.platform === 'win32' && !existsSync(binary))
  throw new Error('Install ngrok or set NGROK_BIN to its executable.');
await mkdir('.local', { recursive: true });
const configuration = resolve('.local/ngrok-agent.yml');
// This file contains no credential; the child receives only its own token through the environment.
await writeFile(configuration, 'version: "2"\nweb_addr: 127.0.0.1:4040\nconsole_ui: false\n', {
  mode: 0o600,
});
const child = spawn(
  binary,
  [
    'http',
    `http://127.0.0.1:${port}`,
    ...(!assigned ? ['--url', origin.origin] : []),
    '--inspect=false',
    '--log=false',
    '--config',
    configuration,
  ],
  {
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
    env: Object.fromEntries(
      Object.entries(process.env).filter(([name]) =>
        /^(PATH|Path|SystemRoot|WINDIR|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|NGROK_AUTHTOKEN|HTTPS_PROXY|HTTP_PROXY|NO_PROXY)$/i.test(
          name,
        ),
      ),
    ),
  },
);
let diagnostic = '';
let startupFailed = false;
let endpointReady = false;
child.stderr?.on('data', (data) => {
  diagnostic = (diagnostic + String(data)).slice(-4096);
});
child.on('error', () => {
  startupFailed = true;
  console.error(
    'ngrok could not start. Check its executable and account configuration; credentials are not printed.',
  );
  process.exitCode = 1;
});
child.on('exit', (code) => {
  if (code) {
    console.error(
      `ngrok exited (${code}); ${diagnostic.match(/ERR_NGROK_\d+/)?.[0] ?? 'check account/origin availability'}. No credentials printed.`,
    );
    process.exitCode = 1;
  }
});
await writeFile('.local/ngrok.pid', String(child.pid ?? '') + '\n', { mode: 0o600 });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => child.kill());
console.log(
  `Starting HTTPS for the existing live service: ${origin.origin}. Request inspection is disabled.`,
);
console.log(
  'Run pnpm twitch:verify:live to check reachability, current subscriptions and native evidence.',
);
for (let attempt = 0; attempt < 20; attempt++) {
  if (startupFailed || child.exitCode !== null) break;
  const data = await fetch('http://127.0.0.1:4040/api/tunnels', {
    signal: AbortSignal.timeout(2000),
  })
    .then((r) => r.json())
    .catch(() => null);
  const tunnel = data?.tunnels?.find(
    (t: { proto: string; config: { addr: string; inspect: boolean } }) =>
      t.proto === 'https' &&
      t.config.addr === `http://127.0.0.1:${port}` &&
      t.config.inspect === false,
  );
  if (tunnel) {
    const endpoint = new URL(tunnel.public_url);
    if (
      endpoint.protocol !== 'https:' ||
      endpoint.username ||
      endpoint.password ||
      endpoint.pathname !== '/'
    )
      throw new Error('Unexpected assigned endpoint.');
    await writeFile(
      '.local/tunnel-origin.json',
      JSON.stringify({ origin: endpoint.origin, port, inspection: false }) + '\n',
      { mode: 0o600 },
    );
    console.log(`Public HTTPS endpoint: ${endpoint.origin}`);
    endpointReady = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!endpointReady) {
  child.kill();
  console.error('No matching HTTPS endpoint became ready. Check the agent account and local port.');
  process.exitCode = 1;
}
