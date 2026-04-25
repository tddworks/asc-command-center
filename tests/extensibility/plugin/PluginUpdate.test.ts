import { describe, it, expect } from 'vitest';
import { PluginUpdate } from '../../../src/extensibility/plugin/PluginUpdate.ts';

describe('PluginUpdate', () => {
  it('exposes the fields it was constructed with', () => {
    const u = new PluginUpdate({
      name: 'Hello',
      installedVersion: '1.0.0',
      latestVersion: '1.2.0',
    });
    expect(u.name).toBe('Hello');
    expect(u.installedVersion).toBe('1.0.0');
    expect(u.latestVersion).toBe('1.2.0');
    expect(u.affordances).toEqual({});
  });

  it('versionDelta renders a compact "from → to" label', () => {
    const u = new PluginUpdate({
      name: 'Hello', installedVersion: '1.0.0', latestVersion: '1.2.0',
    });
    expect(u.versionDelta).toBe('1.0.0 → 1.2.0');
  });

  it('updateUrl reads the affordance when present', () => {
    const u = new PluginUpdate({
      name: 'Hello', installedVersion: '1.0.0', latestVersion: '1.2.0',
      affordances: { update: '/api/v1/plugins/Hello/update' },
    });
    expect(u.updateUrl).toBe('/api/v1/plugins/Hello/update');
  });

  it('updateUrl is null when no affordance is present', () => {
    const u = new PluginUpdate({
      name: 'Hello', installedVersion: '1.0.0', latestVersion: '1.2.0',
    });
    expect(u.updateUrl).toBeNull();
  });

  it('fromJSON hydrates from the asc backend shape', () => {
    const u = PluginUpdate.fromJSON({
      name: 'Hello',
      installedVersion: '1.0.0',
      latestVersion: '1.2.0',
      affordances: { update: '/api/v1/plugins/Hello/update' },
    });
    expect(u.name).toBe('Hello');
    expect(u.versionDelta).toBe('1.0.0 → 1.2.0');
    expect(u.updateUrl).toBe('/api/v1/plugins/Hello/update');
  });

  it('fromJSON tolerates missing affordances', () => {
    const u = PluginUpdate.fromJSON({
      name: 'Hello', installedVersion: '1.0.0', latestVersion: '1.2.0',
    });
    expect(u.affordances).toEqual({});
    expect(u.updateUrl).toBeNull();
  });

  // ── isUpgrade ──

  it('isUpgrade is true when the latest version is strictly newer', () => {
    const u = new PluginUpdate({ name: 'X', installedVersion: '1.0.0', latestVersion: '1.0.1' });
    expect(u.isUpgrade).toBe(true);
  });

  it('isUpgrade compares across major/minor/patch segments', () => {
    expect(new PluginUpdate({ name: 'X', installedVersion: '1.0.0', latestVersion: '2.0.0' }).isUpgrade).toBe(true);
    expect(new PluginUpdate({ name: 'X', installedVersion: '1.9.0', latestVersion: '1.10.0' }).isUpgrade).toBe(true);
    expect(new PluginUpdate({ name: 'X', installedVersion: '1.0', latestVersion: '1.0.1' }).isUpgrade).toBe(true);
  });

  it('isUpgrade is false when versions are equal', () => {
    const u = new PluginUpdate({ name: 'X', installedVersion: '1.0.0', latestVersion: '1.0.0' });
    expect(u.isUpgrade).toBe(false);
  });

  it('isUpgrade is false when the local version is newer (the bug we filter out)', () => {
    // The asc backend's `listOutdated` ships any version mismatch, so a
    // locally-newer plugin would otherwise read "1.0.1 → 1.0".
    const u = new PluginUpdate({ name: 'X', installedVersion: '1.0.1', latestVersion: '1.0' });
    expect(u.isUpgrade).toBe(false);
  });
});
