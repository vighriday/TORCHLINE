import { it, expect } from 'vitest';
import { listProviderSubscriptions } from '../apps/server/src/twitch-subscriptions.ts';
it('uses all provider pages and rejects repeated cursors rather than reporting a partial healthy set', async () => {
  const requests: string[] = [];
  const subscription = {
    id: 'second-page',
    type: 'stream.online',
    version: '1',
    status: 'enabled',
    condition: { broadcaster_user_id: 'fixture' },
    transport: { method: 'webhook', callback: 'https://fixture.example/callback' },
  };
  const fetcher: typeof fetch = async (input) => {
    requests.push(String(input));
    return Response.json(
      requests.length === 1
        ? { data: [], pagination: { cursor: 'next page' } }
        : { data: [subscription] },
    );
  };
  expect(await listProviderSubscriptions('fixture', 'fixture', fetcher)).toEqual([subscription]);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toContain('after=next%20page');
  let repeated = 0;
  const loop: typeof fetch = async () => {
    repeated++;
    return Response.json({ data: [], pagination: { cursor: 'same' } });
  };
  await expect(listProviderSubscriptions('fixture', 'fixture', loop)).rejects.toMatchObject({
    code: 'TWITCH_API_FAILED',
  });
  expect(repeated).toBe(2);
});
