import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// Read-only probe of the isolated operator OBS instance described in the runbook.
// Never start a stream/recording, change a scene/source, or print capabilities.
type Pending = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};
async function connection(url: string, identify?: (message: any) => unknown) {
  const ws = new WebSocket(url),
    pending = new Map<string, Pending>();
  let sequence = 0;
  let resolveReady: () => void;
  let rejectReady: (error: Error) => void;
  const ready = new Promise<void>((r, j) => {
    resolveReady = r;
    rejectReady = j;
  });
  const timer = setTimeout(() => rejectReady(new Error('Native OBS connection timed out.')), 10000);
  ws.addEventListener('open', () => {
    if (!identify) resolveReady();
  });
  ws.addEventListener('error', () => rejectReady(new Error('Native OBS connection unavailable.')));
  ws.addEventListener('close', () => {
    rejectReady(new Error('Native OBS connection closed.'));
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error('Native OBS disconnected.'));
    }
    pending.clear();
  });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (identify && message.op === 0) ws.send(JSON.stringify(identify(message)));
    if (identify && message.op === 2) resolveReady();
    const key = identify ? message.d?.requestId : String(message.id);
    const item = pending.get(key);
    if (!item) return;
    pending.delete(key);
    clearTimeout(item.timer);
    if (message.error || (identify && !message.d.requestStatus?.result))
      item.reject(new Error('Native OBS probe failed.'));
    else item.resolve(identify ? (message.d.responseData ?? {}) : message.result);
  });
  try {
    await ready;
  } catch (error) {
    ws.close();
    throw error;
  } finally {
    clearTimeout(timer);
  }
  return {
    call: (name: string, data: Record<string, unknown> = {}): Promise<any> =>
      new Promise((r, j) => {
        const key = String(++sequence);
        const timer = setTimeout(() => {
          pending.delete(key);
          j(new Error('Native OBS request timed out.'));
        }, 10000);
        pending.set(key, { resolve: r, reject: j, timer });
        ws.send(
          JSON.stringify(
            identify
              ? { op: 6, d: { requestId: key, requestType: name, requestData: data } }
              : { id: sequence, method: name, params: data },
          ),
        );
      }),
    close: () => ws.close(),
  };
}

