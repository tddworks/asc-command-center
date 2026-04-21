import { describe, it, expect, vi } from 'vitest';
import { App, type AppInit } from '../../../src/app-catalog/app/App.ts';
import { Build, BuildProcessingState } from '../../../src/release/build/Build.ts';
import { Version, VersionState } from '../../../src/release/version/Version.ts';
import type { AppRepository } from '../../../src/app-catalog/app/AppRepository.ts';

function stubRepo(overrides: Partial<AppRepository> = {}): AppRepository {
  return {
    list: vi.fn(),
    get: vi.fn(),
    builds: vi.fn(),
    versions: vi.fn(),
    ...overrides,
  };
}

function appInit(overrides: Partial<AppInit> = {}): AppInit {
  return {
    id: 'a-1',
    name: 'WeatherApp',
    bundleId: 'com.example.weather',
    sku: 'SKU001',
    primaryLocale: 'en-US',
    isAvailableInNewTerritories: true,
    affordances: {},
    ...overrides,
  };
}

describe('App', () => {

  // ── Display ──

  it('formats display name as name (bundleId)', () => {
    const app = new App(appInit());
    expect(app.displayName).toBe('WeatherApp (com.example.weather)');
  });

  it('statusLabel is em-dash when no version is selected', () => {
    const app = new App(appInit());
    expect(app.statusLabel).toBe('—');
    expect(app.statusTone).toBe('neutral');
  });

  it('statusLabel and statusTone delegate to selectedVersion', async () => {
    const version = new Version('v-1', 'a-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    const repo = stubRepo({ versions: vi.fn().mockResolvedValue([version]) });
    const app = new App(appInit({ affordances: { getVersions: '/api/v1/apps/a-1/versions' } }), repo);

    await app.loadVersions();

    expect(app.statusLabel).toBe('Preparing');
    expect(app.statusTone).toBe('info');
  });

  // ── Semantic Booleans ──

  it('has content rights when declaration is present', () => {
    const app = new App(appInit({ contentRightsDeclaration: 'USES_THIRD_PARTY_CONTENT' }));
    expect(app.hasContentRights).toBe(true);
  });

  it('does not have content rights when declaration is undefined', () => {
    const app = new App(appInit());
    expect(app.hasContentRights).toBe(false);
  });

  it('canEdit is true when selectedVersion is editable', async () => {
    const editable = new Version('v-1', 'a-1', '2.0', VersionState.PrepareForSubmission, 'IOS', {});
    const repo = stubRepo({ versions: vi.fn().mockResolvedValue([editable]) });
    const app = new App(appInit({ affordances: { getVersions: '/api/v1/apps/a-1/versions' } }), repo);

    await app.loadVersions();

    expect(app.canEdit).toBe(true);
  });

  it('canEdit is true when selectedVersion is rejected', async () => {
    const rejected = new Version('v-1', 'a-1', '2.0', VersionState.Rejected, 'IOS', {});
    const repo = stubRepo({ versions: vi.fn().mockResolvedValue([rejected]) });
    const app = new App(appInit({ affordances: { getVersions: '/api/v1/apps/a-1/versions' } }), repo);

    await app.loadVersions();

    expect(app.canEdit).toBe(true);
  });

  it('canEdit is false when no selectedVersion', () => {
    const app = new App(appInit());
    expect(app.canEdit).toBe(false);
  });

  // ── Capability Checks ──

  it('can view versions when server provides affordance', () => {
    const app = new App(appInit({ affordances: { getVersions: '/api/v1/apps/a-1/versions' } }));
    expect(app.canViewVersions).toBe(true);
  });

  it('cannot view versions when server omits affordance', () => {
    const app = new App(appInit());
    expect(app.canViewVersions).toBe(false);
  });

  it('can view builds when server provides affordance', () => {
    const app = new App(appInit({ affordances: { getBuilds: '/api/v1/apps/a-1/builds' } }));
    expect(app.canViewBuilds).toBe(true);
  });

  // ── Navigation: loadBuilds ──

  it('loadBuilds delegates to repository and returns builds', async () => {
    const expected = [
      new Build('b-1', 'a-1', '100', '2.0', BuildProcessingState.Valid, false, false, '2024-01-15', {}),
    ];
    const repo = stubRepo({ builds: vi.fn().mockResolvedValue(expected) });
    const app = new App(appInit({ affordances: { getBuilds: '/api/v1/apps/a-1/builds' } }), repo);

    await expect(app.loadBuilds()).resolves.toEqual(expected);
    expect(repo.builds).toHaveBeenCalledWith(app);
  });

  it('loadBuilds short-circuits to empty when affordance missing', async () => {
    const repo = stubRepo({ builds: vi.fn() });
    const app = new App(appInit(), repo);

    await expect(app.loadBuilds()).resolves.toEqual([]);
    expect(repo.builds).not.toHaveBeenCalled();
  });

  it('loadBuilds throws when no repository is attached', async () => {
    const app = new App(appInit({ affordances: { getBuilds: '/api/v1/apps/a-1/builds' } }));
    await expect(app.loadBuilds()).rejects.toThrow(/no repository attached/);
  });

  // ── Navigation: loadVersions ──

  it('loadVersions populates versions from repository', async () => {
    const expected = [
      new Version('v-1', 'a-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {}),
    ];
    const repo = stubRepo({ versions: vi.fn().mockResolvedValue(expected) });
    const app = new App(appInit({ affordances: { getVersions: '/api/v1/apps/a-1/versions' } }), repo);

    await app.loadVersions();

    expect(app.versions).toEqual(expected);
    expect(repo.versions).toHaveBeenCalledWith(app);
  });

  it('loadVersions short-circuits to empty when affordance missing', async () => {
    const repo = stubRepo({ versions: vi.fn() });
    const app = new App(appInit(), repo);

    await app.loadVersions();

    expect(app.versions).toEqual([]);
    expect(repo.versions).not.toHaveBeenCalled();
  });

  it('loadVersions picks the first editable version as default selectedVersion', async () => {
    const live = new Version('v-live', 'a-1', '1.5', VersionState.ReadyForSale, 'IOS', {});
    const editable = new Version('v-next', 'a-1', '2.0', VersionState.PrepareForSubmission, 'IOS', {});
    const repo = stubRepo({ versions: vi.fn().mockResolvedValue([live, editable]) });
    const app = new App(appInit({ affordances: { getVersions: '/api/v1/apps/a-1/versions' } }), repo);

    await app.loadVersions();

    expect(app.selectedVersion).toBe(editable);
  });

  it('loadVersions falls back to first version when none are editable', async () => {
    const live = new Version('v-live', 'a-1', '1.5', VersionState.ReadyForSale, 'IOS', {});
    const rejected = new Version('v-rej', 'a-1', '1.4', VersionState.Rejected, 'IOS', {});
    const repo = stubRepo({ versions: vi.fn().mockResolvedValue([live, rejected]) });
    const app = new App(appInit({ affordances: { getVersions: '/api/v1/apps/a-1/versions' } }), repo);

    await app.loadVersions();

    expect(app.selectedVersion).toBe(live);
  });

  it('loadVersions preserves existing selectedVersion if still present', async () => {
    const a = new Version('v-1', 'a-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    const b = new Version('v-2', 'a-1', '2.0', VersionState.PrepareForSubmission, 'IOS', {});
    const repo = stubRepo({ versions: vi.fn().mockResolvedValue([a, b]) });
    const app = new App(appInit({ affordances: { getVersions: '/api/v1/apps/a-1/versions' } }), repo);

    await app.loadVersions();
    app.selectVersion('v-2');
    await app.loadVersions();

    expect(app.selectedVersion?.id).toBe('v-2');
  });

  // ── selectVersion ──

  it('selectVersion updates selectedVersion', async () => {
    const a = new Version('v-1', 'a-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    const b = new Version('v-2', 'a-1', '2.0', VersionState.ReadyForSale, 'IOS', {});
    const repo = stubRepo({ versions: vi.fn().mockResolvedValue([a, b]) });
    const app = new App(appInit({ affordances: { getVersions: '/api/v1/apps/a-1/versions' } }), repo);

    await app.loadVersions();
    app.selectVersion('v-2');

    expect(app.selectedVersion).toBe(b);
  });

  it('selectVersion throws on unknown id', async () => {
    const a = new Version('v-1', 'a-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    const repo = stubRepo({ versions: vi.fn().mockResolvedValue([a]) });
    const app = new App(appInit({ affordances: { getVersions: '/api/v1/apps/a-1/versions' } }), repo);

    await app.loadVersions();

    expect(() => app.selectVersion('v-unknown')).toThrow(/not loaded/);
  });

  // ── setRepository ──

  it('setRepository attaches a repository so navigation can proceed', async () => {
    const repo = stubRepo({ builds: vi.fn().mockResolvedValue([]) });
    const app = new App(appInit({ affordances: { getBuilds: '/api/v1/apps/a-1/builds' } }));

    app.setRepository(repo);
    await app.loadBuilds();

    expect(repo.builds).toHaveBeenCalledWith(app);
  });

  // ── Hydration ──

  it('hydrates from API JSON', () => {
    const json = {
      id: 'a-1',
      name: 'WeatherApp',
      bundleId: 'com.example.weather',
      sku: 'SKU001',
      primaryLocale: 'en-US',
      isAvailableInNewTerritories: true,
      affordances: { getVersions: '/api/v1/apps/a-1/versions' },
      contentRightsDeclaration: 'USES_THIRD_PARTY_CONTENT',
    };

    const app = App.fromJSON(json);

    expect(app.id).toBe('a-1');
    expect(app.name).toBe('WeatherApp');
    expect(app.bundleId).toBe('com.example.weather');
    expect(app.canViewVersions).toBe(true);
    expect(app.hasContentRights).toBe(true);
    expect(app.displayName).toBe('WeatherApp (com.example.weather)');
  });

  it('hydrates with empty affordances when missing from JSON', () => {
    const json = {
      id: 'a-1',
      name: 'App',
      bundleId: 'com.x',
      sku: 'SKU',
      primaryLocale: 'en-US',
      isAvailableInNewTerritories: false,
    };

    const app = App.fromJSON(json);

    expect(app.affordances).toEqual({});
    expect(app.canViewVersions).toBe(false);
    expect(app.contentRightsDeclaration).toBeUndefined();
  });

  it('fromJSON accepts a repository so the hydrated App can navigate', async () => {
    const repo = stubRepo({ builds: vi.fn().mockResolvedValue([]) });
    const app = App.fromJSON({
      id: 'a-1', name: 'App', bundleId: 'com.x', sku: 'SKU', primaryLocale: 'en-US',
      isAvailableInNewTerritories: true,
      affordances: { getBuilds: '/api/v1/apps/a-1/builds' },
    }, repo);

    await app.loadBuilds();
    expect(repo.builds).toHaveBeenCalledWith(app);
  });
});
