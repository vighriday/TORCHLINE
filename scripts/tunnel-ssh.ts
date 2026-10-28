import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const privateKey = resolve('.local/ngrok-ssh'),
  knownHosts = resolve('.local/ngrok-known_hosts'),
  config = resolve('.local/ngrok-ssh-config');
const host = 'connect.in.ngrok-agent.com';
// Published by ngrok over HTTPS; reject a keyscan that does not match this pin.
const fingerprint = 'SHA256:acotuxa/+tJY2vmK+VeLQIoVOJLQz/VLTmHTJ/0LPaI';
const env = Object.fromEntries(
  Object.entries(process.env).filter(([name]) =>
    /^(PATH|SystemRoot|SYSTEMDRIVE|WINDIR|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|ALLUSERSPROFILE|COMPUTERNAME|HOMEDRIVE|HOMEPATH|LOGONSERVER|NUMBER_OF_PROCESSORS|OS|PATHEXT|PROGRAMDATA|PUBLIC|USERDNSDOMAIN|USERDOMAIN|USERDOMAIN_ROAMINGPROFILE|USERNAME|SESSIONNAME|COMSPEC|PROGRAMFILES|PROGRAMFILES\(X86\))$/i.test(
      name,
    ),
  ),
);
const run = (name: string, args: string[], input?: string) =>
  execFileSync(name, args, {
    windowsHide: true,
    env,
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 15000,
  });
if (process.argv.includes('--prepare')) {
  await mkdir('.local', { recursive: true });
  if (!existsSync(privateKey) && !existsSync(privateKey + '.pub'))
    run('ssh-keygen', ['-t', 'ed25519', '-N', '', '-C', 'torchline-development', '-f', privateKey]);
  if (!existsSync(privateKey) || !existsSync(privateKey + '.pub'))
    throw new Error(
      'SSH key pair is incomplete. Preserve existing files and repair the local configuration.',
    );
  const scanned = run('ssh-keyscan', ['-T', '10', '-t', 'rsa', host]);
  if (!run('ssh-keygen', ['-lf', '-'], scanned).includes(fingerprint))
    throw new Error('The ngrok SSH host key does not match its official fingerprint.');
  await writeFile(knownHosts, scanned, { mode: 0o600 });
  await writeFile(config, '# Project-only SSH connection; no user configuration.\n', {
    mode: 0o600,
  });
  console.log(
    'Dedicated project SSH key prepared; ngrok server fingerprint verified against its official documentation.',
  );
  console.log(
    'Register only .local/ngrok-ssh.pub at https://dashboard.ngrok.com/ssh-keys. Keep .local/ngrok-ssh private.',
  );
} else {
  if (process.env.WORLD_MODE !== 'live') throw new Error('Use the separate live configuration.');
  const origin = new URL(process.env.PUBLIC_BASE_URL ?? '');
  if (
    origin.protocol !== 'https:' ||
    origin.pathname !== '/' ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash
  )
    throw new Error('Use an HTTPS public origin.');
  if (!existsSync(privateKey) || !existsSync(knownHosts) || !existsSync(config))
    throw new Error('Run live:ssh:prepare and register its public key first.');
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid live port.');
  const health = await fetch(`http://127.0.0.1:${port}/health/ready`, {
    signal: AbortSignal.timeout(5000),
  }).then((r) => r.json());
  if (health.ok !== true) throw new Error('Start the live service and apply migrations first.');
  let stopping = false,
    child: ReturnType<typeof spawn> | undefined,
    attempt = 0;
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      stopping = true;
      child?.kill();
    });
  console.log(
    `SSH transport for ${origin.origin}; native ngrok executable is not used. No request inspection interface.`,
  );
  while (!stopping) {
    child = spawn(
      'ssh',
      [
        '-F',
        config,
        '-T',
        '-o',
        'BatchMode=yes',
        '-o',
        'IdentitiesOnly=yes',
        '-o',
        'StrictHostKeyChecking=yes',
        '-o',
        `UserKnownHostsFile=${knownHosts}`,
        '-o',
        'ExitOnForwardFailure=yes',
        '-o',
        'ConnectTimeout=10',
        '-o',
        'ServerAliveInterval=15',
        '-o',
        'ServerAliveCountMax=3',
        '-i',
        privateKey,
        '-R',
        `${origin.hostname}:443:127.0.0.1:${port}`,
        `v2@${host}`,
        'http',
      ],
      { windowsHide: true, env, stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let error = '';
    child.stderr?.on('data', (data) => {
      error = (error + String(data)).slice(-4096);
    });
    const code = await new Promise<number | null>((resolve) => {
      child!.once('error', () => resolve(-1));
      child!.once('exit', resolve);
    });
    if (stopping) break;
    if (/Permission denied|bad permissions|UNPROTECTED PRIVATE KEY/i.test(error)) {
      console.error(
        /bad permissions|UNPROTECTED PRIVATE KEY/i.test(error)
          ? 'SSH rejected the project private-key file permissions. Restrict only that project key before retrying. No private data printed.'
          : 'SSH public-key authorization denied. Register the project public key in this ngrok account. No private data printed.',
      );
      process.exitCode = 2;
      break;
    }
    if (/HOST IDENTIFICATION|Host key verification failed/i.test(error)) {
      console.error('SSH host verification failed; transport stopped.');
      process.exitCode = 1;
      break;
    }
    const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5));
    console.log(
      `SSH transport exited (${code}); retrying in ${delay / 1000}s. Run twitch:verify:live to verify actual reachability.`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
