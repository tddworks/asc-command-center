import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../../src/shared/api-client.tsx';

describe('apiClient.get — in-flight dedup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shares one promise for concurrent GETs of the same URL', async () => {
    // Arrange: a fetch stub that resolves after a tick so the second call
    // lands while the first is still in flight.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });

    const [a, b] = await Promise.all([
      apiClient.get('/api/v1/dedupe-me'),
      apiClient.get('/api/v1/dedupe-me'),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it('issues a fresh request once the previous one has settled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );

    await apiClient.get('/api/v1/serial');
    await apiClient.get('/api/v1/serial');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not share promises across different URLs', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );

    await Promise.all([
      apiClient.get('/api/v1/a'),
      apiClient.get('/api/v1/b'),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not swallow errors — both callers see the failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response('boom', { status: 500 }),
    );

    await expect(
      Promise.all([
        apiClient.get('/api/v1/failing'),
        apiClient.get('/api/v1/failing'),
      ]),
    ).rejects.toThrow();
  });
});
