import { mkdir, writeFile } from 'node:fs/promises';
import { Store } from '@torchline/storage';
import { livewireAcceptance } from './lib/livewire-acceptance.ts';
if (
  process.env.WORLD_MODE !== 'live' ||
  !process.env.DATABASE_URL ||
  !process.env.PUBLIC_BASE_URL?.startsWith('https://')
)
  throw new Error(
    'Use the intended candidate’s private LIVE configuration and HTTPS origin. No simulation fallback.',
  );
const store = new Store(process.env.DATABASE_URL);
try {
  const result = {
    at: new Date().toISOString(),
    source:
      'Read-only configured live database; no provider fixture, simulated packet, chat send, result attestation or world mutation is performed.',
    ...(await livewireAcceptance(store)),
    nativeObsVerified: false,
    nativeRaidVerified: false,
    next: 'After reviewed deployment: open a mission at a ready boundary, send one displayed legal command as a genuine participant, lock before the attempt and attest its actual result. Observe native OBS separately. Do not repeat bot-query tests.',
  };
  await mkdir('.local', { recursive: true });
  await writeFile('.local/livewire-live-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.backendPathObserved) process.exitCode = 2;
} catch {
  console.error(
    'LIVEWIRE read-only verification did not complete; check candidate database/migration availability. No credentials printed.',
  );
  process.exitCode = 1;
} finally {
  await store.close();
}
