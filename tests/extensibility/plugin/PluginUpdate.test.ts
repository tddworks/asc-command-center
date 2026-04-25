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
});
