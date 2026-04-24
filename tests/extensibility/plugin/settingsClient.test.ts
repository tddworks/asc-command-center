import { describe, it, expect, vi } from 'vitest';
import { createSettingsClient } from '../../../src/extensibility/plugin/settingsClient.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    /** Test-only peek at the backing store. */
    _peek: () => Object.fromEntries(map),
  };
}

describe('host.settings client', () => {
  it('load reads from asc-cli when the endpoint responds', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({ settings: { apiKey: 'abc', model: 'gpt-5' } }),
    );
    const storage = memoryStorage();
    const client = createSettingsClient({ fetch, storage, pollMs: 0 });

    const settings = await client.load('asc-pro.ai');

    expect(fetch).toHaveBeenCalledWith('/api/plugin-settings/asc-pro.ai');
    expect(settings).toEqual({ apiKey: 'abc', model: 'gpt-5' });
  });

  it('load falls back to localStorage when the endpoint is 404', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    const storage = memoryStorage();
    storage.setItem('ascpro.plugin-settings.asc-pro.ai', JSON.stringify({ apiKey: 'local' }));
    const client = createSettingsClient({ fetch, storage, pollMs: 0 });

    const settings = await client.load('asc-pro.ai');
    expect(settings).toEqual({ apiKey: 'local' });
  });

  it('load returns {} when nothing is stored anywhere', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    const client = createSettingsClient({ fetch, storage: memoryStorage(), pollMs: 0 });

    expect(await client.load('new')).toEqual({});
  });

  it('save PUTs the plaintext settings blob to asc-cli', async () => {
    let captured: RequestInit | undefined;
    const fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      captured = init;
      return Promise.resolve(new Response('', { status: 204 }));
    });
    const client = createSettingsClient({ fetch, storage: memoryStorage(), pollMs: 0 });

    await client.save('asc-pro.ai', { apiKey: 'abc', model: 'gpt-5' });

    expect(captured?.method).toBe('PUT');
    expect(JSON.parse(captured?.body as string)).toEqual({
      settings: { apiKey: 'abc', model: 'gpt-5' },
    });
  });

  it('save falls back to localStorage when the endpoint is 404', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    const storage = memoryStorage();
    const client = createSettingsClient({ fetch, storage, pollMs: 0 });

    await client.save('asc-pro.ai', { apiKey: 'only-local' });

    expect(storage._peek()).toEqual({
      'ascpro.plugin-settings.asc-pro.ai': JSON.stringify({ apiKey: 'only-local' }),
    });
  });

  it('save + load round-trips via localStorage in fallback mode', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    const client = createSettingsClient({ fetch, storage: memoryStorage(), pollMs: 0 });

    await client.save('asc-pro.ai', { apiKey: 'round-trip' });
    expect(await client.load('asc-pro.ai')).toEqual({ apiKey: 'round-trip' });
  });

  it('subscribe fires on load when the payload changes and is quiet when unchanged', async () => {
    const responses = [
      jsonResponse({ settings: { apiKey: 'a' } }),
      jsonResponse({ settings: { apiKey: 'a' } }),
      jsonResponse({ settings: { apiKey: 'b' } }),
    ];
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()!));
    const client = createSettingsClient({ fetch, storage: memoryStorage(), pollMs: 0 });

    const cb = vi.fn();
    const off = client.subscribe('asc-pro.ai', cb);

    await client.load('asc-pro.ai');           // signature = {apiKey:'a'}, first time → fire
    await client.load('asc-pro.ai');           // same signature → silent
    await client.load('asc-pro.ai');           // new signature → fire

    off();
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
