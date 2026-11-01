import Fastify from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';
import staticFiles from '@fastify/static';
import { existsSync } from 'node:fs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  CommandRequestSchema,
  DomainError,
  LivewireRequestSchema,
  SYSTEM_IDS,
} from '@torchline/contracts';
import type { Command, WorldPresentation } from '@torchline/contracts';
import {
  Store,
  participantIdentity,
  readWorldRecord,
  readWorldHistory,
  readHandoffPreview,
  advanceEpisodes,
  recoverEpisodes,
  configureEpisode,
  REQUIRED_MIGRATION,
  settleInterruption,
  mutateLivewire,
  readLivewire,
  castLivewire,
  recoverLivewire,
  expireLivewire,
  sweepRetention,
} from '@torchline/storage';
import type { Creator, StoredWorld } from '@torchline/storage';
import type { InputPolicy } from '@torchline/storage';
import {
  authorizationUrl,
  BOT_SCOPES,
  CREATOR_SCOPES,
  encryptSecret,
  decryptSecret,
  normalizeChat,
  parseChatCommand,
  parseLivewireVote,
  RaidSchema,
  requestToken,
  validateToken,
  revokeToken,
  verifyWebhook,
} from '@torchline/twitch';
import type { Fetcher } from '@torchline/twitch';
import { presentWorld } from './projection.ts';
import { twitchLifecycle } from './twitch-lifecycle.ts';
import { twitchSubscriptions } from './twitch-subscriptions.ts';
import { twitchBot } from './twitch-bot.ts';
import { twitchBotSetup } from './twitch-bot-setup.ts';

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
  botRepliesEnabled?: boolean;
  livewireEnabled?: boolean;
  inputPolicy?: InputPolicy;
  feedLimits?: { perChannel: number; total: number };
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
const denied = (code: string, message: string): never => {
  throw new DomainError(code, message);
};
const NodeText = z.string().min(1).max(80);

