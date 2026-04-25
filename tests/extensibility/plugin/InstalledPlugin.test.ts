import { describe, it, expect } from 'vitest';
import { InstalledPlugin } from '../../../src/extensibility/plugin/InstalledPlugin.ts';

describe('InstalledPlugin', () => {

  it('exposes the fields it was constructed with', () => {
    const p = new InstalledPlugin({
      slug: 'ASCPro',
      name: 'ASC Pro',
      apiVersion: '1.0.0',
      ui: ['ui/ai.bundle.js'],
    });
    expect(p.slug).toBe('ASCPro');
    expect(p.name).toBe('ASC Pro');
    expect(p.apiVersion).toBe('1.0.0');
    expect(p.ui).toEqual(['ui/ai.bundle.js']);
  });

  it('apiVersion defaults to null when missing', () => {
    const p = new InstalledPlugin({ slug: 's', name: 'n', ui: [] });
    expect(p.apiVersion).toBeNull();
  });

  // ── Display ──

  it('iconLetter returns the first letter of the name uppercased', () => {
    const p = new InstalledPlugin({ slug: 's', name: 'asc pro', ui: [] });
    expect(p.iconLetter).toBe('A');
  });

  it('iconLetter falls back to ? when the name is empty', () => {
    const p = new InstalledPlugin({ slug: 's', name: '', ui: [] });
    expect(p.iconLetter).toBe('?');
  });

  // ── bundles vs assets ──

  it('bundles returns only *.bundle.js files', () => {
    const p = new InstalledPlugin({
      slug: 's', name: 'n',
      ui: ['ui/a.bundle.js', 'ui/b.html', 'ui/c.bundle.js', 'frames/d.png'],
    });
    expect(p.bundles).toEqual(['ui/a.bundle.js', 'ui/c.bundle.js']);
    expect(p.bundleCount).toBe(2);
  });

  it('assets returns the non-bundle UI files', () => {
    const p = new InstalledPlugin({
      slug: 's', name: 'n',
      ui: ['ui/a.bundle.js', 'ui/b.html', 'frames/d.png'],
    });
    expect(p.assets).toEqual(['ui/b.html', 'frames/d.png']);
    expect(p.assetCount).toBe(2);
  });

  // ── Compatibility ──

  it('isCompatible matches on the major-version segment', () => {
    const p = new InstalledPlugin({ slug: 's', name: 'n', apiVersion: '1.2.3', ui: [] });
    expect(p.isCompatible('1.0.0')).toBe(true);
    expect(p.isCompatible('1.99.99')).toBe(true);
    expect(p.isCompatible('2.0.0')).toBe(false);
  });

  it('isCompatible returns true when the plugin declares no apiVersion', () => {
    const p = new InstalledPlugin({ slug: 's', name: 'n', ui: [] });
    expect(p.isCompatible('1.0.0')).toBe(true);
    expect(p.isCompatible('5.0.0')).toBe(true);
  });

  // ── fromJSON ──

  it('fromJSON hydrates from the asc backend shape', () => {
    const p = InstalledPlugin.fromJSON({
      apiVersion: '1.0.0',
      name: 'ASC Pro',
      slug: 'ASCPro',
      ui: ['ui/ai.bundle.js', 'ui/simulator.bundle.js', 'frames/iPhone 17.png'],
    });
    expect(p.slug).toBe('ASCPro');
    expect(p.name).toBe('ASC Pro');
    expect(p.bundleCount).toBe(2);
    expect(p.assetCount).toBe(1);
  });

  it('fromJSON falls back to slug for name when name is missing', () => {
    const p = InstalledPlugin.fromJSON({ slug: 'BlitzScreenshots', ui: [] });
    expect(p.name).toBe('BlitzScreenshots');
  });

  it('fromJSON tolerates a missing ui array', () => {
    const p = InstalledPlugin.fromJSON({ slug: 's', name: 'n' });
    expect(p.ui).toEqual([]);
  });

  it('fromJSON reads marketplace metadata when present', () => {
    const p = InstalledPlugin.fromJSON({
      id: 'discord-notify',
      slug: 'discord-notify',
      name: 'Discord Notify',
      version: '1.2.0',
      author: 'community',
      description: 'Send build notifications to Discord channels.',
      categories: ['Notifications'],
      repositoryURL: 'https://example.com/discord-notify',
      isInstalled: false,
    });
    expect(p.id).toBe('discord-notify');
    expect(p.version).toBe('1.2.0');
    expect(p.author).toBe('community');
    expect(p.description).toBe('Send build notifications to Discord channels.');
    expect(p.categories).toEqual(['Notifications']);
    expect(p.repositoryURL).toBe('https://example.com/discord-notify');
    expect(p.isInstalled).toBe(false);
  });

  it('fromJSON: id falls back to slug when missing', () => {
    const p = InstalledPlugin.fromJSON({ slug: 'ASCPro', name: 'ASC Pro' });
    expect(p.id).toBe('ASCPro');
  });

  it('fromJSON: marketplace fields default to null/empty', () => {
    const p = InstalledPlugin.fromJSON({ slug: 's', name: 'n' });
    expect(p.version).toBeNull();
    expect(p.author).toBeNull();
    expect(p.description).toBeNull();
    expect(p.categories).toEqual([]);
    expect(p.repositoryURL).toBeNull();
    expect(p.isInstalled).toBe(false);
  });

  // ── Affordances ──

  it('installUrl reads the install affordance when present', () => {
    const p = new InstalledPlugin({
      slug: 'd', name: 'D',
      affordances: { install: '/api/v1/plugins' },
    });
    expect(p.installUrl).toBe('/api/v1/plugins');
    expect(p.uninstallUrl).toBeNull();
  });

  it('uninstallUrl reads the uninstall affordance when present', () => {
    const p = new InstalledPlugin({
      slug: 'd', name: 'D',
      affordances: { uninstall: '/api/v1/plugins/d' },
    });
    expect(p.uninstallUrl).toBe('/api/v1/plugins/d');
    expect(p.installUrl).toBeNull();
  });

  it('installUrl/uninstallUrl are null when no affordances are present', () => {
    const p = new InstalledPlugin({ slug: 'd', name: 'D' });
    expect(p.installUrl).toBeNull();
    expect(p.uninstallUrl).toBeNull();
  });

  it('fromJSON reads affordances when the row carries them', () => {
    const p = InstalledPlugin.fromJSON({
      slug: 'd', name: 'D',
      affordances: { uninstall: '/api/v1/plugins/d' },
    });
    expect(p.uninstallUrl).toBe('/api/v1/plugins/d');
  });
});
