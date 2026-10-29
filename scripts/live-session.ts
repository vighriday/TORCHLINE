import { spawn } from 'node:child_process';
import { existsSync, openSync, closeSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Store, REQUIRED_MIGRATION } from '@torchline/storage';
import { runtimeConfig } from '../apps/server/src/runtime-config.ts';

// Operates the existing local preview only. No OAuth, chat, OBS broadcast or custody mutation.
if (process.env.WORLD_MODE !== 'live') throw new Error('Use the ignored live environment.');
const runtime = runtimeConfig(process.env),
  origin = runtime.config.baseUrl;
const action = process.argv[2];
const systemEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    /^(PATH|SystemRoot|SYSTEMDRIVE|WINDIR|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|ALLUSERSPROFILE|PATHEXT|PROGRAMDATA|COMSPEC|USERNAME|USERDOMAIN)$/i.test(
      key,
    ),
  ),
);
await mkdir('.local', { recursive: true });
const local = `http://127.0.0.1:${runtime.port}`;
async function healthy(url: string) {
  try {
    const r = await fetch(new URL('/health/live', url), {
      headers: { 'ngrok-skip-browser-warning': '1' },
      signal: AbortSignal.timeout(2500),
    });
    const b = await r.json();
    return r.status === 200 && b.ok === true && b.mode === 'live';
  } catch {
    return false;
  }
}
async function waitFor(url: string, seconds: number) {
  const until = Date.now() + seconds * 1000;
  do {
    if (await healthy(url)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  } while (Date.now() < until);
  return false;
}
function background(script: string, label: string) {
  const fd = openSync(resolve(`.local/live-session-${label}.log`), 'a', 0o600);
  try {
    const child = spawn(process.execPath, ['--env-file=.env.live', script], {
      cwd: process.cwd(),
      env: systemEnv,
      windowsHide: true,
      detached: true,
      stdio: ['ignore', fd, fd],
    });
    child.on('error', () => {});
    child.unref();
    return child.pid ?? null;
  } finally {
    closeSync(fd);
  }
}
async function run(script: string, args: string[] = []) {
  return await new Promise<number>((resolveRun) => {
    const child = spawn(process.execPath, ['--env-file=.env.live', script, ...args], {
      windowsHide: true,
      env: systemEnv,
      stdio: 'inherit',
    });
    child.once('error', () => resolveRun(1));
    child.once('exit', (code) => resolveRun(code ?? 1));
  });
}
try {
  if (action === 'up') {
    if (new URL(origin).protocol !== 'https:') throw new Error('HTTPS origin required.');
    if (!existsSync('apps/web/dist/index.html')) throw new Error('Build the browser first.');
    const store = new Store(runtime.databaseUrl);
    try {
      if (
        !(
          await store.pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [
            REQUIRED_MIGRATION,
          ])
        ).rowCount
      )
        throw new Error('Migration required.');
    } finally {
      await store.close();
    }
    const processes: {
      appPid: number | null;
      tunnelPid: number | null;
      origin: string;
      at: string;
    } = { appPid: null, tunnelPid: null, origin, at: new Date().toISOString() };
    if (!(await healthy(local))) {
      // Never kill an unknown/old process or overwrite its environment.
      const occupied = await fetch(new URL('/health/live', local), {
        signal: AbortSignal.timeout(2000),
      })
        .then(() => true)
        .catch(() => false);
      if (occupied) throw new Error('Port belongs to an unrecognized service.');
      processes.appPid = background('apps/server/src/main.ts', 'app');
      if (!(await waitFor(local, 45))) throw new Error('Local live service did not become ready.');
    }
    if (!(await healthy(origin))) {
      if (
        !['.local/ngrok-ssh', '.local/ngrok-known_hosts', '.local/ngrok-ssh-config'].every(
          existsSync,
        )
      )
        throw new Error('Registered project SSH setup required.');
      processes.tunnelPid = background('scripts/tunnel-ssh.ts', 'ssh');
      if (!(await waitFor(origin, 35)))
        throw new Error('Public SSH endpoint did not become reachable.');
    }
    await writeFile(
      '.local/live-session-processes.json',
      JSON.stringify(processes, null, 2) + '\n',
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify(
        {
          result: 'reachable',
          origin,
          localLive: true,
          publicLive: true,
          note: 'Existing grants refresh/reconcile through normal server startup. Run live:check; this is not chat, OBS or raid acceptance.',
        },
        null,
        2,
      ),
    );
  } else if (action === 'check') {
    const verify = await run('scripts/verify-live.ts');
    const acceptance = await run('scripts/live-acceptance.ts', ['check']);
    const store = new Store(runtime.databaseUrl);
    try {
      const worlds = (
        await store.pool.query(
          "SELECT c.label AS broadcaster,w.id AS world_id,w.state->>'phase' AS phase,(w.state->>'chapter')::integer AS chapter FROM creators c JOIN worlds w ON w.custodian_id=c.id WHERE c.mode='live' AND w.mode='live' ORDER BY w.created_at",
        )
      ).rows;
      console.log(
        JSON.stringify(
          {
            existingWorlds: worlds,
            ownerSteps: [
              'Sign into TORCHLINE as hriday29 if its browser session expired; use the existing Ark.',
              'Use twitch:verify:play and send one legal gameplay command during its open phase in actual hriday29 chat; queries do not prove a game change.',
              'Native OBS rendering and controlled app-restart recovery are documented; verify gameplay updates and source refresh/link rotation separately.',
            ],
            nativeRaid:
              'External dependency: a second consenting broadcaster. hriday_29 remains the bot; this command never starts or verifies a raid.',
            botRepliesEnabled: runtime.config.botRepliesEnabled !== false,
          },
          null,
          2,
        ),
      );
    } finally {
      await store.close();
    }
    process.exitCode = verify === 1 || acceptance === 1 ? 1 : verify || acceptance ? 2 : 0;
  } else throw new Error('Use up or check.');
} catch {
  console.error(
    'Live preparation/check did not complete. Check build, live DB/migrations, existing port and registered SSH key. Logs are private in .local/live-session-*.log; no credentials printed. No unknown process was stopped.',
  );
  process.exitCode = 1;
}
