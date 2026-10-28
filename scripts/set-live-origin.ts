import { readFile, writeFile, rename } from 'node:fs/promises';

const endpoint = JSON.parse(await readFile('.local/tunnel-origin.json', 'utf8'));
const origin = new URL(endpoint.origin);
if (
  origin.protocol !== 'https:' ||
  origin.username ||
  origin.password ||
  origin.pathname !== '/' ||
  endpoint.inspection !== false
)
  throw new Error('Use a validated HTTPS tunnel with request inspection disabled.');
const response = await fetch(new URL('/health/live', origin), {
  headers: { 'ngrok-skip-browser-warning': 'true' },
  signal: AbortSignal.timeout(10000),
});
const health = await response.json();
if (!response.ok || health.ok !== true || health.mode !== 'live')
  throw new Error('The assigned origin is not reaching the live application.');
let text = await readFile('.env.live', 'utf8');
for (const [name, value] of Object.entries({
  PUBLIC_BASE_URL: origin.origin,
  TWITCH_REDIRECT_URI: `${origin.origin}/auth/twitch/callback`,
})) {
  const expression = new RegExp(`^${name}=.*$`, 'm');
  text = expression.test(text)
    ? text.replace(expression, `${name}=${value}`)
    : `${text.trimEnd()}\n${name}=${value}\n`;
}
await writeFile('.env.live.next', text, { mode: 0o600 });
await rename('.env.live.next', '.env.live');
console.log(
  `Live origin updated locally. Restart the live service. Add this exact Twitch OAuth redirect: ${origin.origin}/auth/twitch/callback`,
);
