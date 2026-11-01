import type { WorldPresentation, TwitchIntegrationStatus } from '@torchline/contracts';
export interface HandoffView {
  id: string;
  world_id?: string;
  source_label?: string | null;
  target_label?: string | null;
  source_id: string;
  target_id: string;
  status: string;
  mode: string;
  expires_at: string;
}
export interface DashboardSnapshot {
  me: { id: string; label: string; receiveOptIn: boolean } | null;
  mode: 'simulation' | 'live';
  channelEpoch?: string;
  world: WorldPresentation | null;
  worlds?: { id: string; chapter: number; outcome: string | null; parked: boolean }[];
  handoffs?: HandoffView[];
  recipients?: { id: string; label: string; busy?: boolean }[];
  integration: {
    credentialsConfigured: boolean;
    botAuthorized: boolean;
    botRepliesEnabled?: boolean;
    publicHttps: boolean;
    genuineRaidVerified: boolean;
    details?: TwitchIntegrationStatus;
  };
}
export interface BotSetupPreview {
  accountLabel: string;
  expiresAt: string;
}
export class ConnectionError extends Error {}
export class HttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function request<T = unknown>(
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
  timeoutMs = 15000,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: 'application/json',
        ...(typeof location !== 'undefined' && /\.ngrok-free\.(app|dev)$/.test(location.hostname)
          ? { 'ngrok-skip-browser-warning': '1' }
          : {}),
        ...(body === undefined
          ? {}
          : { 'Content-Type': 'application/json', 'X-Torchline-Request': '1' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ConnectionError(
      'Connection interrupted. Reconnect to check your latest saved state.',
    );
  }
  if (
    !/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(
      response.headers.get('content-type') ?? '',
    )
  )
    throw new ConnectionError('TORCHLINE could not reach its server. Please retry the connection.');
  let result;
  try {
    result = await response.json();
  } catch {
    throw new ConnectionError('The connection was interrupted. Please retry the connection.');
  }
  if (result === null || typeof result !== 'object')
    throw new ConnectionError('TORCHLINE could not reach its server. Please retry the connection.');
  if (!response.ok)
    throw new HttpError(
      typeof result.message === 'string' ? result.message : 'The request did not complete.',
      response.status,
    );
  return result as T;
}
