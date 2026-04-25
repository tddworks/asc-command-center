import { describe, it, expect, vi } from 'vitest';
import { InstalledPlugin } from '../../../src/extensibility/plugin/InstalledPlugin.ts';
import { InstalledPlugins } from '../../../src/extensibility/plugin/InstalledPlugins.ts';
import type { InstalledPluginRepository } from '../../../src/extensibility/plugin/InstalledPluginRepository.ts';

function stubRepo(overrides: Partial<InstalledPluginRepository> = {}): InstalledPluginRepository {
  return {
    installed: vi.fn().mockResolvedValue([]),
    market: vi.fn().mockResolvedValue([]),
    install: vi.fn().mockResolvedValue(undefined),
    uninstall: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('InstalledPlugins', () => {

  it('starts empty / unloaded', () => {
    const a = new InstalledPlugins(stubRepo());
    expect(a.installed).toEqual([]);
    expect(a.marketplace).toEqual([]);
    expect(a.loaded).toBe(false);
    expect(a.error).toBeNull();
    expect(a.installedCount).toBe(0);
    expect(a.marketplaceCount).toBe(0);
    expect(a.busy).toBeNull();
  });

  it('refreshAll populates installed + marketplace in parallel', async () => {
    const installed = [new InstalledPlugin({ slug: 'ASCPro', name: 'ASC Pro', isInstalled: true })];
    const market = [
      new InstalledPlugin({ slug: 'ASCPro', name: 'ASC Pro', isInstalled: true }),
      new InstalledPlugin({ slug: 'discord-notify', name: 'Discord Notify' }),
    ];
    const repo = stubRepo({
      installed: vi.fn().mockResolvedValue(installed),
      market: vi.fn().mockResolvedValue(market),
    });
    const a = new InstalledPlugins(repo);

    await a.refreshAll();

    expect(a.installed).toEqual(installed);
    expect(a.marketplace).toEqual(market);
    expect(a.installedCount).toBe(1);
    expect(a.marketplaceCount).toBe(2);
    expect(a.loaded).toBe(true);
  });

  it('refreshAll tolerates a marketplace failure without poisoning the installed list', async () => {
    const repo = stubRepo({
      installed: vi.fn().mockResolvedValue([
        new InstalledPlugin({ slug: 'ASCPro', name: 'ASC Pro' }),
      ]),
      market: vi.fn().mockRejectedValue(new Error('offline')),
    });
    const a = new InstalledPlugins(repo);

    await a.refreshAll();

    expect(a.installedCount).toBe(1);
    expect(a.marketplace).toEqual([]);
    expect(a.error).toBeNull();
  });

  it('refreshAll surfaces installed-list errors on the aggregate', async () => {
    const failure = new Error('boom');
    const repo = stubRepo({ installed: vi.fn().mockRejectedValue(failure) });
    const a = new InstalledPlugins(repo);

    await a.refreshAll();

    expect(a.error).toBe(failure);
    expect(a.loaded).toBe(true);
  });

  it('install delegates to repository.install and refreshes', async () => {
    const before = [new InstalledPlugin({ slug: 'ASCPro', name: 'ASC Pro' })];
    const after = [
      new InstalledPlugin({ slug: 'ASCPro', name: 'ASC Pro' }),
      new InstalledPlugin({ slug: 'discord-notify', name: 'Discord Notify' }),
    ];
    const installed = vi.fn()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    const repo = stubRepo({ installed });
    const a = new InstalledPlugins(repo);
    await a.refreshAll();

    await a.install('discord-notify');

    expect(repo.install).toHaveBeenCalledWith('discord-notify');
    expect(a.installedCount).toBe(2);
    expect(a.busy).toBeNull();
  });

  it('uninstall delegates to repository.uninstall and refreshes', async () => {
    const before = [
      new InstalledPlugin({ slug: 'ASCPro', name: 'ASC Pro' }),
      new InstalledPlugin({ slug: 'discord-notify', name: 'Discord Notify' }),
    ];
    const after = [new InstalledPlugin({ slug: 'ASCPro', name: 'ASC Pro' })];
    const installed = vi.fn()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    const repo = stubRepo({ installed });
    const a = new InstalledPlugins(repo);
    await a.refreshAll();

    await a.uninstall('discord-notify');

    expect(repo.uninstall).toHaveBeenCalledWith('discord-notify');
    expect(a.installedCount).toBe(1);
  });

  it('install clears the busy flag even if the repo throws', async () => {
    const repo = stubRepo({ install: vi.fn().mockRejectedValue(new Error('nope')) });
    const a = new InstalledPlugins(repo);

    await expect(a.install('x')).rejects.toThrow('nope');
    expect(a.busy).toBeNull();
  });

  it('installedBySlug finds a loaded installed plugin', async () => {
    const p = new InstalledPlugin({ slug: 'ASCPro', name: 'ASC Pro', isInstalled: true });
    const repo = stubRepo({ installed: vi.fn().mockResolvedValue([p]) });
    const a = new InstalledPlugins(repo);
    await a.refreshAll();

    expect(a.installedBySlug('ASCPro')).toBe(p);
    expect(a.installedBySlug('missing')).toBeUndefined();
  });
});
