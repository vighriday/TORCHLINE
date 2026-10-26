import type { WorldPresentation, TwitchIntegrationStatus } from '@torchline/contracts';
export interface HandoffView {
  id: string;
  source_id: string;
  target_id: string;
  status: string;
  mode: string;
  expires_at: string;
}
export interface DashboardSnapshot {
  me: { id: string; label: string; receiveOptIn: boolean } | null;
  mode: 'simulation' | 'live';
  world: WorldPresentation | null;
  worlds?: { id: string; chapter: number; outcome: string | null; parked: boolean }[];
  handoffs?: HandoffView[];
  recipients?: { id: string; label: string }[];
  integration: {
    credentialsConfigured: boolean;
    botAuthorized: boolean;
    publicHttps: boolean;
    genuineRaidVerified: boolean;
    details?: TwitchIntegrationStatus;
  };
}
export async function request<T = unknown>(
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined
        ? {}
        : { 'Content-Type': 'application/json', 'X-Torchline-Request': '1' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? 'The request did not complete.');
  return result as T;
}
