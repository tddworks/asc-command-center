import { describe, it, expect, vi } from 'vitest';
import { InstalledPlugin } from '../../../src/extensibility/plugin/InstalledPlugin.ts';
import { InstalledPlugins } from '../../../src/extensibility/plugin/InstalledPlugins.ts';
import type { InstalledPluginRepository } from '../../../src/extensibility/plugin/InstalledPluginRepository.ts';

function stubRepo(overrides: Partial<InstalledPluginRepository> = {}): InstalledPluginRepository {
  return { list: vi.fn().mockResolvedValue([]), ...overrides };
}

describe('InstalledPlugins', () => {

  it('starts empty / unloaded', () => {
    const a = new InstalledPlugins(stubRepo());
    expect(a.plugins).toEqual([]);
    expect(a.loaded).toBe(false);
    expect(a.error).toBeNull();
    expect(a.hasPlugins).toBe(false);
    expect(a.count).toBe(0);
  });

  it('refresh populates plugins and flips loaded', async () => {
    const ascPro = new InstalledPlugin({ slug: 'ASCPro', name: 'ASC Pro', ui: [] });
    const studio = new InstalledPlugin({ slug: 'ScreenshotStudio', name: 'Screenshot Studio', ui: [] });
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([ascPro, studio]) });
    const a = new InstalledPlugins(repo);

    await a.refresh();

    expect(a.plugins).toEqual([ascPro, studio]);
    expect(a.count).toBe(2);
    expect(a.loaded).toBe(true);
    expect(a.isLoading).toBe(false);
  });

  it('refresh surfaces errors on the aggregate', async () => {
    const failure = new Error('boom');
    const repo = stubRepo({ list: vi.fn().mockRejectedValue(failure) });
    const a = new InstalledPlugins(repo);

    await a.refresh();

    expect(a.error).toBe(failure);
    expect(a.loaded).toBe(true);
    expect(a.isLoading).toBe(false);
  });

  it('bySlug finds a loaded plugin', async () => {
    const p = new InstalledPlugin({ slug: 'ASCPro', name: 'ASC Pro', ui: [] });
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([p]) });
    const a = new InstalledPlugins(repo);
    await a.refresh();

    expect(a.bySlug('ASCPro')).toBe(p);
    expect(a.bySlug('Missing')).toBeUndefined();
  });

  it('switchRepository resets state and re-probes', async () => {
    const oldList = vi.fn().mockResolvedValue([
      new InstalledPlugin({ slug: 'old', name: 'Old', ui: [] }),
    ]);
    const newList = vi.fn().mockResolvedValue([
      new InstalledPlugin({ slug: 'new', name: 'New', ui: [] }),
    ]);
    const a = new InstalledPlugins({ list: oldList });
    await a.refresh();
    expect(a.plugins.map((p) => p.slug)).toEqual(['old']);

    a.switchRepository({ list: newList });
    // switchRepository fires a refresh — wait one microtask flush.
    await Promise.resolve();
    await Promise.resolve();

    expect(newList).toHaveBeenCalled();
  });
});
