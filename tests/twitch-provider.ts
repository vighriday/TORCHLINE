import { createHmac, randomUUID } from 'node:crypto';
import { BOT_SCOPES, CREATOR_SCOPES } from '@torchline/twitch';
import type { Fetcher } from '@torchline/twitch';
import type { AppConfig } from '../apps/server/src/app.ts';
import type { createApp } from '../apps/server/src/app.ts';

export const liveConfig: AppConfig = {
  mode: 'live',
  baseUrl: 'https://torchline.fixture.invalid',
  sessionSecret: 'ab'.repeat(32),
  tokenKey: 'cd'.repeat(32),
  botSetupSecret: 'operator-fixture',
  eventsubSecret: 'eventsub-fixture-secret-adequate-length',
  twitchClientId: 'client-fixture',
  twitchClientSecret: 'secret-fixture',
};
export const browserHeader = { 'x-torchline-request': '1', origin: liveConfig.baseUrl };
export interface ProviderSubscription {
  id: string;
  type: string;
  version: string;
  status: string;
  condition: Record<string, string>;
  transport: { method: string; callback: string };
}
type App = Awaited<ReturnType<typeof createApp>>;
export function providerFixture(config = liveConfig) {
  const subscriptions: ProviderSubscription[] = [];
  const deleted: string[] = [];
  const streams = ['42', '43'];
  const calls: string[] = [];
  let app: App;
  let pageSize = 100;
  let beforeReturn: (sub: ProviderSubscription) => Promise<void> = async () => {};
  const deliver = async (
    sub: ProviderSubscription,
    event: unknown,
    id: string = randomUUID(),
    kind = 'notification',
    timestamp = new Date().toISOString(),
  ) => {
    const body =
      kind === 'webhook_callback_verification'
        ? { subscription: sub, challenge: 'fixture-challenge' }
        : kind === 'revocation'
          ? { subscription: sub }
          : { subscription: sub, event };
    const raw = Buffer.from(JSON.stringify(body));
    return app.inject({
      method: 'POST',
      url: '/integrations/twitch/eventsub',
      payload: raw,
      headers: {
        'content-type': 'application/json',
        'twitch-eventsub-message-id': id,
        'twitch-eventsub-message-timestamp': timestamp,
        'twitch-eventsub-message-type': kind,
        'twitch-eventsub-message-signature':
          'sha256=' +
          createHmac('sha256', config.eventsubSecret!)
            .update(id + timestamp)
            .update(raw)
            .digest('hex'),
      },
    });
  };
  const fetcher: Fetcher = async (input, init) => {
    const url = new URL(String(input));
    calls.push(`${init?.method ?? 'GET'} ${url.pathname}`);
    if (url.pathname === '/oauth2/token') {
      const body = new URLSearchParams(String(init?.body));
      const code = body.get('code') ?? 'app';
      return Response.json({
        access_token: code,
        refresh_token: `refresh-${code}`,
        expires_in: 3600,
      });
    }
    if (url.pathname === '/oauth2/validate') {
      const id = (init?.headers as Record<string, string>).Authorization.split(' ')[1];
      return Response.json({
        client_id: config.twitchClientId,
        user_id: id,
        login: `fixture_${id}`,
        scopes: ['99', '100'].includes(id) ? BOT_SCOPES : CREATOR_SCOPES,
        expires_in: 3600,
      });
    }
    if (url.pathname === '/helix/streams')
      return Response.json({
        data: streams
          .filter((id) => url.searchParams.getAll('user_id').includes(id))
          .map((user_id) => ({ user_id })),
      });
    if (url.pathname === '/helix/eventsub/subscriptions') {
      if (init?.method === 'DELETE') {
        const id = url.searchParams.get('id')!;
        deleted.push(id);
        const index = subscriptions.findIndex((sub) => sub.id === id);
        if (index >= 0) subscriptions.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        const sub: ProviderSubscription = {
          id: randomUUID(),
          type: body.type,
          version: body.version,
          status: 'webhook_callback_verification_pending',
          condition: body.condition,
          transport: { method: body.transport.method, callback: body.transport.callback },
        };
        subscriptions.push(sub);
        const challenge = await deliver(
          sub,
          undefined,
          randomUUID(),
          'webhook_callback_verification',
        );
        if (challenge.statusCode !== 200)
          throw new Error(`Fixture callback refused challenge: ${challenge.statusCode}`);
        sub.status = 'enabled';
        await beforeReturn(sub);
        return Response.json(
          { data: [{ ...sub, status: 'webhook_callback_verification_pending' }] },
          { status: 202 },
        );
      }
      const offset = Number(url.searchParams.get('after') ?? 0);
      const data = subscriptions.slice(offset, offset + pageSize);
      return Response.json({
        data,
        pagination:
          offset + pageSize < subscriptions.length ? { cursor: String(offset + pageSize) } : {},
      });
    }
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  };
  return {
    fetcher,
    subscriptions,
    deleted,
    streams,
    calls,
    deliver,
    attach: (value: App) => {
      app = value;
    },
    setPageSize: (value: number) => {
      pageSize = value;
    },
    beforeReturn: (fn: typeof beforeReturn) => {
      beforeReturn = fn;
    },
  };
}
export async function authorize(app: App, id: string, bot = false, config = liveConfig) {
  const started = bot
    ? await app.inject({
        method: 'POST',
        url: '/api/operator/bot-authorization',
        payload: {},
        headers: { ...browserHeader, authorization: `Bearer ${config.botSetupSecret}` },
      })
    : await app.inject('/auth/twitch');
  const location = bot ? started.json().url : started.headers.location!;
  const state = new URL(location).searchParams.get('state')!;
  const response = await app.inject({
    url: `/auth/twitch/callback?code=${id}&state=${state}`,
    headers: {
      cookie: `torchline_oauth=${started.cookies.find((c) => c.name === 'torchline_oauth')!.value}`,
    },
  });
  return {
    response,
    headers: {
      ...browserHeader,
      cookie: `torchline_session=${response.cookies.find((c) => c.name === 'torchline_session')?.value ?? ''}`,
    },
  };
}
export const tick = (app: App) => (app as unknown as { tick: () => Promise<void> }).tick();
