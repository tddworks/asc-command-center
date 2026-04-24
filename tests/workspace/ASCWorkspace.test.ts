import { describe, it, expect, vi } from 'vitest';
import { App, type AppInit } from '../../src/app-catalog/app/App.ts';
import { Apps } from '../../src/app-catalog/app/Apps.ts';
import { Version, VersionState } from '../../src/release/version/Version.ts';
import type { AppRepository } from '../../src/app-catalog/app/AppRepository.ts';
import { ASCWorkspace } from '../../src/workspace/ASCWorkspace.ts';
import { InMemoryWorkspaceStore } from '../../src/workspace/infrastructure/Memory.store.ts';

function appInit(o: Partial<AppInit> = {}): AppInit {
  return {
    id: 'a-1',
    name: 'WeatherApp',
    bundleId: 'com.example.weather',
    sku: 'SKU001',
    primaryLocale: 'en-US',
    isAvailableInNewTerritories: true,
    affordances: { getVersions: '/api/v1/apps/a-1/versions' },
    ...o,
  };
}

function makeRepo(apps: App[], versionsByApp: Record<string, Version[]> = {}): AppRepository {
  const repo: AppRepository = {
    list: vi.fn().mockResolvedValue(apps),
    get: vi.fn(async (id: string) => {
      const found = apps.find((a) => a.id === id);
      if (!found) throw new Error(`App ${id} not found`);
      return found;
    }),
    builds: vi.fn().mockResolvedValue([]),
    versions: vi.fn(async (app: App) => versionsByApp[app.id] ?? []),
    createVersion: vi.fn(),
  };
  apps.forEach((a) => a.setRepository(repo));
  return repo;
}

describe('ASCWorkspace', () => {

  it('hydrate loads all apps and selects the first by default', async () => {
    const a1 = new App(appInit({ id: 'a-1' }));
    const a2 = new App(appInit({ id: 'a-2', name: 'Other', bundleId: 'com.x' }));
    const repo = makeRepo([a1, a2]);
    const ws = new ASCWorkspace(new Apps(repo), new InMemoryWorkspaceStore());

    await ws.hydrate();

    expect(ws.apps).toEqual([a1, a2]);
    expect(ws.currentApp).toBe(a1);
    expect(ws.hydrated).toBe(true);
  });

  it('hydrate restores the pinned app from the store', async () => {
    const a1 = new App(appInit({ id: 'a-1' }));
    const a2 = new App(appInit({ id: 'a-2', name: 'Other', bundleId: 'com.x' }));
    makeRepo([a1, a2]);
    const store = new InMemoryWorkspaceStore({ appId: 'a-2' });
    const ws = new ASCWorkspace(new Apps(a1.repository!), store);

    await ws.hydrate();

    expect(ws.currentApp).toBe(a2);
  });

  it('hydrate loads versions for the focused app and restores the pinned version', async () => {
    const v1 = new Version('v-1', 'a-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    const v2 = new Version('v-2', 'a-1', '2.0', VersionState.PrepareForSubmission, 'IOS', {});
    const app = new App(appInit({ id: 'a-1' }));
    makeRepo([app], { 'a-1': [v1, v2] });
    const ws = new ASCWorkspace(
      new Apps(app.repository!),
      new InMemoryWorkspaceStore({ appId: 'a-1', versionId: 'v-2' }),
    );

    await ws.hydrate();

    expect(ws.currentApp?.versions).toEqual([v1, v2]);
    expect(ws.currentApp?.selectedVersion).toBe(v2);
  });

  it('hydrate falls back to default version when pinned version no longer exists', async () => {
    const v1 = new Version('v-1', 'a-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    const app = new App(appInit({ id: 'a-1' }));
    makeRepo([app], { 'a-1': [v1] });
    const ws = new ASCWorkspace(
      new Apps(app.repository!),
      new InMemoryWorkspaceStore({ appId: 'a-1', versionId: 'v-stale' }),
    );

    await ws.hydrate();

    expect(ws.currentApp?.selectedVersion).toBe(v1);
  });

  it('hydrate handles empty apps list', async () => {
    const repo = makeRepo([]);
    const ws = new ASCWorkspace(new Apps(repo), new InMemoryWorkspaceStore());

    await ws.hydrate();

    expect(ws.apps).toEqual([]);
    expect(ws.currentApp).toBeNull();
    expect(ws.hydrated).toBe(true);
  });

  it('hydrate persists the resolved pin to the store', async () => {
    const v1 = new Version('v-1', 'a-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    const app = new App(appInit({ id: 'a-1' }));
    makeRepo([app], { 'a-1': [v1] });
    const store = new InMemoryWorkspaceStore();
    const ws = new ASCWorkspace(new Apps(app.repository!), store);

    await ws.hydrate();

    expect(store.read()).toEqual({ appId: 'a-1', versionId: 'v-1' });
  });

  // ── selectApp ──

  it('selectApp switches currentApp and loads its versions', async () => {
    const v1 = new Version('v-a', 'a-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    const v2 = new Version('v-b', 'a-2', '1.0', VersionState.ReadyForSale, 'IOS', {});
    const a1 = new App(appInit({ id: 'a-1' }));
    const a2 = new App(appInit({ id: 'a-2', name: 'Other', bundleId: 'com.x' }));
    makeRepo([a1, a2], { 'a-1': [v1], 'a-2': [v2] });
    const ws = new ASCWorkspace(new Apps(a1.repository!), new InMemoryWorkspaceStore());
    await ws.hydrate();

    await ws.selectApp('a-2');

    expect(ws.currentApp).toBe(a2);
    expect(a2.versions).toEqual([v2]);
  });

  it('selectApp throws on unknown id', async () => {
    const a1 = new App(appInit({ id: 'a-1' }));
    makeRepo([a1]);
    const ws = new ASCWorkspace(new Apps(a1.repository!), new InMemoryWorkspaceStore());
    await ws.hydrate();

    await expect(ws.selectApp('a-missing')).rejects.toThrow(/Unknown app/);
  });

  it('selectApp persists the new pin', async () => {
    const v = new Version('v-b', 'a-2', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    const a1 = new App(appInit({ id: 'a-1' }));
    const a2 = new App(appInit({ id: 'a-2', name: 'Other', bundleId: 'com.x' }));
    makeRepo([a1, a2], { 'a-2': [v] });
    const store = new InMemoryWorkspaceStore();
    const ws = new ASCWorkspace(new Apps(a1.repository!), store);
    await ws.hydrate();

    await ws.selectApp('a-2');

    expect(store.read()).toEqual({ appId: 'a-2', versionId: 'v-b' });
  });

  // ── selectVersion ──

  it('selectVersion pins a different version on the current app', async () => {
    const v1 = new Version('v-1', 'a-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    const v2 = new Version('v-2', 'a-1', '2.0', VersionState.ReadyForSale, 'IOS', {});
    const app = new App(appInit({ id: 'a-1' }));
    makeRepo([app], { 'a-1': [v1, v2] });
    const store = new InMemoryWorkspaceStore();
    const ws = new ASCWorkspace(new Apps(app.repository!), store);
    await ws.hydrate();

    ws.selectVersion('v-2');

    expect(ws.currentApp?.selectedVersion).toBe(v2);
    expect(store.read()).toEqual({ appId: 'a-1', versionId: 'v-2' });
  });

  it('selectVersion throws when no app is selected', async () => {
    const repo = makeRepo([]);
    const ws = new ASCWorkspace(new Apps(repo), new InMemoryWorkspaceStore());
    await ws.hydrate();

    expect(() => ws.selectVersion('v-1')).toThrow(/No app is currently selected/);
  });
});
