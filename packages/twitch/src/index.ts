import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { z } from 'zod';
import { CommandSchema, DomainError } from '@torchline/contracts';
import type { Command } from '@torchline/contracts';

export type Fetcher = typeof fetch;
export const BOT_SCOPES = ['user:read:chat', 'user:write:chat', 'user:bot'];
export const CREATOR_SCOPES = ['channel:bot'];
export interface EncryptedSecret {
  iv: string;
  tag: string;
  data: string;
}
export function encryptSecret(value: unknown, key: string): EncryptedSecret {
  if (!/^[a-f\d]{64}$/i.test(key))
    throw new Error('TOKEN_ENCRYPTION_KEY must contain 64 hexadecimal characters.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: data.toString('hex'),
  };
}
export function decryptSecret<T>(value: EncryptedSecret, key: string): T {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    Buffer.from(value.iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(value.tag, 'hex'));
  return JSON.parse(
    Buffer.concat([decipher.update(Buffer.from(value.data, 'hex')), decipher.final()]).toString(
      'utf8',
    ),
  ) as T;
}
export function authorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  role: 'creator' | 'bot',
) {
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: (role === 'bot' ? BOT_SCOPES : CREATOR_SCOPES).join(' '),
    force_verify: 'true',
  }).toString();
  return url.toString();
}
const TokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  scope: z.array(z.string()).optional(),
});
export type OAuthTokens = z.infer<typeof TokenSchema>;
const ValidationSchema = z.object({
  client_id: z.string(),
  user_id: z.string().nullable().optional(),
  login: z.string().nullable().optional(),
  scopes: z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? []),
  expires_in: z.number(),
});
export async function requestToken(
  fields: Record<string, string>,
  fetcher: Fetcher = fetch,
): Promise<OAuthTokens> {
  const response = await fetcher('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new DomainError(
      response.status === 400 || response.status === 401
        ? 'TWITCH_AUTH_FAILED'
        : 'TWITCH_UNAVAILABLE',
      'Twitch did not authorize this token request. Reconnect or retry after checking the registered callback.',
    );
  return TokenSchema.parse(await response.json());
}
export async function validateToken(token: string, fetcher: Fetcher = fetch) {
  const response = await fetcher('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new DomainError(
      response.status === 401 ? 'TWITCH_TOKEN_INVALID' : 'TWITCH_UNAVAILABLE',
      'Twitch token validation did not succeed.',
    );
  return ValidationSchema.parse(await response.json());
}
export async function revokeToken(clientId: string, token: string, fetcher: Fetcher = fetch) {
  try {
    const response = await fetcher('https://id.twitch.tv/oauth2/revoke', {
      method: 'POST',
      body: new URLSearchParams({ client_id: clientId, token }),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
export async function helix(
  path: string,
  clientId: string,
  token: string,
  init: RequestInit = {},
  fetcher: Fetcher = fetch,
) {
  const response = await fetcher(`https://api.twitch.tv/helix/${path}`, {
    ...init,
    headers: {
      'Client-Id': clientId,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new DomainError(
      response.status === 429 ? 'TWITCH_RATE_LIMITED' : 'TWITCH_API_FAILED',
      `Twitch API request failed (${response.status}).`,
    );
  return response.status === 204 ? null : response.json();
}

const EnvelopeSchema = z.object({
  subscription: z.object({
    id: z.string(),
    type: z.string(),
    version: z.string(),
    status: z.string(),
    condition: z.record(z.string(), z.unknown()),
    transport: z.object({ method: z.string(), callback: z.string().optional() }).optional(),
  }),
  event: z.record(z.string(), z.unknown()).optional(),
  challenge: z.string().optional(),
});
export function verifyWebhook(
  headers: Record<string, string | string[] | undefined>,
  raw: Buffer,
  secret: string,
  now = Date.now(),
) {
  const header = (name: string) =>
    typeof headers[name] === 'string' ? (headers[name] as string) : '';
  const id = header('twitch-eventsub-message-id');
  const timestamp = header('twitch-eventsub-message-timestamp');
  const type = header('twitch-eventsub-message-type');
  const signature = header('twitch-eventsub-message-signature');
  const ms = Date.parse(timestamp);
  if (
    !id ||
    id.length > 256 ||
    !Number.isFinite(ms) ||
    ms < now - 600000 ||
    ms > now + 30000 ||
    !/^sha256=[a-f\d]{64}$/i.test(signature) ||
    secret.length < 10 ||
    raw.length > 65536
  )
    throw new DomainError('INVALID_SIGNATURE', 'Invalid or stale EventSub authentication.');
  const expected = createHmac('sha256', secret)
    .update(id + timestamp)
    .update(raw)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex')))
    throw new DomainError(
      'INVALID_SIGNATURE',
      'EventSub signature does not match the raw request.',
    );
  if (!['notification', 'webhook_callback_verification', 'revocation'].includes(type))
    throw new DomainError('INVALID_EVENT', 'Unsupported notification kind.');
  let body: z.infer<typeof EnvelopeSchema>;
  try {
    body = EnvelopeSchema.parse(JSON.parse(raw.toString('utf8')));
  } catch {
    throw new DomainError('INVALID_EVENT', 'Malformed EventSub envelope.');
  }
  if (
    header('twitch-eventsub-subscription-type') &&
    header('twitch-eventsub-subscription-type') !== body.subscription.type
  )
    throw new DomainError('INVALID_EVENT', 'Subscription type mismatch.');
  if (
    header('twitch-eventsub-subscription-version') &&
    header('twitch-eventsub-subscription-version') !== body.subscription.version
  )
    throw new DomainError('INVALID_EVENT', 'Subscription version mismatch.');
  return { id, timestamp, type, ...body };
}
export type WebhookNotification = ReturnType<typeof verifyWebhook>;
export function parseLivewireVote(text: string): 'navigation' | 'hull' | 'oxygen' | null {
  if (text.length > 160) return null;
  const match = /^!(?:stake|vote)\s+(1|2|3|nav|navigation|hull|oxy|oxygen)\s*$/i.exec(text.trim());
  if (!match) return null;
  const key = match[1].toLowerCase();
  return ['1', 'nav', 'navigation'].includes(key)
    ? 'navigation'
    : ['2', 'hull'].includes(key)
      ? 'hull'
      : 'oxygen';
}
// Viewers type either `!allocate 3 2` (hull, oxygen) or the named form the overlay teaches,
// `!allocate hull 3 oxygen 2`, in either order. The schema still bounds the total to 1-5.
function allocation(args: string[]) {
  if (args.length === 2 && args.every((a) => /^[0-5]$/.test(a)))
    return { hull: Number(args[0]), oxygen: Number(args[1]) };
  if (args.length !== 2 && args.length !== 4) return null;
  const plan = { hull: 0, oxygen: 0 };
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = ({ hull: 'hull', oxygen: 'oxygen', oxy: 'oxygen', o2: 'oxygen' } as const)[
      args[index].toLowerCase() as 'hull'
    ];
    if (!key || seen.has(key) || !/^[0-5]$/.test(args[index + 1])) return null;
    seen.add(key);
    plan[key] = Number(args[index + 1]);
  }
  return plan;
}
export function parseChatCommand(text: string): Command | null {
  if (text.length > 160) return null;
  const [name, ...args] = text.trim().split(/\s+/);
  const verb = name.toLowerCase();
  const candidate =
    verb === '!inspect' && args.length === 1
      ? { type: 'inspect', area: args[0].toLowerCase() }
      : verb === '!allocate' && allocation(args)
        ? { type: 'allocate', ...allocation(args) }
        : verb === '!scan' && args.length === 1
          ? { type: 'scan', node: args[0].toUpperCase() }
          : verb === '!patch' && args.length === 1
            ? { type: 'patch', node: args[0].toUpperCase() }
            : verb === '!route'
              ? { type: 'route', nodes: args.map((n) => n.toUpperCase()) }
              : verb === '!vote' && args.length === 1
                ? { type: 'vote', option: args[0] }
                : null;
  if (!candidate) return null;
  const parsed = CommandSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
const ChatSchema = z.object({
  broadcaster_user_id: z.string(),
  chatter_user_id: z.string(),
  message_id: z.string(),
  message: z.object({ text: z.string() }),
  source_broadcaster_user_id: z.string().nullable().optional(),
});
export function normalizeChat(event: unknown) {
  const value = ChatSchema.parse(event);
  if (value.message.text.length > 160) return null;
  if (
    value.source_broadcaster_user_id &&
    value.source_broadcaster_user_id !== value.broadcaster_user_id
  )
    return null;
  const command = parseChatCommand(value.message.text);
  const stake = parseLivewireVote(value.message.text);
  const query = /^!(status|history)\s*$/i.exec(value.message.text.trim())?.[1].toLowerCase() as
    'status' | 'history' | undefined;
  return command || query || stake
    ? {
        channelId: value.broadcaster_user_id,
        actorId: value.chatter_user_id,
        messageId: value.message_id,
        command,
        stake,
        query: query ?? null,
      }
    : null;
}
const SendResult = z.object({
  data: z
    .array(
      z.object({
        message_id: z.string(),
        is_sent: z.boolean(),
        drop_reason: z
          .object({ code: z.string().max(100) })
          .nullable()
          .optional(),
      }),
    )
    .min(1),
});
export async function sendChatMessage(
  clientId: string,
  appToken: string,
  channel: string,
  bot: string,
  message: string,
  fetcher: Fetcher = fetch,
) {
  if (!message || message.length > 500)
    throw new DomainError('INVALID_INPUT', 'Bot messages must contain 1–500 characters.');
  const result = SendResult.parse(
    await helix(
      'chat/messages',
      clientId,
      appToken,
      {
        method: 'POST',
        body: JSON.stringify({
          broadcaster_id: channel,
          sender_id: bot,
          message,
          for_source_only: true,
        }),
      },
      fetcher,
    ),
  );
  return result.data[0];
}
export const RaidSchema = z.object({
  from_broadcaster_user_id: z.string(),
  to_broadcaster_user_id: z.string(),
  viewers: z.number().int().min(0),
});
