import Fastify from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';
import staticFiles from '@fastify/static';
import { existsSync } from 'node:fs';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { CommandRequestSchema, DomainError } from '@torchline/contracts';
import type { Command } from '@torchline/contracts';
import { Store } from '@torchline/storage';
import type { Creator } from '@torchline/storage';
import {
  authorizationUrl,
  BOT_SCOPES,
  CREATOR_SCOPES,
  encryptSecret,
  helix,
  normalizeChat,
  parseChatCommand,
  RaidSchema,
  requestToken,
  validateToken,
  verifyWebhook,
} from '@torchline/twitch';
import type { Fetcher } from '@torchline/twitch';
import { presentWorld } from './projection.ts';
import { twitchLifecycle } from './twitch-lifecycle.ts';

export interface AppConfig {
  mode: 'simulation' | 'live';
  baseUrl: string;
  sessionSecret: string;
  tokenKey: string;
  botSetupSecret: string;
  twitchClientId?: string;
  twitchClientSecret?: string;
  twitchRedirectUri?: string;
  eventsubSecret?: string;
  botUserId?: string;
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const denied = (code: string, message: string): never => {
  throw new DomainError(code, message);
};
const SessionCookie = 'torchline_session';
const NodeText = z.string().min(1).max(80);

export async function createApp(
  store: Store,
  config: AppConfig,
  options: { fetcher?: Fetcher; workers?: boolean; logger?: boolean } = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const lifecycle = twitchLifecycle(store, config, fetcher);
  const secure = new URL(config.baseUrl).protocol === 'https:';
  const app = Fastify({
    bodyLimit: 65536,
    forceCloseConnections: true,
    logger: options.logger
      ? {
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          serializers: { req: (req) => ({ method: req.method, path: req.url?.split('?')[0] }) },
        }
      : false,
  });
  await app.register(cookie);
  app.setErrorHandler((err, _request, reply) => {
    const error = err as Error & { code?: string };
    if (error instanceof DomainError)
      return reply
        .code(
          ['FORBIDDEN', 'HOST_REQUIRED', 'MODE_MISMATCH', 'INVALID_SIGNATURE'].includes(error.code)
            ? 403
            : error.code === 'UNAUTHENTICATED'
              ? 401
              : error.code === 'NOT_CONFIGURED'
                ? 503
                : 409,
        )
        .send({ error: error.code, message: error.message });
    if (error instanceof z.ZodError)
      return reply.code(400).send({ error: 'INVALID_INPUT', message: 'Invalid request fields.' });
    if (error.code === '23505')
      return reply.code(409).send({
        error: 'CONFLICT',
        message: 'A competing operation already claimed this resource.',
      });
    app.log.error({ code: error.code ?? error.name }, 'Request failed');
    return reply.code(500).send({
      error: 'DEPENDENCY_FAILURE',
      message: 'The operation did not complete. Refresh and retry.',
    });
  });
  app.addHook('onRequest', async (request) => {
    if (request.method !== 'POST' || request.url.startsWith('/integrations/twitch/')) return;
    const allowed = new Set([new URL(config.baseUrl).origin]);
    if (!secure && new URL(config.baseUrl).hostname === 'localhost')
      allowed.add('http://localhost:5173');
    if (request.headers.origin && !allowed.has(request.headers.origin))
      denied('FORBIDDEN', 'Origin does not match this application.');
    if (request.headers['x-torchline-request'] !== '1')
      denied('FORBIDDEN', 'A same-origin application request is required.');
  });
  const currentCreator = async (request: FastifyRequest): Promise<Creator> => {
    const token = request.cookies[SessionCookie];
    if (!token) return denied('UNAUTHENTICATED', 'Connect a creator account first.');
    const session = (
      await store.pool.query(
        'SELECT c.* FROM sessions s JOIN creators c ON c.id=s.channel_id WHERE s.hash=$1 AND s.expires_at>now()',
        [digest(token)],
      )
    ).rows[0];
    if (!session || session.mode !== config.mode || !session.connected)
      return denied('UNAUTHENTICATED', 'The session ended. Reconnect the creator account.');
    if (
      config.mode === 'live' &&
      !(
        await store.pool.query(
          "SELECT 1 FROM oauth_grants WHERE id=$1 AND role='creator' AND validated_at>now()-interval '1 hour'",
          [session.id],
        )
      ).rowCount
    )
      denied('UNAUTHENTICATED', 'Twitch authorization needs revalidation or reconnection.');
    return session;
  };
  const setSession = async (creator: Creator, reply: FastifyReply) => {
    const token = randomBytes(32).toString('hex');
    await store.pool.query(
      "INSERT INTO sessions(hash,channel_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
      [digest(token), creator.id],
    );
    reply.setCookie(SessionCookie, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 43200,
    });
  };
  const requireTwitch = () => {
    if (config.mode !== 'live')
      denied(
        'MODE_MISMATCH',
        'Twitch authorization requires a separate live-mode process/database.',
      );
    if (
      !config.twitchClientId ||
      !config.twitchClientSecret ||
      !/^[a-f\d]{64}$/i.test(config.tokenKey)
    )
      denied(
        'NOT_CONFIGURED',
        'Configure the Twitch client and encryption key in the ignored environment file.',
      );
  };
  const snapshot = async (creator: Creator, readonly = false) => {
    const world = await store.active(creator.id);
    const bot = (await store.pool.query("SELECT id FROM oauth_grants WHERE role='bot' LIMIT 1"))
      .rows[0];
    return {
      me: { id: creator.id, label: creator.label, receiveOptIn: creator.receive_opt_in },
      mode: config.mode,
      world: world ? presentWorld(world, !readonly) : null,
      ...(readonly
        ? {}
        : {
            worlds: (await store.library(creator.id)).map((row) => ({
              id: row.id,
              chapter: row.state.chapter,
              outcome: row.state.outcome,
              parked: row.parked,
            })),
            handoffs: await store.handoffs(creator.id),
            recipients: (
              await store.pool.query(
                'SELECT id,label FROM creators WHERE mode=$1 AND id<>$2 AND receive_opt_in=true AND connected=true ORDER BY label',
                [config.mode, creator.id],
              )
            ).rows,
          }),
      integration: {
        credentialsConfigured: Boolean(config.twitchClientId && config.twitchClientSecret),
        botAuthorized: Boolean(bot),
        publicHttps: secure,
        genuineRaidVerified: false,
      },
    };
  };
  app.get('/health/live', async () => ({ ok: true, mode: config.mode }));
  app.get('/health/ready', async () => {
    await store.pool.query('SELECT name FROM schema_migrations LIMIT 1');
    return { ok: true };
  });
  app.get('/api/state', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!request.cookies[SessionCookie])
      return {
        me: null,
        mode: config.mode,
        world: null,
        worlds: [],
        handoffs: [],
        integration: {
          credentialsConfigured: Boolean(config.twitchClientId && config.twitchClientSecret),
          botAuthorized: false,
          publicHttps: secure,
          genuineRaidVerified: false,
        },
      };
    return snapshot(await currentCreator(request));
  });
  app.post('/api/simulator/login', async (request, reply) => {
    if (config.mode !== 'simulation')
      denied('MODE_MISMATCH', 'Simulation controls are disabled in live mode.');
    const { channel } = z
      .object({ channel: z.enum(['alpha', 'beta', 'gamma']) })
      .parse(request.body);
    const creator = await store.ensureCreator(
      `sim-${channel}`,
      `Simulation ${channel}`,
      'simulation',
    );
    await setSession(creator, reply);
    return { ok: true };
  });
  app.post('/auth/logout', async (request, reply) => {
    if (request.cookies[SessionCookie])
      await store.pool.query('DELETE FROM sessions WHERE hash=$1', [
        digest(request.cookies[SessionCookie]),
      ]);
    reply.clearCookie(SessionCookie, { path: '/' });
    return { ok: true };
  });
  app.post('/api/worlds', async (request) => ({
    id: await store.create(await currentCreator(request)),
  }));
  app.post('/api/worlds/:id/commands', async (request) => {
    const creator = await currentCreator(request);
    const { id } = z.object({ id: NodeText }).parse(request.params);
    const body = CommandRequestSchema.parse(request.body);
    await store.command(
      id,
      { id: creator.id, role: 'host', community: creator.id },
      creator.mode,
      body.expectedVersion,
      body.commandId,
      body.command,
    );
    return snapshot(creator);
  });
  app.post('/api/simulator/commands', async (request) => {
    if (config.mode !== 'simulation')
      denied('MODE_MISMATCH', 'Simulation input cannot reach live worlds.');
    const creator = await currentCreator(request);
    const { actor, text } = z
      .object({ actor: z.string().min(1).max(40), text: z.string().max(160) })
      .parse(request.body);
    const command = parseChatCommand(text);
    if (!command)
      denied('INVALID_INPUT', 'Use !scan, !route, !patch or !vote with valid arguments.');
    const world = await store.active(creator.id);
    if (!world) denied('NOT_FOUND', 'Create a world first.');
    const actorId = createHmac('sha256', config.sessionSecret)
      .update(`${world!.id}:${actor}`)
      .digest('hex');
    await store.command(
      world!.id,
      { id: actorId, role: 'viewer', community: creator.id },
      'simulation',
      world!.revision,
      randomUUID(),
      command!,
    );
    return snapshot(creator);
  });
  app.post('/api/worlds/:id/hosting', async (request) => {
    const creator = await currentCreator(request);
    const { id } = z.object({ id: NodeText }).parse(request.params);
    const { resume } = z.object({ resume: z.boolean() }).parse(request.body);
    await store.park(creator.id, id, resume);
    return { ok: true };
  });
  app.post('/api/receive-opt-in', async (request) => {
    const creator = await currentCreator(request);
    const { enabled } = z.object({ enabled: z.boolean() }).parse(request.body);
    await store.optIn(creator.id, enabled);
    return { ok: true };
  });
  app.post('/api/handoffs', async (request) => {
    const creator = await currentCreator(request);
    const body = z
      .object({ worldId: NodeText, targetId: NodeText, expectedVersion: z.number().int() })
      .parse(request.body);
    if (config.mode === 'live') await lifecycle.readyForTransfer(creator.id, body.targetId);
    return store.prepare(body.worldId, creator, body.targetId, body.expectedVersion);
  });
  app.post('/api/handoffs/:id/:action', async (request) => {
    const creator = await currentCreator(request);
    const { id, action } = z
      .object({ id: NodeText, action: z.enum(['accept', 'cancel', 'decline', 'simulate-raid']) })
      .parse(request.params);
    if (action === 'simulate-raid') {
      if (config.mode !== 'simulation')
        denied('MODE_MISMATCH', 'Synthetic raid proof is prohibited in live mode.');
      const intent = (await store.handoffs(creator.id)).find((h) => h.id === id);
      if (!intent || intent.mode !== 'simulation')
        denied('FORBIDDEN', 'Not a party to this simulated handoff.');
      await store.observeRaid({
        messageId: `simulation:${id}`,
        mode: 'simulation',
        sourceId: intent!.source_id,
        targetId: intent!.target_id,
        subscriptionId: 'simulation-only',
        notificationAt: new Date().toISOString(),
      });
    } else if (action === 'accept') {
      if (config.mode === 'live') await lifecycle.readyForTransfer(null, creator.id);
      await store.accept(id, creator);
    } else await store.cancel(id, creator.id, action === 'decline' ? 'declined' : 'cancelled');
    return { ok: true };
  });

  app.get('/auth/twitch', async (_request, reply) => {
    requireTwitch();
    const state = randomBytes(32).toString('hex');
    await store.pool.query(
      "INSERT INTO oauth_states(hash,role,expires_at) VALUES($1,'creator',now()+interval '10 minutes')",
      [digest(state)],
    );
    reply.setCookie('torchline_oauth', state, {
      path: '/auth',
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 600,
    });
    return reply.redirect(
      authorizationUrl(
        config.twitchClientId!,
        config.twitchRedirectUri ?? `${config.baseUrl}/auth/twitch/callback`,
        state,
        'creator',
      ),
    );
  });
  app.post('/api/operator/bot-authorization', async (request, reply) => {
    requireTwitch();
    if (
      !config.botSetupSecret ||
      request.headers.authorization !== `Bearer ${config.botSetupSecret}`
    )
      denied('FORBIDDEN', 'Operator authorization required.');
    const state = randomBytes(32).toString('hex');
    await store.pool.query(
      "INSERT INTO oauth_states(hash,role,expires_at) VALUES($1,'bot',now()+interval '10 minutes')",
      [digest(state)],
    );
    reply.setCookie('torchline_oauth', state, {
      path: '/auth',
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 600,
    });
    return {
      url: authorizationUrl(
        config.twitchClientId!,
        config.twitchRedirectUri ?? `${config.baseUrl}/auth/twitch/callback`,
        state,
        'bot',
      ),
    };
  });
  app.get('/auth/twitch/callback', async (request, reply) => {
    requireTwitch();
    const parsed = z
      .object({ code: z.string(), state: z.string().length(64) })
      .safeParse(request.query);
    if (!parsed.success)
      return denied('FORBIDDEN', 'OAuth state mismatch or consent denied. Start a new connection.');
    const body = parsed.data;
    if (body.state !== request.cookies.torchline_oauth)
      denied('FORBIDDEN', 'OAuth state mismatch or consent denied. Start a new connection.');
    const state = (
      await store.pool.query(
        'DELETE FROM oauth_states WHERE hash=$1 AND expires_at>now() RETURNING role',
        [digest(body.state)],
      )
    ).rows[0];
    if (!state) denied('FORBIDDEN', 'OAuth state expired or already used.');
    reply.clearCookie('torchline_oauth', { path: '/auth' });
    const tokens = await requestToken(
      {
        client_id: config.twitchClientId!,
        client_secret: config.twitchClientSecret!,
        code: body.code,
        grant_type: 'authorization_code',
        redirect_uri: config.twitchRedirectUri ?? `${config.baseUrl}/auth/twitch/callback`,
      },
      fetcher,
    );
    const identity = await validateToken(tokens.access_token, fetcher);
    if (
      !identity.user_id ||
      identity.client_id !== config.twitchClientId ||
      !(state.role === 'bot' ? BOT_SCOPES : CREATOR_SCOPES).every((scope) =>
        identity.scopes.includes(scope),
      )
    )
      denied('FORBIDDEN', 'Twitch returned an unexpected client, identity or permission set.');
    if (state.role === 'bot' && config.botUserId && identity.user_id !== config.botUserId)
      denied('FORBIDDEN', 'Authorize the configured bot account.');
    if (state.role === 'bot' && (await store.creator(identity.user_id!)))
      denied('FORBIDDEN', 'Use a dedicated bot account, separate from connected creators.');
    if (
      state.role === 'creator' &&
      (
        await store.pool.query("SELECT 1 FROM oauth_grants WHERE id=$1 AND role='bot'", [
          identity.user_id,
        ])
      ).rowCount
    )
      denied('FORBIDDEN', 'The bot account cannot be a creator in this application.');
    await store.transaction(async (c) => {
      if (state.role === 'bot') await c.query("DELETE FROM oauth_grants WHERE role='bot'");
      await c.query(
        'INSERT INTO oauth_grants(id,role,scopes,encrypted) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role,scopes=EXCLUDED.scopes,encrypted=EXCLUDED.encrypted,validated_at=now()',
        [identity.user_id, state.role, identity.scopes, encryptSecret(tokens, config.tokenKey)],
      );
    });
    if (state.role === 'creator') {
      const creator = await store.ensureCreator(
        identity.user_id!,
        identity.login ?? identity.user_id!,
        'live',
      );
      await setSession(creator, reply);
    }
    return reply.redirect('/');
  });
  app.post('/api/twitch/reconcile', async (request) => {
    requireTwitch();
    const creator = await currentCreator(request);
    if (!secure || !config.eventsubSecret || config.eventsubSecret.length < 10)
      denied(
        'NOT_CONFIGURED',
        'Public HTTPS and an EventSub secret are required for webhook verification.',
      );
    const bot = (await store.pool.query("SELECT * FROM oauth_grants WHERE role='bot' LIMIT 1"))
      .rows[0];
    if (!bot) denied('NOT_CONFIGURED', 'Authorize the dedicated bot first.');
    const token = await requestToken(
      {
        client_id: config.twitchClientId!,
        client_secret: config.twitchClientSecret!,
        grant_type: 'client_credentials',
      },
      fetcher,
    );
    const callback = `${config.baseUrl}/integrations/twitch/eventsub`;
    const existing = await helix(
      'eventsub/subscriptions?first=100',
      config.twitchClientId!,
      token.access_token,
      {},
      fetcher,
    );
    const desired = [
      {
        type: 'channel.chat.message',
        condition: { broadcaster_user_id: creator.id, user_id: bot.id },
      },
      { type: 'stream.online', condition: { broadcaster_user_id: creator.id } },
      { type: 'stream.offline', condition: { broadcaster_user_id: creator.id } },
      ...(creator.receive_opt_in
        ? [{ type: 'channel.raid', condition: { to_broadcaster_user_id: creator.id } }]
        : []),
    ];
    for (const spec of desired) {
      let sub = existing?.data?.find(
        (item: {
          type: string;
          condition: Record<string, string>;
          transport: { callback: string };
          status: string;
        }) =>
          item.type === spec.type &&
          item.transport.callback === callback &&
          ['enabled', 'webhook_callback_verification_pending'].includes(item.status) &&
          Object.entries(spec.condition).every(([key, value]) => item.condition[key] === value),
      );
      if (!sub)
        sub = (
          await helix(
            'eventsub/subscriptions',
            config.twitchClientId!,
            token.access_token,
            {
              method: 'POST',
              body: JSON.stringify({
                ...spec,
                version: '1',
                transport: { method: 'webhook', callback, secret: config.eventsubSecret },
              }),
            },
            fetcher,
          )
        )?.data?.[0];
      if (sub)
        await store.pool.query(
          "INSERT INTO subscriptions(id,type,channel_id,status) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET status=CASE WHEN subscriptions.status='enabled' AND EXCLUDED.status='webhook_callback_verification_pending' THEN subscriptions.status ELSE EXCLUDED.status END",
          [sub.id, spec.type, creator.id, sub.status],
        );
    }
    return {
      subscriptions: (
        await store.pool.query('SELECT type,status FROM subscriptions WHERE channel_id=$1', [
          creator.id,
        ])
      ).rows,
    };
  });

  await app.register(async (gateway) => {
    gateway.removeContentTypeParser('application/json');
    gateway.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_request, body, done) => done(null, body),
    );
    gateway.post('/integrations/twitch/eventsub', async (request, reply) => {
      if (!config.eventsubSecret)
        denied('NOT_CONFIGURED', 'EventSub verification is not configured.');
      const notification = verifyWebhook(
        request.headers,
        request.body as Buffer,
        config.eventsubSecret!,
      );
      const subscription = notification.subscription;
      const channel = String(
        subscription.condition.to_broadcaster_user_id ??
          subscription.condition.broadcaster_user_id ??
          '',
      );
      const owner = await store.creator(channel);
      if (
        !owner ||
        !owner.connected ||
        owner.mode !== 'live' ||
        config.mode !== 'live' ||
        subscription.version !== '1'
      )
        denied('FORBIDDEN', 'Unregistered channel, mode or subscription version.');
      if (
        !['channel.chat.message', 'channel.raid', 'stream.online', 'stream.offline'].includes(
          subscription.type,
        )
      )
        denied('FORBIDDEN', 'Unexpected subscription type.');
      if (notification.type === 'webhook_callback_verification') {
        if (!notification.challenge) denied('INVALID_EVENT', 'Challenge missing.');
        await store.pool.query(
          "INSERT INTO subscriptions(id,type,channel_id,status) VALUES($1,$2,$3,'enabled') ON CONFLICT(id) DO UPDATE SET status='enabled'",
          [subscription.id, subscription.type, channel],
        );
        return reply.type('text/plain').send(notification.challenge);
      }
      const known = (
        await store.pool.query(
          'SELECT * FROM subscriptions WHERE id=$1 AND channel_id=$2 AND type=$3',
          [subscription.id, channel, subscription.type],
        )
      ).rows[0];
      if (!known) denied('FORBIDDEN', 'Unknown EventSub subscription.');
      if (notification.type === 'revocation') {
        await store.pool.query('UPDATE subscriptions SET status=$2 WHERE id=$1', [
          subscription.id,
          subscription.status,
        ]);
        return reply.code(204).send();
      }
      if (known.status !== 'enabled') denied('FORBIDDEN', 'Subscription is not enabled.');
      if (subscription.type === 'channel.chat.message') {
        const chat = normalizeChat(notification.event);
        if (chat) {
          const bot = (
            await store.pool.query("SELECT id FROM oauth_grants WHERE role='bot' LIMIT 1")
          ).rows[0];
          if (chat.channelId !== channel || subscription.condition.user_id !== bot?.id)
            denied('FORBIDDEN', 'Chat identity does not match its subscription.');
          if (chat.actorId !== bot?.id)
            await store.enqueueChat(
              notification.id,
              channel,
              chat.actorId,
              chat.command,
              notification.timestamp,
              config.sessionSecret,
              chat.messageId,
            );
        }
      } else if (subscription.type === 'channel.raid') {
        const raid = RaidSchema.parse(notification.event);
        if (raid.to_broadcaster_user_id !== channel)
          denied('FORBIDDEN', 'Raid destination mismatch.');
        await store.pool.query(
          'INSERT INTO eventsub_inbox(message_id,type,payload) VALUES($1,$2,$3) ON CONFLICT(message_id) DO NOTHING',
          [
            notification.id,
            subscription.type,
            {
              kind: 'raid',
              sourceId: raid.from_broadcaster_user_id,
              targetId: raid.to_broadcaster_user_id,
              subscriptionId: subscription.id,
              notificationAt: notification.timestamp,
            },
          ],
        );
      } else
        await store.pool.query(
          'INSERT INTO eventsub_inbox(message_id,type,payload,processed_at) VALUES($1,$2,$3,now()) ON CONFLICT(message_id) DO NOTHING',
          [notification.id, subscription.type, { kind: 'presence', channelId: channel }],
        );
      return reply.code(204).send();
    });
  });

  app.post('/api/overlay-grant', async (request) => {
    const creator = await currentCreator(request);
    const token = randomBytes(32).toString('hex');
    await store.pool.query('DELETE FROM overlay_grants WHERE channel_id=$1', [creator.id]);
    await store.pool.query('INSERT INTO overlay_grants(hash,channel_id) VALUES($1,$2)', [
      digest(token),
      creator.id,
    ]);
    return { url: `${config.baseUrl}/overlay/${encodeURIComponent(creator.id)}/#${token}` };
  });
  app.post('/overlay/:channel/session', async (request, reply) => {
    const { channel } = z.object({ channel: NodeText }).parse(request.params);
    const { token } = z.object({ token: z.string().length(64) }).parse(request.body);
    const grant = (
      await store.pool.query('SELECT 1 FROM overlay_grants WHERE hash=$1 AND channel_id=$2', [
        digest(token),
        channel,
      ])
    ).rowCount;
    if (!grant) denied('FORBIDDEN', 'Overlay link is invalid or revoked.');
    reply.setCookie('torchline_overlay', token, {
      path: `/overlay/${channel}/`,
      httpOnly: true,
      sameSite: 'strict',
      secure,
    });
    return { ok: true };
  });
  const subscribers = new Set<() => Promise<void>>();
  const stream = (request: FastifyRequest, reply: FastifyReply, load: () => Promise<unknown>) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    let closed = false;
    let sending = false;
    let last = '';
    const send = async () => {
      if (closed || sending) return;
      sending = true;
      try {
        const body = JSON.stringify(await load());
        if (body !== last) {
          last = body;
          if (reply.raw.writableLength > 262144) reply.raw.end();
          else reply.raw.write(`event: snapshot\ndata: ${body}\n\n`);
        }
      } catch {
        reply.raw.write('event: unavailable\ndata: {}\n\n');
        reply.raw.end();
      } finally {
        sending = false;
      }
    };
    subscribers.add(send);
    void send();
    const heartbeat = setInterval(() => {
      if (!closed) reply.raw.write(': heartbeat\n\n');
    }, 15000);
    heartbeat.unref();
    reply.raw.on('close', () => {
      closed = true;
      clearInterval(heartbeat);
      subscribers.delete(send);
    });
  };
  app.get('/api/live/events', async (request, reply) => {
    const creator = await currentCreator(request);
    return stream(request, reply, async () => snapshot(await currentCreator(request)));
  });
  app.get('/overlay/:channel/events', async (request, reply) => {
    const { channel } = z.object({ channel: NodeText }).parse(request.params);
    const load = async () => {
      const token = request.cookies.torchline_overlay ?? '';
      if (
        !(
          await store.pool.query('SELECT 1 FROM overlay_grants WHERE hash=$1 AND channel_id=$2', [
            digest(token),
            channel,
          ])
        ).rowCount
      )
        denied('FORBIDDEN', 'Overlay access revoked.');
      const creator = await store.creator(channel);
      if (!creator || creator.mode !== config.mode)
        denied('FORBIDDEN', 'Overlay channel unavailable.');
      return snapshot(creator!, true);
    };
    await load();
    return stream(request, reply, load);
  });
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await store.expire(config.mode);
      const items =
        config.mode === 'live'
          ? (
              await store.pool.query(
                'SELECT * FROM eventsub_inbox WHERE processed_at IS NULL ORDER BY received_at,message_id LIMIT 30',
              )
            ).rows
          : [];
      for (const item of items) {
        try {
          if (item.payload.kind === 'raid') {
            await store.observeRaid({ messageId: item.message_id, mode: 'live', ...item.payload });
            await store.pool.query(
              'UPDATE eventsub_inbox SET processed_at=now() WHERE message_id=$1',
              [item.message_id],
            );
          } else if (item.payload.kind === 'chat') {
            const payload = item.payload;
            const world = await store.get(payload.worldId);
            await store.command(
              world.id,
              { id: payload.actorId, role: 'viewer', community: payload.channelId },
              'live',
              world.revision,
              `eventsub:${item.message_id}`,
              payload.command as Command,
              { id: item.message_id, window: payload.window },
            );
          }
        } catch (e) {
          if (e instanceof DomainError && e.code !== 'STALE_VERSION')
            await store.pool.query(
              'UPDATE eventsub_inbox SET processed_at=now(),error=$2 WHERE message_id=$1',
              [item.message_id, e.code],
            );
          else if (!(e instanceof DomainError))
            app.log.error('Inbox dependency failure; event retained for retry.');
        }
      }
      const outbox = (
        await store.pool.query(
          'SELECT o.id FROM outbox o JOIN worlds w ON w.id=o.world_id WHERE o.delivered_at IS NULL AND w.mode=$1 ORDER BY o.id LIMIT 200',
          [config.mode],
        )
      ).rows;
      await Promise.allSettled([...subscribers].map((send) => send()));
      if (outbox.length)
        await store.pool.query('UPDATE outbox SET delivered_at=now() WHERE id=ANY($1::bigint[])', [
          outbox.map((row) => row.id),
        ]);
    } catch {
      app.log.error('Background database operation failed.');
    } finally {
      busy = false;
    }
  };
  let interval: ReturnType<typeof setInterval> | undefined;
  let validationInterval: ReturnType<typeof setInterval> | undefined;
  if (options.workers !== false) {
    app.addHook('onReady', async () => {
      await lifecycle.validateGrants(true);
    });
    interval = setInterval(() => {
      void tick();
    }, 250);
    interval.unref();
    validationInterval = setInterval(() => {
      void lifecycle
        .validateGrants()
        .catch(() => app.log.error('Twitch validation dependency failed.'));
    }, 60000);
    validationInterval.unref();
  }
  app.decorate('tick', tick);
  app.addHook('onClose', async () => {
    if (interval) clearInterval(interval);
    if (validationInterval) clearInterval(validationInterval);
  });
  const publicDir = resolve('apps/web/dist');
  if (existsSync(publicDir)) {
    await app.register(staticFiles, { root: publicDir, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (
        request.method !== 'GET' ||
        request.url.startsWith('/api/') ||
        request.url.startsWith('/integrations/')
      )
        return reply.code(404).send({ error: 'NOT_FOUND' });
      return reply.sendFile('index.html');
    });
  }
  return app;
}
