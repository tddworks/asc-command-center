import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bootstrapPlugins } from '../../../src/extensibility/plugin/PluginBootstrap.tsx';
import type { PluginAPI } from '../../../src/extensibility/plugin/PluginAPI.ts';
import type { PluginModule } from '../../../src/extensibility/plugin/Plugin.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fakeApi(): PluginAPI {
  return {
    version: '1.0.0',
    register: vi.fn(),
    host: {} as never,
  };
}

describe('bootstrapPlugins', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('skips quietly when the manifest endpoint is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    const api = fakeApi();

    const handles = await bootstrapPlugins({ api });

    expect(handles).toEqual([]);
    expect(api.register).not.toHaveBeenCalled();
  });

  it('activates every plugin listed in the manifest', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      plugins: [
        { name: 'asc-pro', slug: 'asc-pro', ui: ['ui/foo.js', 'ui/bar.html'], apiVersion: '1.0.0' },
      ],
    }));

    const activate = vi.fn();
    const mod: PluginModule = { activate };
    const resolveModule = vi.fn().mockResolvedValue(mod);

    const api = fakeApi();
    await bootstrapPlugins({ api, resolveModule });

    // Only the .js file is resolved — .html entries are static assets.
    expect(resolveModule).toHaveBeenCalledTimes(1);
    expect(resolveModule).toHaveBeenCalledWith('/api/plugins/asc-pro/ui/foo.js');
    expect(activate).toHaveBeenCalledWith(api);
  });

  it('returns deactivate handles from each activate call', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      plugins: [{ name: 'p1', slug: 'p1', ui: ['ui/a.js'] }],
    }));
    const deactivate = vi.fn();
    const resolveModule = vi.fn().mockResolvedValue({
      activate: () => ({ deactivate }),
    } satisfies PluginModule);

    const handles = await bootstrapPlugins({ api: fakeApi(), resolveModule });

    expect(handles).toHaveLength(1);
    handles[0].deactivate!();
    expect(deactivate).toHaveBeenCalled();
  });

  it('isolates failures: one bad plugin does not break the rest', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      plugins: [
        { name: 'broken', slug: 'broken', ui: ['ui/x.js'] },
        { name: 'good',   slug: 'good',   ui: ['ui/y.js'] },
      ],
    }));
    const goodActivate = vi.fn();
    const resolveModule = vi.fn().mockImplementation((url: string) => {
      if (url.includes('broken')) return Promise.reject(new Error('syntax error'));
      return Promise.resolve({ activate: goodActivate } satisfies PluginModule);
    });

    await bootstrapPlugins({ api: fakeApi(), resolveModule });

    expect(goodActivate).toHaveBeenCalled();
  });

  it('skips plugins with an incompatible apiVersion major', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      plugins: [{ name: 'future', slug: 'future', ui: ['ui/z.js'], apiVersion: '2.0.0' }],
    }));
    const resolveModule = vi.fn();

    await bootstrapPlugins({ api: fakeApi(), resolveModule });

    expect(resolveModule).not.toHaveBeenCalled();
  });
});
