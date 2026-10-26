const required = [
  'TWITCH_CLIENT_ID',
  'TWITCH_CLIENT_SECRET',
  'TOKEN_ENCRYPTION_KEY',
  'EVENTSUB_SECRET',
];
const missing = required.filter(
  (name) => !process.env[name] || process.env[name]!.startsWith('REPLACE_'),
);
console.log('Twitch configuration preflight (no credentials printed):');
for (const name of required)
  console.log(`  ${name}: ${missing.includes(name) ? 'missing' : 'present'}`);
const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
console.log(
  `  Creator OAuth callback: ${process.env.TWITCH_REDIRECT_URI ?? `${base}/auth/twitch/callback`}`,
);
console.log(`  EventSub callback: ${base}/integrations/twitch/eventsub`);
console.log(
  `  Public HTTPS ingress: ${base.startsWith('https://') ? 'configured; not verified' : 'not configured; required for genuine webhooks'}`,
);
console.log(`  Runtime mode: ${process.env.WORLD_MODE ?? 'simulation'}`);
console.log(
  'This check does not contact Twitch or establish a live integration. See docs/operations/twitch-setup.md.',
);
if (missing.length) process.exitCode = 2;
