import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  authorizationUrl,
  decryptSecret,
  encryptSecret,
  normalizeChat,
  parseChatCommand,
  verifyWebhook,
  validateToken,
} from '@torchline/twitch';
const secret = 'test-secret-with-sufficient-entropy-for-fixtures';
const now = Date.now();
const timestamp = new Date(now).toISOString();
const raw = Buffer.from(
  '{ "subscription": {"id":"sub","type":"channel.raid","version":"1","status":"enabled","condition":{"to_broadcaster_user_id":"target"}},"event":{"from_broadcaster_user_id":"source","to_broadcaster_user_id":"target","viewers":2}}',
);
const headers = (body = raw, at = timestamp) => ({
  'twitch-eventsub-message-id': 'event-1',
  'twitch-eventsub-message-timestamp': at,
  'twitch-eventsub-message-type': 'notification',
  'twitch-eventsub-message-signature':
    'sha256=' +
    createHmac('sha256', secret)
      .update('event-1' + at)
      .update(body)
      .digest('hex'),
});
describe('Twitch wire boundary, independently of live account access', () => {
  it('accepts Twitch application-token validation with null scopes without granting user permissions', async () => {
    const result = await validateToken('fixture-app', async () =>
      Response.json({ client_id: 'fixture', scopes: null, expires_in: 3600 }),
    );
    expect(result.scopes).toEqual([]);
    expect(result.user_id).toBeUndefined();
  });
  it('verifies exact bytes and rejects tampering, malformed signatures and stale/future timestamps', () => {
    expect(verifyWebhook(headers(), raw, secret, now).event?.viewers).toBe(2);
    expect(() =>
      verifyWebhook(headers(), Buffer.from(raw.toString().replace('{ ', '{')), secret, now),
    ).toThrow('does not match');
    expect(() =>
      verifyWebhook(
        { ...headers(), 'twitch-eventsub-message-signature': 'sha256=bad' },
        raw,
        secret,
        now,
      ),
    ).toThrow('Invalid');
    for (const at of [new Date(now - 600001).toISOString(), new Date(now + 30001).toISOString()])
      expect(() => verifyWebhook(headers(raw, at), raw, secret, now)).toThrow('stale');
    expect(() =>
      verifyWebhook(
        { ...headers(), 'twitch-eventsub-subscription-type': 'channel.chat.message' },
        raw,
        secret,
        now,
      ),
    ).toThrow('mismatch');
  });
  it('parses bounded gameplay input and excludes Shared Chat mirrors and host commands', () => {
    expect(parseChatCommand('!route s a c t')).toEqual({
      type: 'route',
      nodes: ['S', 'A', 'C', 'T'],
    });
    expect(parseChatCommand('!patch c')).toEqual({ type: 'patch', node: 'C' });
    for (const text of [
      '!commit burn-navigation',
      '!scan X',
      '!scan A extra',
      '!route S A C T evil',
      'ordinary chat',
    ])
      expect(parseChatCommand(text)).toBeNull();
    expect(
      normalizeChat({
        broadcaster_user_id: 'a',
        chatter_user_id: 'v',
        message_id: 'm',
        message: { text: '!scan A' },
        source_broadcaster_user_id: 'other',
      }),
    ).toBeNull();
  });
  it('keeps bot and creator consent separate and encrypts persisted tokens with authentication', () => {
    const creator = new URL(
      authorizationUrl('client', 'http://localhost:3000/auth/twitch/callback', 'state', 'creator'),
    );
    const bot = new URL(
      authorizationUrl('client', 'http://localhost:3000/auth/twitch/callback', 'state', 'bot'),
    );
    expect(creator.searchParams.get('scope')).toBe('channel:bot');
    expect(bot.searchParams.get('scope')).toContain('user:bot');
    expect(bot.searchParams.get('scope')).not.toContain('manage:raids');
    const key = 'ab'.repeat(32),
      value = { access_token: 'sensitive-test-token' };
    const cipher = encryptSecret(value, key);
    expect(JSON.stringify(cipher)).not.toContain(value.access_token);
    expect(decryptSecret(cipher, key)).toEqual(value);
    expect(() => decryptSecret({ ...cipher, tag: '00'.repeat(16) }, key)).toThrow();
  });
});
