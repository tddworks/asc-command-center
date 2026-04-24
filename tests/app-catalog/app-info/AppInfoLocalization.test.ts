import { describe, it, expect, vi } from 'vitest';
import { AppInfoLocalization, type AppInfoLocalizationInit } from '../../../src/app-catalog/app-info/AppInfoLocalization.ts';
import type { AppInfoRepository } from '../../../src/app-catalog/app-info/AppInfoRepository.ts';

function stubRepo(overrides: Partial<AppInfoRepository> = {}): AppInfoRepository {
  return {
    list: vi.fn(),
    saveCategories: vi.fn().mockResolvedValue(undefined),
    saveLocalization: vi.fn().mockResolvedValue(undefined),
    createLocalization: vi.fn().mockResolvedValue({ id: 'new-id', affordances: {} }),
    deleteLocalization: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function make(overrides: Partial<AppInfoLocalizationInit> = {}) {
  return new AppInfoLocalization({
    id: 'loc-1',
    locale: 'en-US',
    name: 'Bakery App',
    subtitle: 'Fresh bread every morning',
    ...overrides,
  });
}

describe('AppInfoLocalization', () => {

  // ── Construction ──

  it('exposes identity and loaded fields', () => {
    const loc = make();
    expect(loc.id).toBe('loc-1');
    expect(loc.locale).toBe('en-US');
    expect(loc.name).toBe('Bakery App');
    expect(loc.subtitle).toBe('Fresh bread every morning');
  });

  it('reports not dirty immediately after construction', () => {
    expect(make().hasUnsavedChanges).toBe(false);
  });

  // ── Setters + dirty ──

  it('setName updates name and flips hasUnsavedChanges', () => {
    const loc = make();
    loc.setName('New Name');
    expect(loc.name).toBe('New Name');
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setSubtitle updates subtitle and flips hasUnsavedChanges', () => {
    const loc = make();
    loc.setSubtitle('New subtitle');
    expect(loc.subtitle).toBe('New subtitle');
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setSubtitle accepts null to clear the subtitle', () => {
    const loc = make();
    loc.setSubtitle(null);
    expect(loc.subtitle).toBeNull();
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setPrivacyPolicyUrl updates the field and flips hasUnsavedChanges', () => {
    const loc = make();
    loc.setPrivacyPolicyUrl('https://x.test/p');
    expect(loc.privacyPolicyUrl).toBe('https://x.test/p');
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setPrivacyChoicesUrl updates the field and flips hasUnsavedChanges', () => {
    const loc = make();
    loc.setPrivacyChoicesUrl('https://x.test/c');
    expect(loc.privacyChoicesUrl).toBe('https://x.test/c');
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setPrivacyPolicyUrl accepts null to clear', () => {
    const loc = make({ privacyPolicyUrl: 'https://x.test/p' });
    loc.setPrivacyPolicyUrl(null);
    expect(loc.privacyPolicyUrl).toBeNull();
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setting a field to its current value does not flip dirty', () => {
    const loc = make();
    loc.setName('Bakery App');
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  it('returning to the snapshot value after a change clears dirty', () => {
    const loc = make();
    loc.setName('Edited');
    expect(loc.hasUnsavedChanges).toBe(true);
    loc.setName('Bakery App');
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  // ── discard ──

  it('discard restores the snapshot values', () => {
    const loc = make();
    loc.setName('Edited');
    loc.setSubtitle('Edited subtitle');

    loc.discard();

    expect(loc.name).toBe('Bakery App');
    expect(loc.subtitle).toBe('Fresh bread every morning');
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  it('discard restores privacy URLs to the snapshot', () => {
    const loc = make({
      privacyPolicyUrl: 'https://x.test/p',
      privacyChoicesUrl: 'https://x.test/c',
    });
    loc.setPrivacyPolicyUrl('https://y.test/p');
    loc.setPrivacyChoicesUrl(null);

    loc.discard();

    expect(loc.privacyPolicyUrl).toBe('https://x.test/p');
    expect(loc.privacyChoicesUrl).toBe('https://x.test/c');
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  // ── markSaved ──

  it('markSaved promotes the current values to the new snapshot', () => {
    const loc = make();
    loc.setName('New Name');

    loc.markSaved();

    expect(loc.hasUnsavedChanges).toBe(false);

    // discard would now restore "New Name", not "Bakery App"
    loc.setName('Another');
    loc.discard();
    expect(loc.name).toBe('New Name');
  });

  it('markSaved promotes privacy URLs into the snapshot', () => {
    const loc = make();
    loc.setPrivacyPolicyUrl('https://x.test/p');

    loc.markSaved();

    expect(loc.hasUnsavedChanges).toBe(false);
    loc.setPrivacyPolicyUrl('https://z.test/p');
    loc.discard();
    expect(loc.privacyPolicyUrl).toBe('https://x.test/p');
  });

  // ── Capability ──

  it('canUpdate is true when the update affordance is present', () => {
    const loc = make({ affordances: { update: '/api/v1/app-info-localizations/loc-1' } });
    expect(loc.canUpdate).toBe(true);
  });

  it('canUpdate accepts the verb+resource variant updateAppInfoLocalization', () => {
    const loc = make({ affordances: { updateAppInfoLocalization: '/api/v1/app-info-localizations/loc-1' } });
    expect(loc.canUpdate).toBe(true);
  });

  it('canUpdate accepts the shorter updateLocalization variant', () => {
    const loc = make({ affordances: { updateLocalization: '/api/v1/app-info-localizations/loc-1' } });
    expect(loc.canUpdate).toBe(true);
  });

  it('canUpdate is false when the update affordance is absent', () => {
    expect(make().canUpdate).toBe(false);
  });

  it('updateUrl returns the first matching affordance URL', () => {
    const loc = make({ affordances: {
      updateAppInfoLocalization: '/api/v1/app-info-localizations/loc-1',
    } });
    expect(loc.updateUrl).toBe('/api/v1/app-info-localizations/loc-1');
  });

  it('canDelete reflects the delete affordance, accepting verb+resource variants', () => {
    expect(make().canDelete).toBe(false);
    expect(make({ affordances: { delete: '/x' } }).canDelete).toBe(true);
    expect(make({ affordances: { deleteAppInfoLocalization: '/x' } }).canDelete).toBe(true);
    expect(make({ affordances: { deleteLocalization: '/x' } }).canDelete).toBe(true);
  });

  // ── Self-persistence ──

  it('save delegates to repository.saveLocalization then clears dirty', async () => {
    const repo = stubRepo();
    const loc = make();
    loc.setRepository(repo);
    loc.setName('Edited');

    await loc.save();

    expect(repo.saveLocalization).toHaveBeenCalledWith(loc);
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  it('save propagates errors and keeps dirty state', async () => {
    const repo = stubRepo({ saveLocalization: vi.fn().mockRejectedValue(new Error('boom')) });
    const loc = make();
    loc.setRepository(repo);
    loc.setName('Edited');

    await expect(loc.save()).rejects.toThrow('boom');
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('save throws when no repository is attached', async () => {
    const loc = make();
    loc.setName('Edited');
    await expect(loc.save()).rejects.toThrow(/no repository/i);
  });

  it('delete delegates to repository.deleteLocalization', async () => {
    const repo = stubRepo();
    const loc = make();
    loc.setRepository(repo);

    await loc.delete();

    expect(repo.deleteLocalization).toHaveBeenCalledWith(loc);
  });

  it('delete throws when no repository is attached', async () => {
    const loc = make();
    await expect(loc.delete()).rejects.toThrow(/no repository/i);
  });

  // ── Identity for unsaved (locally-added) locales ──

  it('accepts an empty id to represent a locally-added locale', () => {
    const loc = new AppInfoLocalization({ id: '', locale: 'fr-FR', name: 'Boulangerie', subtitle: null });
    expect(loc.id).toBe('');
    expect(loc.hasUnsavedChanges).toBe(false);
  });
});
