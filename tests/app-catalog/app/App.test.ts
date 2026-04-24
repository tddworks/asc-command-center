import { describe, it, expect, vi } from 'vitest';
import { App, type AppInit } from '../../../src/app-catalog/app/App.ts';
import { Build, BuildProcessingState } from '../../../src/release/build/Build.ts';
import { Version, VersionState, Platform } from '../../../src/release/version/Version.ts';
import type { AppRepository } from '../../../src/app-catalog/app/AppRepository.ts';

function stubRepo(overrides: Partial<AppRepository> = {}): AppRepository {
  return {
    list: vi.fn(),
    get: vi.fn(),
    builds: vi.fn(),
    versions: vi.fn(),
    createVersion: vi.fn(),
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

  // ── editableVersionForPlatform ──

  it('editableVersionForPlatform returns an editable version matching the platform', async () => {
    const ios = new Version('v-1', 'a-1', '2.0', VersionState.PrepareForSubmission, Platform.iOS, {});
    const mac = new Version('v-2', 'a-1', '2.0', VersionState.ReadyForSale, Platform.macOS, {});
    const repo = stubRepo({ versions: vi.fn().mockResolvedValue([ios, mac]) });
    const app = new App(appInit({ affordances: { getVersions: '/api/v1/apps/a-1/versions' } }), repo);
    await app.loadVersions();

    expect(app.editableVersionForPlatform(Platform.iOS)).toBe(ios);
    expect(app.editableVersionForPlatform(Platform.macOS)).toBeNull();
  });

  it('editableVersionForPlatform treats rejected versions as editable', async () => {
    const rejected = new Version('v-1', 'a-1', '1.4', VersionState.Rejected, Platform.iOS, {});
    const repo = stubRepo({ versions: vi.fn().mockResolvedValue([rejected]) });
    const app = new App(appInit({ affordances: { getVersions: '/api/v1/apps/a-1/versions' } }), repo);
    await app.loadVersions();

    expect(app.editableVersionForPlatform(Platform.iOS)).toBe(rejected);
  });

  it('editableVersionForPlatform returns null when no version matches the platform', () => {
    const app = new App(appInit());
    expect(app.editableVersionForPlatform(Platform.tvOS)).toBeNull();
  });

  // ── Navigation: createVersion ──

  it('canCreateVersion reflects the createVersion affordance', () => {
    expect(new App(appInit()).canCreateVersion).toBe(false);
    const withAff = new App(appInit({
      affordances: { createVersion: '/api/v1/apps/a-1/versions' },
    }));
    expect(withAff.canCreateVersion).toBe(true);
  });

  it('canManageVersions is true when createVersion is allowed', () => {
    const app = new App(appInit({ affordances: { createVersion: '/api/v1/apps/a-1/versions' } }));
    expect(app.canManageVersions).toBe(true);
  });

  it('canManageVersions is true when any loaded version is editable via updateVersion', async () => {
    const editable = new Version('v-1', 'a-1', '2.0', VersionState.PrepareForSubmission, Platform.iOS, {
      updateVersion: '/api/v1/versions/v-1',
    });
    const repo = stubRepo({ versions: vi.fn().mockResolvedValue([editable]) });
    const app = new App(appInit({ affordances: { getVersions: '/api/v1/apps/a-1/versions' } }), repo);
    await app.loadVersions();

    expect(app.canCreateVersion).toBe(false);
    expect(app.canManageVersions).toBe(true);
  });

  it('canManageVersions is false when neither createVersion nor any canEdit version exists', async () => {
    const live = new Version('v-1', 'a-1', '1.0', VersionState.ReadyForSale, Platform.iOS, {});
    const repo = stubRepo({ versions: vi.fn().mockResolvedValue([live]) });
    const app = new App(appInit({ affordances: { getVersions: '/api/v1/apps/a-1/versions' } }), repo);
    await app.loadVersions();

    expect(app.canManageVersions).toBe(false);
  });

  it('createVersion delegates to the repository with the init payload', async () => {
    const created = new Version('v-new', 'a-1', '3.0', VersionState.PrepareForSubmission, Platform.iOS, {});
    const repo = stubRepo({ createVersion: vi.fn().mockResolvedValue(created) });
    const app = new App(
      appInit({ affordances: { createVersion: '/api/v1/apps/a-1/versions' } }),
      repo,
    );

    const result = await app.createVersion({ platform: Platform.iOS, versionString: '3.0' });

    expect(result).toBe(created);
    expect(repo.createVersion).toHaveBeenCalledWith(app, {
      platform: Platform.iOS,
      versionString: '3.0',
    });
  });

  it('createVersion appends to versions and selects the new one', async () => {
    const existing = new Version('v-1', 'a-1', '1.0', VersionState.ReadyForSale, Platform.iOS, {});
    const created = new Version('v-2', 'a-1', '2.0', VersionState.PrepareForSubmission, Platform.iOS, {});
    const repo = stubRepo({
      versions: vi.fn().mockResolvedValue([existing]),
      createVersion: vi.fn().mockResolvedValue(created),
    });
    const app = new App(
      appInit({
        affordances: {
          getVersions: '/api/v1/apps/a-1/versions',
          createVersion: '/api/v1/apps/a-1/versions',
        },
      }),
      repo,
    );
    await app.loadVersions();

    await app.createVersion({ platform: Platform.iOS, versionString: '2.0' });

    expect(app.versions).toEqual([existing, created]);
    expect(app.selectedVersion).toBe(created);
  });

  it('createVersion throws when canCreateVersion is false', async () => {
    const repo = stubRepo({ createVersion: vi.fn() });
    const app = new App(appInit(), repo);

    await expect(
      app.createVersion({ platform: Platform.iOS, versionString: '1.0' }),
    ).rejects.toThrow(/createVersion/);
    expect(repo.createVersion).not.toHaveBeenCalled();
  });

  it('createVersion throws when no repository is attached', async () => {
    const app = new App(appInit({
      affordances: { createVersion: '/api/v1/apps/a-1/versions' },
    }));

    await expect(
      app.createVersion({ platform: Platform.iOS, versionString: '1.0' }),
    ).rejects.toThrow(/no repository attached/);
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

  // ── Icon resolution ──

  it('iconSrc returns null when no icon source is known', () => {
    const app = new App(appInit());
    expect(app.iconSrc()).toBeNull();
  });

  it('iconSrc prefers a resolved iconUrl over a templateUrl', () => {
    const app = new App(appInit({
      iconUrl: 'https://cdn.example/icon.png',
      iconTemplateUrl: 'https://cdn.example/{w}x{h}{f}.png',
    }));
    expect(app.iconSrc()).toBe('https://cdn.example/icon.png');
  });

  it('iconSrc substitutes template placeholders when only the template is known', () => {
    const app = new App(appInit({
      iconTemplateUrl: 'https://cdn.example/icon/{w}x{h}bb.{f}',
    }));
    expect(app.iconSrc(128)).toBe('https://cdn.example/icon/128x128bb.png');
  });

  it('fromJSON hydrates iconAssetToken into iconTemplateUrl', () => {
    const app = App.fromJSON({
      id: 'a-1', name: 'App', bundleId: 'com.x', sku: 'SKU', primaryLocale: 'en-US',
      isAvailableInNewTerritories: true,
      iconAssetToken: { templateUrl: 'https://cdn.example/{w}x{h}bb.{f}' },
    });
    expect(app.iconSrc(64)).toBe('https://cdn.example/64x64bb.png');
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
