// Checks the one-command preview started by `docker compose up --build --wait`, or the hosted demo
// image when PREVIEW_URL and PREVIEW_ORIGIN name it.
// Plays the first steps a judge takes: practice sign-in, a new Ark and its LIVEWIRE-enabled view.
const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:3000';
const origin = process.env.PREVIEW_ORIGIN ?? 'http://localhost:3000';
const headers = { 'content-type': 'application/json', 'x-torchline-request': '1', origin };

const ready = await fetch(new URL('/health/ready', base));
if (!ready.ok) throw new Error(`Preview not ready (${ready.status}).`);

const page = await fetch(new URL('/', base));
const html = await page.text();
const asset = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
if (!page.ok || !asset || !(await fetch(new URL(asset, base))).ok)
  throw new Error('Preview web document or bundle unavailable.');

const login = await fetch(new URL('/api/simulator/login', base), {
  method: 'POST',
  headers,
  body: JSON.stringify({ channel: 'alpha' }),
});
const cookie = (login.headers.getSetCookie?.() ?? [])
  .map((value) => value.split(';')[0])
  .join('; ');
if (!login.ok || !cookie) throw new Error(`Practice sign-in failed (${login.status}).`);

const created = await fetch(new URL('/api/worlds', base), {
  method: 'POST',
  headers: { ...headers, cookie },
  body: '{}',
});
const { id } = await created.json();
if (!created.ok || typeof id !== 'string')
  throw new Error(`Ark creation failed (${created.status}).`);

const state = await fetch(new URL('/api/state', base), { headers: { cookie, origin } });
const snapshot = await state.json();
if (
  !state.ok ||
  snapshot.mode !== 'simulation' ||
  !snapshot.worlds?.some((world) => world.id === id) ||
  snapshot.world?.livewire?.enabled !== true
)
  throw new Error(
    `Dashboard state failed, missed the new Ark or has LIVEWIRE off (${state.status}).`,
  );

console.log(
  'Compose preview passed: readiness, web bundle, practice sign-in, new Ark and LIVEWIRE-enabled dashboard state. Saved practice only; no Twitch traffic.',
);
