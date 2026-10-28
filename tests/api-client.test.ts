import { afterEach, expect, it, vi } from 'vitest';
import { ConnectionError, request } from '../apps/web/src/api.ts';

afterEach(() => vi.unstubAllGlobals());

it('requests JSON through the documented ngrok preview header without changing operator or mutation authority', async () => {
  vi.stubGlobal('location', { hostname: 'preview.ngrok-free.dev' });
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ pending: null }));
  vi.stubGlobal('fetch', fetcher);
  await request(
    '/api/operator/bot-authorization',
    {},
    { Authorization: 'Bearer fixture-operator' },
  );
  const init = fetcher.mock.calls[0]![1] as RequestInit;
  expect(init.headers).toMatchObject({
    Accept: 'application/json',
    'ngrok-skip-browser-warning': '1',
    'X-Torchline-Request': '1',
    Authorization: 'Bearer fixture-operator',
  });
  expect(init.redirect).toBe('error');
  expect(init.method).toBe('POST');
});

it('keeps the preview-specific header out of ordinary hosting', async () => {
  vi.stubGlobal('location', { hostname: 'torchline.example' });
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetcher);
  expect(await request('/api/state')).toEqual({ ok: true });
  expect(fetcher.mock.calls[0]![1]!.headers).not.toHaveProperty('ngrok-skip-browser-warning');
});

it.each([
  ['text/html', '<!DOCTYPE html><p>private upstream detail</p>'],
  ['application/json', '{"message":"private upstream detail"'],
  ['application/json', 'null'],
])(
  'handles an unexpected %s response without exposing parser or upstream content',
  async (type, body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { headers: { 'content-type': type } })),
    );
    const error = await request('/api/state').catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ConnectionError);
    expect((error as Error).message).not.toMatch(
      /DOCTYPE|SyntaxError|private upstream|Unexpected token/,
    );
    expect((error as Error).message).toMatch(/retry the connection/i);
  },
);

it('preserves genuine authorization errors and never retries an uncertain mutation', async () => {
  const fetcher = vi.fn(async () =>
    Response.json({ message: 'Creator authorization required.' }, { status: 401 }),
  );
  vi.stubGlobal('fetch', fetcher);
  await expect(request('/api/worlds', {})).rejects.toThrow('Creator authorization required.');
  fetcher.mockRejectedValue(new Error('private network failure'));
  await expect(request('/api/worlds', {})).rejects.toThrow(
    'Reconnect to check your latest saved state.',
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});