export async function createApp(
  store: Store,
  config: AppConfig,
  options: { fetcher?: Fetcher; workers?: boolean; logger?: boolean; onFatal?: () => void } = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const lifecycle = twitchLifecycle(store, config, fetcher);
  const subscriptions = twitchSubscriptions(store, config, fetcher, lifecycle.applicationToken);
  const botReplies = twitchBot(store, config, fetcher, lifecycle.applicationToken);
  const botSetup = twitchBotSetup(store, config, fetcher);
  const botSetupCookiePath = '/api/operator/bot-setup';
  const SessionCookie =
    config.mode === 'simulation' ? 'torchline_sim_session' : 'torchline_session';
  const secure = new URL(config.baseUrl).protocol === 'https:';
  const app = Fastify({
    bodyLimit: 65536,
    requestTimeout: 15000,
    connectionTimeout: 20000,
    forceCloseConnections: true,
    logger: options.logger
      ? {
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          serializers: { req: (req) => ({ method: req.method, path: req.url?.split('?')[0] }) },
        }
      : false,
  });
  await app.register(cookie);
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...(secure ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
  };
  app.addHook('onSend', async (request, reply, payload) => {
    reply.headers(securityHeaders);
    if (/^\/(api|auth|integrations|overlay)(\/|$)/.test(request.url))
      reply.header('Cache-Control', 'no-store');
    return payload;
  });
  app.setErrorHandler((err, request, reply) => {
    const error = err as Error & { code?: string };
    const botRoleError = error instanceof DomainError && error.code === 'BOT_CREATOR_HISTORY';
    if (
      botRoleError &&
      request.url.split('?')[0] === '/auth/twitch/callback' &&
      request.headers.accept?.includes('text/html')
    ) {
      const recovery =
        'Keep this account as a creator. Sign into a separate Twitch account in a private browser window and use TORCHLINE’s dedicated bot setup form.';
      return reply
        .code(403)
        .type('text/html; charset=utf-8')
        .send(
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TORCHLINE · Bot connection</title></head><body><main><h1>Bot authorization needs another step</h1><p>${escapeHtml(error.message)}</p><p>${escapeHtml(recovery)}</p><p><a href="/">Return to TORCHLINE</a></p></main></body></html>`,
        );
    }
    if (error instanceof DomainError)
      return reply
        .code(
          botRoleError ||
            ['FORBIDDEN', 'HOST_REQUIRED', 'MODE_MISMATCH', 'INVALID_SIGNATURE'].includes(
              error.code,
            )
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
    const clientErrors: Record<string, number> = {
      FST_ERR_CTP_INVALID_JSON_BODY: 400,
      FST_ERR_CTP_EMPTY_JSON_BODY: 400,
      FST_ERR_CTP_BODY_TOO_LARGE: 413,
      FST_ERR_CTP_INVALID_MEDIA_TYPE: 415,
    };
    if (error.code && clientErrors[error.code])
      return reply.code(clientErrors[error.code]).send({
        error: clientErrors[error.code] === 413 ? 'BODY_TOO_LARGE' : 'INVALID_INPUT',
        message: 'The request body is invalid, unsupported or exceeds the allowed size.',
      });
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
  const sessionCreator = async (request: FastifyRequest): Promise<Creator> => {
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
    return session;
  };
  const currentCreator = async (request: FastifyRequest): Promise<Creator> => {
    const session = await sessionCreator(request);
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
  // What a receiving custodian inherited, attributed to the community that sent it. The briefing is
  // current only while the receiver has not changed the world, so it clears itself on their first
  // command instead of becoming permanent decoration. World revision is part of the key because a
  // second transfer can arrive at the same state version.
  type ArrivalBriefing = NonNullable<WorldPresentation['arrival']>;
  const arrivals = new Map<string, ArrivalBriefing | undefined>();
  const arrivalBriefing = async (world: StoredWorld): Promise<ArrivalBriefing | undefined> => {
    const key = `${world.id}:${world.state.version}:${world.revision}`;
    if (arrivals.has(key)) return arrivals.get(key);
    const row = (
      await store.pool.query(
        `SELECT h.created_at,h.state_version,s.id AS source_id,s.label AS source_label
         FROM custody_events h JOIN creators s ON s.id=h.source_id
         WHERE h.world_id=$1 ORDER BY h.created_at DESC,h.id DESC LIMIT 1`,
        [world.id],
      )
    ).rows[0];
    const marks = SYSTEM_IDS.reduce((total, id) => total + world.state.systems[id].marks.length, 0);
    let briefing: ArrivalBriefing | undefined;
    if (row && row.state_version !== null && row.state_version === world.state.version) {
      // Every captain commitment aboard, named by the community that made it. Summaries begin
      // with the authored choice label, so no rules version needs a separate lookup table.
      const decisions = (
        await store.pool.query(
          `SELECT e.event->>'id' AS id,(e.event->>'chapter')::integer AS chapter,e.event->>'summary' AS summary,
                  e.event->'actor'->>'community' AS community,c.label
           FROM world_events e LEFT JOIN creators c ON c.id=e.event->'actor'->>'community'
           WHERE e.world_id=$1 AND e.event->'command'->>'type'='commit' ORDER BY e.sequence`,
          [world.id],
        )
      ).rows.map((item) => ({
        eventId: item.id as string,
        chapter: item.chapter as number,
        choice: (item.summary as string).split(': committed by ')[0],
        community: (item.label as string | null) ?? (item.community as string),
      }));
      briefing = {
        at: (row.created_at as Date).toISOString(),
        from: { id: row.source_id as string, label: row.source_label as string },
        briefing: `Received from ${row.source_label} · ${world.state.resources.passengers} passengers aboard · ${marks} lasting marks · chapter ${world.state.chapter}`,
        lostSystems: SYSTEM_IDS.filter((id) => world.state.systems[id].integrity === 0),
        decisions,
        debts: world.state.obligations
          .filter((obligation) => obligation.status === 'pending')
          .map((obligation) => ({
            kind: obligation.kind,
            dueChapter: obligation.dueChapter,
            origin: decisions.find((item) => item.eventId === obligation.originEventId) ?? null,
          })),
        communities: new Set([...decisions.map((item) => item.community), world.label]).size,
      };
    }
    if (arrivals.size > 512) arrivals.clear();
    arrivals.set(key, briefing);
    return briefing;
  };
  const buildSnapshot = async (creator: Creator, readonly = false) => {
    const world = await store.active(creator.id, true);
    if (world && (world.custodian_id !== creator.id || world.mode !== config.mode))
      denied('STATE_CHANGED', 'The channel assignment changed. Refresh the saved state.');
    const bot = (await store.pool.query("SELECT id FROM oauth_grants WHERE role='bot' LIMIT 1"))
      .rows[0];
    const details =
      config.mode === 'live' && !readonly ? await subscriptions.status(creator.id) : undefined;
    const visibleWorld = world ? presentWorld(world, !readonly) : null;
    if (world && visibleWorld && world.state.phase === 'ready') {
      const arrival = await arrivalBriefing(world);
      if (arrival) visibleWorld.arrival = arrival;
    }
    if (
      world &&
      visibleWorld &&
      ['investigation', 'challenge', 'allocation', 'decision'].includes(world.state.phase)
    ) {
      const rejections = await store.rejections(world.id, world.state.window);
      if (rejections.length) visibleWorld.rejections = rejections;
    }
    if (world && visibleWorld && (config.livewireEnabled || world.state.livewire)) {
      const { author: _author, channel: _channel, ...stake } = world.state.livewire?.stake ?? {};
      const chargeAvailable = !world.state.livewire?.spentChapters.includes(world.state.chapter);
      const compatible =
        world.state.rulesVersion === 'ark-v3' &&
        world.state.phase === 'ready' &&
        world.state.chapter < 5 &&
        !world.frozen_by;
      const chatReady =
        config.mode === 'simulation' ||
        (details?.chatReady ?? (await subscriptions.chatAvailable(creator.id)));
      const unresolved =
        world.state.livewire &&
        ['open', 'locked', 'paused'].includes(world.state.livewire.stake.status);
      const available =
        !!config.livewireEnabled &&
        compatible &&
        chargeAvailable &&
        !unresolved &&
        chatReady &&
        world.state.resources.supplies >= 1;
      visibleWorld.livewire = {
        enabled: !!config.livewireEnabled,
        available,
        chargeAvailable,
        reason: !config.livewireEnabled
          ? 'New missions disabled'
          : !compatible
            ? 'Finish the chapter or handoff first'
            : unresolved
              ? 'Resolve or cancel the current mission'
              : !chargeAvailable
                ? 'This boundary’s mission allowance is spent'
                : !chatReady
                  ? 'Repair the Twitch chat connection'
                  : world.state.resources.supplies < 1
                    ? 'One supply is required'
                    : 'One mission at this boundary · costs 1 supply',
        stake: world.state.livewire
          ? (stake as NonNullable<typeof visibleWorld.livewire>['stake'])
          : null,
        ...(await readLivewire(store, world.state)),
        canControl: !readonly && !world.frozen_by,
      };
    }
    return {
      me: { id: creator.id, label: creator.label, receiveOptIn: creator.receive_opt_in },
      mode: config.mode,
      world: visibleWorld,
      ...(readonly
        ? {}
        : {
            worlds: (await store.library(creator.id)).map((row) => ({
              id: row.id,
              chapter: row.chapter,
              outcome: row.outcome,
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
        botAuthorized: details?.botAuthorized ?? Boolean(bot),
        botRepliesEnabled: config.botRepliesEnabled !== false,
        publicHttps: secure,
        genuineRaidVerified: false,
        ...(details ? { details } : {}),
      },
    };
  };
  const snapshot = async (creator: Creator, readonly = false) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await store.creator(creator.id);
      if (!before?.connected || before.mode !== config.mode)
        return denied('FORBIDDEN', 'Creator authorization ended.');
      try {
        const result = await buildSnapshot(before, readonly);
        const after = await store.creator(creator.id);
        if (!after?.connected || after.mode !== config.mode)
          return denied('FORBIDDEN', 'Creator authorization ended.');
        if (before.assignment_revision !== after.assignment_revision) continue;
        return { ...result, channelEpoch: before.assignment_revision };
      } catch (error) {
        if (!(error instanceof DomainError && error.code === 'STATE_CHANGED')) throw error;
      }
    }
    return denied('STATE_CHANGED', 'The channel is changing. Reconnect to its saved state.');
  };
  app.get('/health/live', async () => ({ ok: true, mode: config.mode }));
  app.get('/health/ready', async () => {
    if (
      !(
        await store.pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [
          REQUIRED_MIGRATION,
        ])
      ).rowCount
    )
      denied('NOT_CONFIGURED', 'Database migration required.');
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
          botAuthorized:
            config.mode === 'live' &&
            Boolean(
              (
                await store.pool.query(
                  "SELECT 1 FROM oauth_grants WHERE role='bot' AND scopes @> $1::text[] AND validated_at>now()-interval '1 hour'",
                  [BOT_SCOPES],
                )
              ).rowCount,
            ),
          publicHttps: secure,
          genuineRaidVerified: false,
        },
      };
    const result = await snapshot(await currentCreator(request));
    await currentCreator(request);
    return result;
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
  app.get('/api/worlds/:id/view', async (request) => {
    const creator = await currentCreator(request);
    const { id } = z.object({ id: NodeText }).parse(request.params);
    return presentWorld(await readWorldRecord(store, creator, id));
  });
  app.get('/api/worlds/:id/history', async (request) => {
    const creator = await currentCreator(request);
    const { id } = z.object({ id: NodeText }).parse(request.params);
    const query = z
      .object({
        before: z.coerce.number().int().min(1).max(2147483647).optional(),
        through: z.coerce.number().int().min(0).max(2147483646).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        custodyBefore: NodeText.optional(),
      })
      .strict()
      .parse(request.query);
    return readWorldHistory(store, creator, id, query);
  });
  app.get('/api/handoffs/:id/preview', async (request) => {
    const creator = await currentCreator(request);
    const { id } = z.object({ id: NodeText }).parse(request.params);
    const preview = await readHandoffPreview(store, creator, id);
    return { ...preview, world: presentWorld(preview.world) };
  });
  app.post('/api/worlds/:id/commands', async (request) => {
    const creator = await currentCreator(request);
    const { id } = z.object({ id: NodeText }).parse(request.params);
    const body = CommandRequestSchema.parse(request.body);
    if (
      config.mode === 'live' &&
      body.command.type === 'resume' &&
      !(await subscriptions.chatAvailable(creator.id))
    )
      denied(
        'SUBSCRIPTION_UNREADY',
        'Repair the Twitch chat connection before resuming this live episode.',
      );
    const participation = ['inspect', 'allocate', 'scan', 'route', 'patch', 'vote'].includes(
      body.command.type,
    );
    await store.command(
      id,
      {
        id: participation ? participantIdentity(id, creator.id, config.sessionSecret) : creator.id,
        role: 'host',
        community: creator.id,
      },
      creator.mode,
      body.expectedVersion,
      body.commandId,
      body.command,
    );
    return snapshot(creator);
  });
  app.post('/api/worlds/:id/livewire', async (request) => {
    const creator = await currentCreator(request);
    const { id } = z.object({ id: NodeText }).parse(request.params);
    const body = LivewireRequestSchema.parse(request.body);
    if (!config.livewireEnabled && !['cancel', 'resolve'].includes(body.action.type))
      denied(
        'FEATURE_DISABLED',
        'LIVEWIRE is disabled; existing missions may be resolved or cancelled.',
      );
    await mutateLivewire(
      store,
      creator,
      id,
      body,
      config.mode === 'simulation' || (await subscriptions.chatAvailable(creator.id)),
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
    const stake = parseLivewireVote(text);
    if (!command && !stake)
      denied('INVALID_INPUT', 'Use !scan, !route, !patch or !vote with valid arguments.');
    const world = await store.active(creator.id);
    if (!world) denied('NOT_FOUND', 'Create a world first.');
    if (
      config.livewireEnabled &&
      stake &&
      (await castLivewire(
        store,
        {
          channel: creator.id,
          actor,
          target: stake,
          providerAt: new Date().toISOString(),
          deliveryId: randomUUID(),
          messageId: randomUUID(),
          mode: 'simulation',
          participantKey: config.sessionSecret,
        },
        config.inputPolicy,
      ))
    )
      return snapshot(creator);
    const actorId = participantIdentity(world!.id, actor, config.sessionSecret);
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
    // A live offer covers the minutes around a real raid. Practice relays are read and explained
    // step by step, so they get a longer window; their proof still cannot move a live world.
    return store.prepare(
      body.worldId,
      creator,
      body.targetId,
      body.expectedVersion,
      config.mode === 'simulation' ? 900000 : undefined,
    );
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
      const simulationAt = (
        await store.pool.query('SELECT greatest(clock_timestamp(),$1::timestamptz) AS at', [
          intent!.prepared_at,
        ])
      ).rows[0].at as Date;
      await store.observeRaid({
        messageId: `simulation:${id}`,
        mode: 'simulation',
        sourceId: intent!.source_id,
        targetId: intent!.target_id,
        subscriptionId: 'simulation-only',
        notificationAt: simulationAt.toISOString(),
      });
    } else if (action === 'accept') {
      const intent = (await store.handoffs(creator.id)).find((item) => item.id === id);
      if (!intent || intent.target_id !== creator.id || intent.mode !== creator.mode)
        denied('FORBIDDEN', 'Only the intended receiving creator can accept.');
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
  app.get('/api/operator/bot-setup', async (request) => {
    requireTwitch();
    return { pending: await botSetup.preview(request.cookies.torchline_bot_setup) };
  });
  app.post('/api/operator/bot-setup/confirm', async (request, reply) => {
    requireTwitch();
    z.object({}).strict().parse(request.body);
    const result = await botSetup.confirm(request.cookies.torchline_bot_setup);
    reply.clearCookie('torchline_bot_setup', { path: botSetupCookiePath });
    reply.clearCookie(SessionCookie, { path: '/' });
    if (options.workers !== false)
      void subscriptions
        .reconcileAll()
        .catch(() => app.log.error('Subscription reconciliation failed.'));
    return result;
  });
  app.post('/api/operator/bot-setup/cancel', async (request, reply) => {
    requireTwitch();
    z.object({}).strict().parse(request.body);
    await botSetup.cancel(request.cookies.torchline_bot_setup);
    reply.clearCookie('torchline_bot_setup', { path: botSetupCookiePath });
    return { cancelled: true };
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
    if (state.role === 'bot') {
      const confirmation = await botSetup.authorize(
        identity.user_id!,
        identity.login ?? identity.user_id!,
        identity.scopes,
        tokens,
      );
      if (confirmation) {
        reply.setCookie('torchline_bot_setup', confirmation, {
          path: botSetupCookiePath,
          httpOnly: true,
          sameSite: 'strict',
          secure,
          maxAge: 300,
        });
      } else {
        reply.clearCookie('torchline_bot_setup', { path: botSetupCookiePath });
        reply.clearCookie(SessionCookie, { path: '/' });
        if (options.workers !== false)
          void subscriptions
            .reconcileAll()
            .catch(() => app.log.error('Subscription reconciliation failed.'));
      }
      return reply.redirect('/');
    }
    const creator = await store.transaction(async (c) => {
      // Both OAuth roles share this lock so simultaneous callbacks cannot create dual authority.
      await c.query('SELECT pg_advisory_xact_lock(833017)');
      await store.lockChannels(c, [identity.user_id!]);
      if (
        (await c.query("SELECT 1 FROM oauth_grants WHERE id=$1 AND role='bot'", [identity.user_id]))
          .rowCount
      ) {
        denied('FORBIDDEN', 'The bot account cannot be a creator in this application.');
      }
      await c.query(
        'INSERT INTO oauth_grants(id,role,scopes,encrypted) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role,scopes=EXCLUDED.scopes,encrypted=EXCLUDED.encrypted,validated_at=now()',
        [identity.user_id, state.role, identity.scopes, encryptSecret(tokens, config.tokenKey)],
      );
      return state.role === 'creator'
        ? store.ensureCreator(identity.user_id!, identity.login ?? identity.user_id!, 'live', c)
        : null;
    });
    if (creator) await setSession(creator, reply);
    else reply.clearCookie(SessionCookie, { path: '/' });
    if (options.workers !== false)
      void subscriptions
        .reconcileAll()
        .catch(() => app.log.error('Subscription reconciliation failed.'));
    return reply.redirect('/');
  });
  app.post('/api/twitch/reconcile', async (request) => {
    requireTwitch();
    const creator = await currentCreator(request);
    await subscriptions.reconcile(creator.id);
    return {
      subscriptions: (
        await store.pool.query('SELECT type,status FROM subscriptions WHERE channel_id=$1', [
          creator.id,
        ])
      ).rows,
    };
  });
  app.get('/api/twitch/status', async (request) => {
    const creator = await currentCreator(request);
    if (config.mode !== 'live')
      denied('MODE_MISMATCH', 'Live integration status is unavailable in simulation.');
    return subscriptions.status(creator.id);
  });
  app.post('/api/twitch/disconnect', async (request, reply) => {
    // A valid local session may revoke its own access even when provider validation is stale.
    const creator = await sessionCreator(request);
    if (config.mode !== 'live') denied('MODE_MISMATCH', 'Use logout for a simulation session.');
    const grant = (
      await store.pool.query("SELECT encrypted FROM oauth_grants WHERE id=$1 AND role='creator'", [
        creator.id,
      ])
    ).rows[0];
    await store.disconnectCreator(creator.id);
    reply.clearCookie(SessionCookie, { path: '/' });
    let providerRevoked = false;
    if (grant && config.twitchClientId) {
      try {
        providerRevoked = await revokeToken(
          config.twitchClientId,
          decryptSecret<{ access_token: string }>(grant.encrypted, config.tokenKey).access_token,
          fetcher,
        );
      } catch {
        /* Local revocation must succeed even if provider/key access fails. */
      }
    }
    return { disconnected: true, providerRevoked };
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
      const { channel, challenge } = await subscriptions.observe(notification);
      if (challenge) return reply.type('text/plain').send(notification.challenge);
      if (notification.type === 'revocation') return reply.code(204).send();
      if (subscription.type === 'channel.chat.message') {
        const chat = normalizeChat(notification.event);
        if (chat) {
          const bot = (
            await store.pool.query("SELECT id FROM oauth_grants WHERE role='bot' LIMIT 1")
          ).rows[0];
          if (chat.channelId !== channel || subscription.condition.user_id !== bot?.id)
            denied('FORBIDDEN', 'Chat identity does not match its subscription.');
          if (chat.actorId !== bot?.id) {
            if (
              config.livewireEnabled &&
              chat.stake &&
              (await castLivewire(
                store,
                {
                  channel,
                  actor: chat.actorId,
                  target: chat.stake,
                  providerAt: notification.timestamp,
                  deliveryId: notification.id,
                  messageId: chat.messageId,
                  mode: 'live',
                  participantKey: config.sessionSecret,
                },
                config.inputPolicy,
              ))
            ) {
              // Already committed under the channel/world locks; no outbound reply dependency.
            } else if (chat.query)
              await botReplies.enqueue(notification.id, channel, chat.messageId, chat.query);
            else if (chat.command)
              await store.enqueueChat(
                notification.id,
                channel,
                chat.actorId,
                chat.command,
                notification.timestamp,
                config.sessionSecret,
                chat.messageId,
                config.inputPolicy,
              );
          }
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
      } else if (subscription.type === 'stream.offline') {
        const world = await store.active(channel, true);
        if (
          world?.state.livewire?.stake.status === 'open' &&
          Date.parse(notification.timestamp) >=
            Date.parse(
              world.state.livewire.stake.windowOpenedAt ?? world.state.livewire.stake.openedAt,
            )
        )
          await recoverLivewire(store, config.mode, 'offline', channel);
        const eligible =
          world &&
          !world.frozen_by &&
          !['ready', 'paused', 'ended'].includes(world.state.phase) &&
          world.state.windowOpenedAt &&
          Date.parse(notification.timestamp) >= Date.parse(world.state.windowOpenedAt);
        await store.pool.query(
          'INSERT INTO eventsub_inbox(message_id,type,payload,processed_at) VALUES($1,$2,$3,$4) ON CONFLICT(message_id) DO NOTHING',
          [
            notification.id,
            subscription.type,
            eligible
              ? {
                  kind: 'offline',
                  worldId: world.id,
                  channelId: channel,
                  window: world.state.window,
                }
              : { kind: 'presence', channelId: channel },
            eligible ? null : new Date(),
          ],
        );
      } else
        await store.pool.query(
          'INSERT INTO eventsub_inbox(message_id,type,payload,processed_at) VALUES($1,$2,$3,now()) ON CONFLICT(message_id) DO NOTHING',
          [notification.id, subscription.type, { kind: 'presence', channelId: channel }],
        );
      await subscriptions.record(
        notification.id,
        channel,
        subscription.id,
        subscription.type === 'channel.chat.message'
          ? 'chat'
          : subscription.type === 'channel.raid'
            ? 'raid'
            : 'presence',
      );
      return reply.code(204).send();
    });
  });

  app.post('/api/overlay-grant', async (request) => {
    const creator = await currentCreator(request);
    const token = randomBytes(32).toString('hex');
    await store.transaction(async (c) => {
      await store.lockChannels(c, [creator.id]);
      const connected = (
        await c.query('SELECT 1 FROM creators WHERE id=$1 AND connected AND mode=$2', [
          creator.id,
          config.mode,
        ])
      ).rowCount;
      if (!connected) denied('UNAUTHENTICATED', 'Reconnect the creator account first.');
      await c.query('DELETE FROM overlay_grants WHERE channel_id=$1', [creator.id]);
      await c.query('INSERT INTO overlay_grants(hash,channel_id) VALUES($1,$2)', [
        digest(token),
        creator.id,
      ]);
    });
    return { url: `${config.baseUrl}/overlay/${encodeURIComponent(creator.id)}/#${token}` };
  });
  app.post('/overlay/:channel/session', async (request, reply) => {
    const { channel } = z.object({ channel: NodeText }).parse(request.params);
    const { token } = z.object({ token: z.string().length(64) }).parse(request.body);
    const grant = (
      await store.pool.query(
        'SELECT 1 FROM overlay_grants WHERE hash=$1 AND channel_id=$2 AND (expires_at IS NULL OR expires_at>clock_timestamp())',
        [digest(token), channel],
      )
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
  const feedCounts = new Map<string, number>();
  const endFeeds = new Set<() => void>();
  const feedLimits = config.feedLimits ?? { perChannel: 8, total: 256 };
  // Several views of one channel (dashboard tabs, OBS sources, spectator windows) ask for the same
  // world. Building that projection clones the whole state and re-reads the library, so concurrent
  // views share one authoritative read per publication round instead of one each.
  const projections = new Map<string, { value: unknown; at: number }>();
  const rounds = new Map<string, Promise<unknown>>();
  const PROJECTION_REUSE_MS = 200;
  const CLOCK_RESYNC_MS = 4000;
  const shareProjection = <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const held = projections.get(key);
    if (held && Date.now() - held.at < PROJECTION_REUSE_MS) return Promise.resolve(held.value as T);
    const pending = rounds.get(key);
    if (pending) return pending as Promise<T>;
    const round = load()
      .then((value) => {
        if (projections.size > 256)
          for (const [id, entry] of projections)
            if (entry.at < Date.now() - PROJECTION_REUSE_MS) projections.delete(id);
        projections.set(key, { value, at: Date.now() });
        return value;
      })
      .finally(() => rounds.delete(key));
    rounds.set(key, round);
    return round;
  };
  const stream = (
    request: FastifyRequest,
    reply: FastifyReply,
    channel: string,
    load: () => Promise<unknown>,
  ) => {
    const count = feedCounts.get(channel) ?? 0;
    if (count >= feedLimits.perChannel || subscribers.size >= feedLimits.total)
      return reply.code(429).header('Retry-After', '5').send({
        error: 'FEED_LIMIT',
        message: 'Too many live views. Close an unused view and reconnect.',
      });
    feedCounts.set(channel, count + 1);
    reply.hijack();
    reply.raw.writeHead(200, {
      ...securityHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    let closed = false;
    let sending = false;
    let last = '';
    let publishedAt = 0;
    const send = async () => {
      if (closed || sending) return;
      sending = true;
      try {
        const value = await load();
        if (closed) return;
        const body = JSON.stringify(value);
        // The server clock moves on every read. Publishing it on its own keeps an idle world from
        // rewriting its whole snapshot several times a second, while a running phase clock stays
        // exact: the client derives its offset from the last server time it was given.
        const content = JSON.stringify(value, (key, item) =>
          key === 'serverAt' ? undefined : item,
        );
        const clocked = Boolean((value as { world?: { clock?: unknown } } | null)?.world?.clock);
        if (content !== last) {
          last = content;
          publishedAt = Date.now();
          if (reply.raw.writableLength > 262144) reply.raw.end();
          else reply.raw.write(`event: snapshot\ndata: ${body}\n\n`);
        } else if (clocked && Date.now() - publishedAt >= CLOCK_RESYNC_MS) {
          publishedAt = Date.now();
          reply.raw.write(
            `event: clock\ndata: ${JSON.stringify({ serverAt: new Date().toISOString() })}\n\n`,
          );
        }
      } catch (error) {
        if (closed) return;
        const terminal =
          error instanceof DomainError && ['FORBIDDEN', 'UNAUTHENTICATED'].includes(error.code);
        reply.raw.write(`event: ${terminal ? 'unavailable' : 'retrying'}\ndata: {}\n\n`);
        reply.raw.end();
      } finally {
        sending = false;
      }
    };
    subscribers.add(send);
    const end = () => reply.raw.end();
    endFeeds.add(end);
    void send();
    const heartbeat = setInterval(() => {
      if (!closed) reply.raw.write(': heartbeat\n\n');
    }, 15000);
    heartbeat.unref();
    reply.raw.on('close', () => {
      closed = true;
      clearInterval(heartbeat);
      subscribers.delete(send);
      endFeeds.delete(end);
      const remaining = (feedCounts.get(channel) ?? 1) - 1;
      if (remaining) feedCounts.set(channel, remaining);
      else feedCounts.delete(channel);
    });
  };
  app.get('/api/live/events', async (request, reply) => {
    const creator = await currentCreator(request);
    return stream(request, reply, creator.id, async () => {
      // This view rechecks its own authority before and after the read; only the projection is shared.
      const current = await currentCreator(request);
      const result = await shareProjection(`creator:${current.id}`, () => snapshot(current));
      await currentCreator(request);
      return result;
    });
  });
  const overlaySnapshot = async (request: FastifyRequest, channel: string) => {
    const token = request.cookies.torchline_overlay ?? '';
    const grantValid = async () =>
      Boolean(
        (
          await store.pool.query(
            'SELECT 1 FROM overlay_grants WHERE hash=$1 AND channel_id=$2 AND (expires_at IS NULL OR expires_at>clock_timestamp())',
            [digest(token), channel],
          )
        ).rowCount,
      );
    if (!(await grantValid())) denied('FORBIDDEN', 'Overlay access revoked.');
    const creator = await store.creator(channel);
    if (!creator || creator.mode !== config.mode)
      denied('FORBIDDEN', 'Overlay channel unavailable.');
    const result = await shareProjection(`overlay:${channel}`, () => snapshot(creator!, true));
    if (!(await grantValid())) denied('FORBIDDEN', 'Overlay access revoked.');
    return result;
  };
  app.get('/overlay/:channel/state', async (request) => {
    const { channel } = z.object({ channel: NodeText }).parse(request.params);
    return overlaySnapshot(request, channel);
  });
  app.get('/overlay/:channel/events', async (request, reply) => {
    const { channel } = z.object({ channel: NodeText }).parse(request.params);
    const load = () => overlaySnapshot(request, channel);
    await load();
    return stream(request, reply, channel, load);
  });
  app.post('/api/worlds/:id/timing', async (request) => {
    const creator = await currentCreator(request);
    const { id } = z.object({ id: NodeText }).parse(request.params);
    const duration = z.number().int().min(15).max(1800).nullable();
    const durations = z
      .object({
        investigation: duration,
        challenge: duration,
        allocation: duration,
        decision: duration,
      })
      .strict()
      .parse(request.body);
    await configureEpisode(store, creator, id, durations);
    return { ok: true };
  });
  app.post('/api/twitch/retry-inputs', async (request) => {
    z.object({}).strict().parse(request.body);
    const creator = await currentCreator(request);
    if (creator.mode !== 'live')
      denied('MODE_MISMATCH', 'Live input recovery requires a live creator.');
    const retried = await store.transaction(async (c) => {
      await store.lockChannels(c, [creator.id]);
      const connected = (
        await c.query("SELECT 1 FROM creators WHERE id=$1 AND connected AND mode='live'", [
          creator.id,
        ])
      ).rowCount;
      if (!connected) denied('FORBIDDEN', 'Creator authorization ended.');
      const world = (
        await c.query(
          'SELECT w.* FROM worlds w JOIN channel_slots s ON s.world_id=w.id WHERE s.channel_id=$1 FOR UPDATE OF w',
          [creator.id],
        )
      ).rows[0];
      if (!world || world.frozen_by) return 0;
      return (
        (
          await c.query(
            `UPDATE eventsub_inbox SET processed_at=NULL,attempts=0,next_attempt_at=clock_timestamp(),error=NULL WHERE error='RETRY_EXHAUSTED' AND payload->>'kind'='chat' AND payload->>'channelId'=$1 AND payload->>'worldId'=$2 AND (payload->>'window')::integer=$3`,
            [creator.id, world.id, world.state.window],
          )
        ).rowCount ?? 0
      );
    });
    return { retried };
  });
  let busy = false;
  let workersReady = options.workers === false;
  let startupRecovering = options.workers !== false;
  let recoveryWorldIds: string[] = [];
  let workerLease: import('pg').PoolClient | undefined;
  let activeTick: Promise<void> | undefined;
  const processTick = async () => {
    if (busy || !workersReady) return;
    busy = true;
    try {
      await store.expire(config.mode);
      await expireLivewire(store, config.mode);
      await subscriptions.interruptUnavailableEpisodes();
      const items =
        config.mode === 'live'
          ? (
              await store.pool.query(
                "WITH due AS (SELECT *,row_number() OVER(PARTITION BY COALESCE(payload->>'channelId',payload->>'targetId','control') ORDER BY received_at,message_id) AS position FROM eventsub_inbox WHERE processed_at IS NULL AND next_attempt_at<=clock_timestamp()) SELECT * FROM due ORDER BY CASE WHEN payload->>'kind'='raid' THEN 0 ELSE 1 END,position,received_at,message_id LIMIT 30",
              )
            ).rows
          : [];
      for (const item of items) {
        try {
          if (item.payload.kind === 'interruption') {
            await settleInterruption(store, item.message_id, config.mode);
          } else if (item.payload.kind === 'raid') {
            await store.observeRaid({ messageId: item.message_id, mode: 'live', ...item.payload });
            await store.pool.query(
              'UPDATE eventsub_inbox SET processed_at=now() WHERE message_id=$1',
              [item.message_id],
            );
          } else if (item.payload.kind === 'offline') {
            const world = await store.get(item.payload.worldId, true);
            if (
              world.state.window === item.payload.window &&
              !['ready', 'paused', 'ended'].includes(world.state.phase)
            )
              await store.command(
                world.id,
                { id: 'stream-presence', role: 'host', community: item.payload.channelId },
                'live',
                world.revision,
                `offline:${item.message_id}`,
                { type: 'pause' },
              );
            await store.pool.query(
              'UPDATE eventsub_inbox SET processed_at=now() WHERE message_id=$1',
              [item.message_id],
            );
          } else if (item.payload.kind === 'chat') {
            const payload = item.payload;
            const world = await store.get(payload.worldId, true);
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
          if (
            item.payload.kind === 'interruption' &&
            e instanceof DomainError &&
            e.code === 'INPUT_PENDING'
          )
            await store.pool.query(
              "UPDATE eventsub_inbox SET next_attempt_at=clock_timestamp()+interval '1 second' WHERE message_id=$1 AND processed_at IS NULL",
              [item.message_id],
            );
          else if (e instanceof DomainError && !['STALE_VERSION', 'INPUT_PENDING'].includes(e.code))
            await store.pool.query(
              'UPDATE eventsub_inbox SET processed_at=now(),error=$2 WHERE message_id=$1',
              [item.message_id, e.code],
            );
          else {
            await store.pool.query(
              `UPDATE eventsub_inbox SET attempts=attempts+1,next_attempt_at=clock_timestamp()+least(60,power(2,least(attempts,6))) * interval '1 second',processed_at=CASE WHEN attempts>=7 THEN clock_timestamp() ELSE NULL END,error=CASE WHEN attempts>=7 THEN 'RETRY_EXHAUSTED' ELSE 'DEPENDENCY_RETRY' END WHERE message_id=$1 AND processed_at IS NULL`,
              [item.message_id],
            );
            if (!(e instanceof DomainError))
              app.log.error('Inbox dependency failure; event retained for retry.');
          }
        }
      }
      if (startupRecovering) {
        await recoverEpisodes(store, config.mode, undefined, recoveryWorldIds);
        startupRecovering = Boolean(
          (
            await store.pool.query(
              'SELECT 1 FROM episode_clocks e JOIN worlds w ON w.id=e.world_id JOIN creators c ON c.id=w.custodian_id WHERE w.mode=$1 AND c.connected AND e.deadline_at IS NOT NULL AND w.id=ANY($2::text[]) LIMIT 1',
              [config.mode, recoveryWorldIds],
            )
          ).rowCount,
        );
      } else await advanceEpisodes(store, config.mode);
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
  const tick = () =>
    (activeTick ??= processTick().finally(() => {
      activeTick = undefined;
    }));
  let interval: ReturnType<typeof setInterval> | undefined;
  let validationInterval: ReturnType<typeof setInterval> | undefined;
  let botInterval: ReturnType<typeof setInterval> | undefined;
  let retentionInterval: ReturnType<typeof setInterval> | undefined;
  if (options.workers !== false) {
    app.addHook('onReady', async () => {
      workerLease = await store.pool.connect();
      const lease = await workerLease.query(
        "SELECT pg_try_advisory_lock(hashtext(current_database()),hashtext('torchline:worker:v1:'||current_schema()||':'||$1)) AS acquired",
        [config.mode],
      );
      if (!lease.rows[0].acquired) {
        workerLease.release();
        workerLease = undefined;
        throw new Error('Another TORCHLINE worker owns this database/schema/mode.');
      }
      workerLease.on('error', () => {
        workersReady = false;
        app.log.error('Worker lease lost; closing this process.');
        options.onFatal?.();
        void app.close();
      });
      await lifecycle.validateGrants(true);
      await botSetup.expire();
      await botReplies.recover();
      await recoverLivewire(store, config.mode);
      recoveryWorldIds = (
        await store.pool.query(
          'SELECT e.world_id FROM episode_clocks e JOIN worlds w ON w.id=e.world_id WHERE w.mode=$1 AND e.deadline_at IS NOT NULL',
          [config.mode],
        )
      ).rows.map((row) => row.world_id);
      await recoverEpisodes(store, config.mode, undefined, recoveryWorldIds);
      startupRecovering = recoveryWorldIds.length > 0;
      workersReady = true;
      void subscriptions
        .reconcileAll()
        .catch(() => app.log.error('Subscription reconciliation failed.'));
    });
    interval = setInterval(() => {
      void tick();
    }, 250);
    interval.unref();
    botInterval = setInterval(() => {
      void botReplies.tick().catch(() => app.log.error('Bot delivery dependency failed.'));
    }, 500);
    botInterval.unref();
    validationInterval = setInterval(() => {
      void lifecycle
        .validateGrants()
        .then(() => botSetup.expire())
        .then(() => subscriptions.reconcileAll())
        .catch(() => app.log.error('Twitch validation dependency failed.'));
    }, 60000);
    validationInterval.unref();
    // Operational rows (delivered outbox, terminal inbox, expired sessions and states) otherwise
    // grow with every broadcast. Counts that diagnostics report are folded, not lost.
    retentionInterval = setInterval(() => {
      void sweepRetention(store)
        .then((result) => {
          const removed =
            result.inbox +
            result.dedup +
            result.outbox +
            result.sessions +
            result.oauthStates +
            result.inputLimits +
            result.inputRejections;
          if (removed) app.log.info(result, 'Retention sweep removed terminal rows.');
        })
        .catch(() => app.log.error('Retention sweep dependency failed.'));
    }, 300000);
    retentionInterval.unref();
  }
  app.decorate('tick', tick);
  app.decorate('botTick', botReplies.tick);
  app.addHook('onClose', async () => {
    for (const end of endFeeds) end();
    workersReady = false;
    if (interval) clearInterval(interval);
    if (validationInterval) clearInterval(validationInterval);
    if (botInterval) clearInterval(botInterval);
    if (retentionInterval) clearInterval(retentionInterval);
    await activeTick;
    await botReplies.close();
    if (workerLease) {
      await workerLease
        .query(
          "SELECT pg_advisory_unlock(hashtext(current_database()),hashtext('torchline:worker:v1:'||current_schema()||':'||$1))",
          [config.mode],
        )
        .catch(() => {});
      workerLease.release();
      workerLease = undefined;
    }
  });
  const publicDir = resolve('apps/web/dist');
  if (existsSync(publicDir)) {
    await app.register(staticFiles, { root: publicDir, wildcard: true });
    app.setNotFoundHandler((request, reply) => {
      const path = request.url.split('?')[0];
      const privatePath =
        /(^|\/)\./.test(path) ||
        /^\/(?:apps|docs|frontend-design|infrastructure|packages|scripts|tests)(?:\/|$)/i.test(
          path,
        ) ||
        /^\/(?:AGENTS|CHANGELOG|CONTRIBUTING|README|SECURITY)(?:\.|$)/i.test(path);
      if (
        request.method !== 'GET' ||
        privatePath ||
        path.startsWith('/assets/') ||
        path.startsWith('/api/') ||
        path.startsWith('/integrations/')
      )
        return reply.code(404).send({ error: 'NOT_FOUND' });
      return reply.sendFile('index.html');
    });
  }
  return app;
}