let obs: Awaited<ReturnType<typeof connection>> | undefined;
let cef: Awaited<ReturnType<typeof connection>> | undefined;
let stage = 'isolated configuration';
try {
  const meta = JSON.parse(await readFile('.local/obs-acceptance-process.json', 'utf8'));
  if (resolve(meta.root) !== resolve('.local/obs-acceptance') || meta.port !== 4457)
    throw new Error('Use only the isolated acceptance OBS profile.');
  const config = JSON.parse(
    await readFile(
      resolve(meta.root, 'config/obs-studio/plugin_config/obs-websocket/config.json'),
      'utf8',
    ),
  );
  if (!config.auth_required || !config.server_password)
    throw new Error('OBS authentication required.');
  const digest = (s: string) => createHash('sha256').update(s).digest('base64');
  stage = 'authenticated OBS connection';
  obs = await connection('ws://127.0.0.1:4457', (message) => ({
    op: 1,
    d: {
      rpcVersion: 1,
      eventSubscriptions: 0,
      authentication: digest(
        digest(config.server_password + message.d.authentication.salt) +
          message.d.authentication.challenge,
      ),
    },
  }));
  const version = await obs.call('GetVersion');
  stage = 'inactive output check';
  if (
    (await obs.call('GetStreamStatus')).outputActive ||
    (await obs.call('GetRecordStatus')).outputActive
  )
    throw new Error('Probe expects isolated OBS with no active outputs.');
  const access = JSON.parse(await readFile('.local/live-play-access.json', 'utf8'));
  stage = 'temporary overlay access';
  if (Date.parse(access.expiresAt) <= Date.now())
    throw new Error('Start twitch:verify:play to obtain current temporary read access.');
  const url = new URL(access.url);
  if (url.protocol !== 'https:') throw new Error('Public HTTPS source required.');
  stage = 'OBS source permissions';
  const sourceSettings = await obs.call('GetInputSettings', { inputName: 'Ark public HTTPS' });
  if (sourceSettings.inputSettings?.url !== access.url)
    throw new Error('The isolated source must use the current temporary access.');
  if (sourceSettings.inputSettings?.webpage_control_level !== 0)
    throw new Error('The web page must have no OBS control permissions.');
  const expectedAsset = (await readFile('apps/web/dist/index.html', 'utf8')).match(
    /src="(\/assets\/[^" ]+\.js)"/,
  )?.[1];
  if (!expectedAsset) throw new Error('Current browser build required.');
  const targets = await (
    await fetch('http://127.0.0.1:6263/json/list', { signal: AbortSignal.timeout(5000) })
  ).json();
  stage = 'native CEF target';
  // The app removes the fragment after capability exchange. Reject ambiguous
  // same-channel tabs instead of accidentally inspecting another source.
  const pageUrl = new URL(url);
  pageUrl.hash = '';
  const candidates = targets.filter((t: any) => t.url.split('#')[0] === pageUrl.href);
  const target = candidates.length === 1 ? candidates[0] : undefined;
  if (!target)
    throw new Error('Isolated OBS must already contain the temporary read-only browser source.');
  const debug = new URL(target.webSocketDebuggerUrl);
  if (
    debug.protocol !== 'ws:' ||
    !['127.0.0.1', 'localhost'].includes(debug.hostname) ||
    debug.port !== '6263'
  )
    throw new Error('CEF debugger must remain loopback only.');
  cef = await connection(debug.href);
  stage = 'native Ark rendering';
  let dom;
  for (let attempt = 0; attempt < 30; attempt++) {
    dom = (
      await cef.call('Runtime.evaluate', {
        returnByValue: true,
        expression: `({ world: document.querySelector('.flight-deck')?.getAttribute('data-world'), shipReady: !!document.querySelector('.ark-stage[aria-busy="false"]'), renderedCanvas: !!document.querySelector('.ark-stage.scene-ready canvas'), controls: document.querySelectorAll('button,input,select,textarea').length, chapter: document.querySelector('.flight-deck')?.className, previewWarning: document.body.innerText.includes('You are about to visit:'), asset: [...document.scripts].map(s=>s.src && new URL(s.src).pathname).find(p=>p && p.startsWith('/assets/')) })`,
      })
    ).result?.value;
    if (dom?.world && dom.shipReady && dom.controls === 0 && !dom.previewWarning) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!dom?.world || !dom.shipReady || dom.controls !== 0 || dom.previewWarning)
    throw new Error('Actual OBS has not rendered the read-only Ark.');
  stage = 'current browser build';
  if (dom.asset !== expectedAsset)
    throw new Error('OBS is rendering an older browser build. Refresh the isolated source.');
  stage = 'native screenshot';
  // DOM readiness precedes OBS's source compositor. Let the current frame reach it.
  await new Promise((r) => setTimeout(r, 1500));
  const image = await obs.call('GetSourceScreenshot', {
    sourceName: 'Ark public HTTPS',
    imageFormat: 'png',
    imageWidth: 1280,
    imageHeight: 720,
  });
  await writeFile(
    '.local/obs-live-working.png',
    Buffer.from(image.imageData.split(',')[1], 'base64'),
    { mode: 0o600 },
  );
  const report = {
    result: 'passed',
    generatedAt: new Date().toISOString(),
    source:
      'Installed native OBS browser source over real public HTTPS; no simulation or gameplay writes.',
    obsVersion: version.obsVersion,
    websocketVersion: version.obsWebSocketVersion,
    actualCefArkRendered: true,
    rendered3dCanvas: dom.renderedCanvas,
    hostControlsAbsent: true,
    obsPageControlLevel: 0,
    browserAsset: expectedAsset,
    chapter: dom.chapter,
    streaming: false,
    recording: false,
    nativeChatEffect: 'separate acceptance',
    refreshAndRecovery: 'separate acceptance',
    nativeRaid: 'separate acceptance',
  };
  await writeFile('.local/obs-native-result.json', JSON.stringify(report, null, 2) + '\n', {
    mode: 0o600,
  });
  console.log(JSON.stringify(report, null, 2));
} catch {
  await writeFile(
    '.local/obs-native-result.json',
    JSON.stringify({ result: 'incomplete', generatedAt: new Date().toISOString(), stage }) + '\n',
    { mode: 0o600 },
  ).catch(() => {});
  console.error(
    `OBS acceptance incomplete at ${stage}. Check the isolated OBS setup, temporary grant, actual browser source and ngrok preview instructions. No success or private URL printed.`,
  );
  process.exitCode = 2;
} finally {
  cef?.close();
  obs?.close();
}
