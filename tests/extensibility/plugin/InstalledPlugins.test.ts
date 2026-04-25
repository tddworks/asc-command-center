import { describe, it, expect, vi } from 'vitest';
import { InstalledPlugin } from '../../../src/extensibility/plugin/InstalledPlugin.ts';
import { InstalledPlugins } from '../../../src/extensibility/plugin/InstalledPlugins.ts';
import { PluginUpdate } from '../../../src/extensibility/plugin/PluginUpdate.ts';
import type { InstalledPluginRepository } from '../../../src/extensibility/plugin/InstalledPluginRepository.ts';

function stubRepo(overrides: Partial<InstalledPluginRepository> = {}): InstalledPluginRepository {
  return {
    installed: vi.fn().mockResolvedValue([]),
    market: vi.fn().mockResolvedValue([]),
    updates: vi.fn().mockResolvedValue([]),
    install: vi.fn().mockResolvedValue(undefined),
    uninstall: vi.fn().mockResolvedValue(undefined),
    applyUpdate: vi.fn().mockResolvedValue(undefined),
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

  it('install delegates to repository.install with the plugin entity and refreshes', async () => {
    const target = new InstalledPlugin({ slug: 'discord-notify', name: 'Discord Notify' });
    const before = [new InstalledPlugin({ slug: 'ASCPro', name: 'ASC Pro' })];
    const after = [
      new InstalledPlugin({ slug: 'ASCPro', name: 'ASC Pro' }),
      target,
    ];
    const installed = vi.fn()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    const repo = stubRepo({ installed });
    const a = new InstalledPlugins(repo);
    await a.refreshAll();

    await a.install(target);

    expect(repo.install).toHaveBeenCalledWith(target);
    expect(a.installedCount).toBe(2);
    expect(a.busy).toBeNull();
  });

  it('uninstall delegates to repository.uninstall with the plugin entity and refreshes', async () => {
    const ascPro = new InstalledPlugin({ slug: 'ASCPro', name: 'ASC Pro' });
    const discord = new InstalledPlugin({ slug: 'discord-notify', name: 'Discord Notify' });
    const before = [ascPro, discord];
    const after = [ascPro];
    const installed = vi.fn()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    const repo = stubRepo({ installed });
    const a = new InstalledPlugins(repo);
    await a.refreshAll();

    await a.uninstall(discord);

    expect(repo.uninstall).toHaveBeenCalledWith(discord);
    expect(a.installedCount).toBe(1);
  });

  it('uninstall resolves to the installed counterpart when given a marketplace entry with a different slug', async () => {
    // Backend ships a marketplace entry with kebab-case slug and an
    // installed entry with PascalCase slug. The page might call
    // `uninstall(marketEntry)` from the marketplace tab — the aggregate
    // must rewrite to the installed entity so the DELETE URL matches.
    const installedHello = new InstalledPlugin({
      slug: 'HelloPlugin', id: 'HelloPlugin', name: 'Hello Plugin',
    });
    const marketHello = new InstalledPlugin({
      slug: 'hello-plugin', id: 'HelloPlugin', name: 'Hello Plugin',
    });
    const installed = vi.fn().mockResolvedValue([installedHello]);
    const repo = stubRepo({ installed });
    const a = new InstalledPlugins(repo);
    await a.refreshAll();

    await a.uninstall(marketHello);

    expect(repo.uninstall).toHaveBeenCalledWith(installedHello);
  });

  it('uninstall optimistically removes the row before the backend confirms', async () => {
    const target = new InstalledPlugin({ slug: 'discord-notify', name: 'Discord Notify' });
    let resolveUninstall!: () => void;
    const uninstall = vi.fn().mockImplementation(() => new Promise<void>((r) => { resolveUninstall = r; }));
    const installed = vi.fn().mockResolvedValueOnce([target]).mockResolvedValueOnce([]);
    const repo = stubRepo({ installed, uninstall });
    const a = new InstalledPlugins(repo);
    await a.refreshAll();
    expect(a.installedCount).toBe(1);

    const promise = a.uninstall(target);
    // Microtask flush — the optimistic remove should have run by now,
    // before the repository's promise resolves.
    await Promise.resolve();
    expect(a.installedCount).toBe(0);

    resolveUninstall();
    await promise;
  });

  it('install clears the busy flag even if the repo throws', async () => {
    const repo = stubRepo({ install: vi.fn().mockRejectedValue(new Error('nope')) });
    const a = new InstalledPlugins(repo);
    const p = new InstalledPlugin({ slug: 'x', name: 'X' });

    await expect(a.install(p)).rejects.toThrow('nope');
    expect(a.busy).toBeNull();
  });

  it('searchMarket forwards the query to the repository and stores the result', async () => {
    const matches = [new InstalledPlugin({ slug: 'discord-notify', name: 'Discord Notify' })];
    const market = vi.fn().mockResolvedValue(matches);
    const repo = stubRepo({ market });
    const a = new InstalledPlugins(repo);

    await a.searchMarket('discord');

    expect(market).toHaveBeenCalledWith('discord');
    expect(a.marketQuery).toBe('discord');
    expect(a.marketplace).toEqual(matches);
  });

  it('searchMarket with an empty string passes undefined so the backend returns the unfiltered list', async () => {
    const market = vi.fn().mockResolvedValue([]);
    const repo = stubRepo({ market });
    const a = new InstalledPlugins(repo);

    await a.searchMarket('');

    expect(market).toHaveBeenCalledWith(undefined);
    expect(a.marketQuery).toBe('');
  });

  it('refreshAll preserves the active marketQuery so the user filter survives a refresh', async () => {
    const market = vi.fn().mockResolvedValue([]);
    const repo = stubRepo({ market });
    const a = new InstalledPlugins(repo);
    a.marketQuery = 'notify';

    await a.refreshAll();

    expect(market).toHaveBeenCalledWith('notify');
  });

  // ── Updates ──

  it('refreshAll loads outdated entries in parallel with the other lists', async () => {
    const update = new PluginUpdate({
      name: 'ASC Pro',
      installedVersion: '0.9.0',
      latestVersion: '1.0.0',
    });
    const repo = stubRepo({ updates: vi.fn().mockResolvedValue([update]) });
    const a = new InstalledPlugins(repo);

    await a.refreshAll();

    expect(a.updatesCount).toBe(1);
    expect(a.hasUpdates).toBe(true);
    expect(a.updates[0]).toBe(update);
  });

  it('refreshAll tolerates an updates failure without poisoning the installed list', async () => {
    const repo = stubRepo({
      installed: vi.fn().mockResolvedValue([new InstalledPlugin({ slug: 'ASCPro', name: 'ASC Pro' })]),
      updates: vi.fn().mockRejectedValue(new Error('offline')),
    });
    const a = new InstalledPlugins(repo);

    await a.refreshAll();

    expect(a.installedCount).toBe(1);
    expect(a.updates).toEqual([]);
    expect(a.error).toBeNull();
  });

  it('updateFor matches by name, slug, or id', async () => {
    const update = new PluginUpdate({
      name: 'ASC Pro',
      installedVersion: '0.9.0',
      latestVersion: '1.0.0',
    });
    const ascPro = new InstalledPlugin({ slug: 'ASCPro', id: 'ASCPro', name: 'ASC Pro' });
    const repo = stubRepo({
      installed: vi.fn().mockResolvedValue([ascPro]),
      updates: vi.fn().mockResolvedValue([update]),
    });
    const a = new InstalledPlugins(repo);
    await a.refreshAll();

    expect(a.updateFor(ascPro)).toBe(update);
  });

  it('updateFor returns undefined when the installed plugin is up-to-date', async () => {
    const ascPro = new InstalledPlugin({ slug: 'ASCPro', id: 'ASCPro', name: 'ASC Pro' });
    const repo = stubRepo({ installed: vi.fn().mockResolvedValue([ascPro]) });
    const a = new InstalledPlugins(repo);
    await a.refreshAll();

    expect(a.updateFor(ascPro)).toBeUndefined();
  });

  it('applyUpdate delegates to repository.applyUpdate and refreshes', async () => {
    const update = new PluginUpdate({
      name: 'ASC Pro',
      installedVersion: '0.9.0',
      latestVersion: '1.0.0',
    });
    const updates = vi.fn()
      .mockResolvedValueOnce([update])  // initial
      .mockResolvedValueOnce([]);       // after applying
    const repo = stubRepo({ updates });
    const a = new InstalledPlugins(repo);
    await a.refreshAll();
    expect(a.updatesCount).toBe(1);

    await a.applyUpdate(update);

    expect(repo.applyUpdate).toHaveBeenCalledWith(update);
    expect(a.updatesCount).toBe(0);
    expect(a.busy).toBeNull();
  });

  it('applyUpdate clears busy even when the repo throws', async () => {
    const update = new PluginUpdate({ name: 'X', installedVersion: '1.0', latestVersion: '2.0' });
    const repo = stubRepo({ applyUpdate: vi.fn().mockRejectedValue(new Error('boom')) });
    const a = new InstalledPlugins(repo);

    await expect(a.applyUpdate(update)).rejects.toThrow('boom');
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
