import { describe, it, expect, vi } from 'vitest';
import { App } from '../../src/app/App.ts';
import { Build, BuildProcessingState } from '../../src/build/Build.ts';
import { Version, VersionState } from '../../src/version/Version.ts';
import type { AppRepository } from '../../src/app/AppRepository.ts';

function stubRepo(overrides: Partial<AppRepository> = {}): AppRepository {
  return {
    list: vi.fn(),
    get: vi.fn(),
    builds: vi.fn(),
    versions: vi.fn(),
    ...overrides,
  };
}

describe('App', () => {

  // ── Display ──

  it('formats display name as name (bundleId)', () => {
    const app = new App('a-1', 'WeatherApp', 'com.example.weather', 'SKU001', 'en-US', true, {});
    expect(app.displayName).toBe('WeatherApp (com.example.weather)');
  });

  // ── Semantic Booleans ──

  it('has content rights when declaration is present', () => {
    const app = new App('a-1', 'App', 'com.x', 'SKU', 'en-US', true, {}, 'USES_THIRD_PARTY_CONTENT');
    expect(app.hasContentRights).toBe(true);
  });

  it('does not have content rights when declaration is undefined', () => {
    const app = new App('a-1', 'App', 'com.x', 'SKU', 'en-US', true, {});
    expect(app.hasContentRights).toBe(false);
  });

  // ── Capability Checks (from API affordances) ──

  it('can view versions when server provides affordance', () => {
    const app = new App('a-1', 'App', 'com.x', 'SKU', 'en-US', true, {
      getVersions: 'asc versions list --app-id a-1',
    });
    expect(app.canViewVersions).toBe(true);
  });

  it('cannot view versions when server omits affordance', () => {
    const app = new App('a-1', 'App', 'com.x', 'SKU', 'en-US', true, {});
    expect(app.canViewVersions).toBe(false);
  });

  it('can view builds when server provides affordance', () => {
    const app = new App('a-1', 'App', 'com.x', 'SKU', 'en-US', true, {
      getBuilds: 'asc builds list --app-id a-1',
    });
    expect(app.canViewBuilds).toBe(true);
  });

  // ── Navigation: loadBuilds ──

  it('loadBuilds delegates to repository and returns builds', async () => {
    const expected = [
      new Build('b-1', 'a-1', '100', '2.0', BuildProcessingState.Valid, false, false, '2024-01-15', {}),
    ];
    const repo = stubRepo({ builds: vi.fn().mockResolvedValue(expected) });
    const app = new App('a-1', 'App', 'com.x', 'SKU', 'en-US', true, {
      getBuilds: 'asc builds list --app-id a-1',
    }, undefined, repo);

    await expect(app.loadBuilds()).resolves.toEqual(expected);
    expect(repo.builds).toHaveBeenCalledWith(app);
  });

  it('loadBuilds short-circuits to empty when affordance missing', async () => {
    const repo = stubRepo({ builds: vi.fn() });
    const app = new App('a-1', 'App', 'com.x', 'SKU', 'en-US', true, {}, undefined, repo);

    await expect(app.loadBuilds()).resolves.toEqual([]);
    expect(repo.builds).not.toHaveBeenCalled();
  });

  it('loadBuilds throws when no repository is attached', async () => {
    const app = new App('a-1', 'App', 'com.x', 'SKU', 'en-US', true, {
      getBuilds: 'asc builds list --app-id a-1',
    });
    await expect(app.loadBuilds()).rejects.toThrow(/no repository attached/);
  });

  // ── Navigation: loadVersions ──

  it('loadVersions delegates to repository and returns versions', async () => {
    const expected = [
      new Version('v-1', 'a-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {}),
    ];
    const repo = stubRepo({ versions: vi.fn().mockResolvedValue(expected) });
    const app = new App('a-1', 'App', 'com.x', 'SKU', 'en-US', true, {
      getVersions: 'asc versions list --app-id a-1',
    }, undefined, repo);

    await expect(app.loadVersions()).resolves.toEqual(expected);
    expect(repo.versions).toHaveBeenCalledWith(app);
  });

  it('loadVersions short-circuits to empty when affordance missing', async () => {
    const repo = stubRepo({ versions: vi.fn() });
    const app = new App('a-1', 'App', 'com.x', 'SKU', 'en-US', true, {}, undefined, repo);

    await expect(app.loadVersions()).resolves.toEqual([]);
    expect(repo.versions).not.toHaveBeenCalled();
  });

  // ── withRepository ──

  it('withRepository attaches a repository to an existing App', async () => {
    const repo = stubRepo({ builds: vi.fn().mockResolvedValue([]) });
    const app = new App('a-1', 'App', 'com.x', 'SKU', 'en-US', true, {
      getBuilds: 'asc builds list --app-id a-1',
    });

    const attached = app.withRepository(repo);

    expect(attached).not.toBe(app);
    expect(attached.id).toBe(app.id);
    await attached.loadBuilds();
    expect(repo.builds).toHaveBeenCalledWith(attached);
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
      affordances: { getVersions: 'asc versions list --app-id a-1' },
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
      affordances: { getBuilds: 'asc builds list --app-id a-1' },
    }, repo);

    await app.loadBuilds();
    expect(repo.builds).toHaveBeenCalledWith(app);
  });
});
