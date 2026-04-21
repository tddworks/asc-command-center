import { describe, it, expect, vi } from 'vitest';
import { AppInfo, type AppInfoInit } from '../../../src/app-catalog/app-info/AppInfo.ts';
import { AppInfoLocalization } from '../../../src/app-catalog/app-info/AppInfoLocalization.ts';
import type { AppInfoRepository } from '../../../src/app-catalog/app-info/AppInfoRepository.ts';

function stubRepo(overrides: Partial<AppInfoRepository> = {}): AppInfoRepository {
  return {
    list: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeInfo(overrides: Partial<AppInfoInit> = {}): AppInfo {
  return new AppInfo({
    id: 'info-1',
    appId: 'app-1',
    primaryCategoryId: 'FOOD_AND_DRINK',
    secondaryCategoryId: null,
    privacyPolicyUrl: 'https://example.com/privacy',
    supportUrl: 'https://example.com/support',
    marketingUrl: null,
    primaryLocale: 'en-US',
    localizations: [
      new AppInfoLocalization({ id: 'loc-1', locale: 'en-US', name: 'Bakery App', subtitle: 'Fresh bread' }),
      new AppInfoLocalization({ id: 'loc-2', locale: 'de-DE', name: 'Bäckerei', subtitle: 'Brot' }),
    ],
    ...overrides,
  });
}

describe('AppInfo', () => {

  // ── Construction ──

  it('exposes identity and loaded fields', () => {
    const info = makeInfo();
    expect(info.id).toBe('info-1');
    expect(info.appId).toBe('app-1');
    expect(info.primaryCategoryId).toBe('FOOD_AND_DRINK');
    expect(info.privacyPolicyUrl).toBe('https://example.com/privacy');
    expect(info.localizations).toHaveLength(2);
  });

  it('reports not dirty immediately after construction', () => {
    expect(makeInfo().hasUnsavedChanges).toBe(false);
  });

  // ── Top-level setters ──

  it('setPrimaryCategory flips dirty', () => {
    const info = makeInfo();
    info.setPrimaryCategory('PRODUCTIVITY');
    expect(info.primaryCategoryId).toBe('PRODUCTIVITY');
    expect(info.hasUnsavedChanges).toBe(true);
  });

  it('setSecondaryCategory accepts null to clear', () => {
    const info = makeInfo({ secondaryCategoryId: 'UTILITIES' });
    info.setSecondaryCategory(null);
    expect(info.secondaryCategoryId).toBeNull();
    expect(info.hasUnsavedChanges).toBe(true);
  });

  it('setPrivacyPolicyUrl / setSupportUrl / setMarketingUrl flip dirty', () => {
    const info = makeInfo();
    info.setPrivacyPolicyUrl('https://x.test/p');
    info.setSupportUrl('https://x.test/s');
    info.setMarketingUrl('https://x.test/m');
    expect(info.privacyPolicyUrl).toBe('https://x.test/p');
    expect(info.supportUrl).toBe('https://x.test/s');
    expect(info.marketingUrl).toBe('https://x.test/m');
    expect(info.hasUnsavedChanges).toBe(true);
  });

  it('setting a field to its current value does not flip dirty', () => {
    const info = makeInfo();
    info.setPrimaryCategory('FOOD_AND_DRINK');
    expect(info.hasUnsavedChanges).toBe(false);
  });

  // ── Localizations: add / remove / lookup ──

  it('localizationFor returns the entry for a given locale', () => {
    const info = makeInfo();
    expect(info.localizationFor('en-US')?.name).toBe('Bakery App');
    expect(info.localizationFor('zz-ZZ')).toBeUndefined();
  });

  it('addLocalization adds an unsaved entry with empty id', () => {
    const info = makeInfo();
    const added = info.addLocalization('fr-FR', { name: 'Boulangerie' });

    expect(added.locale).toBe('fr-FR');
    expect(added.id).toBe('');
    expect(added.name).toBe('Boulangerie');
    expect(info.localizations).toContain(added);
    expect(info.hasUnsavedChanges).toBe(true);
  });

  it('addLocalization defaults name to empty string', () => {
    const info = makeInfo();
    const added = info.addLocalization('fr-FR');
    expect(added.name).toBe('');
    expect(added.subtitle).toBeNull();
  });

  it('addLocalization throws when the locale already exists', () => {
    const info = makeInfo();
    expect(() => info.addLocalization('en-US')).toThrow(/already/i);
  });

  it('removeLocalization drops the entry and flips dirty', () => {
    const info = makeInfo();
    info.removeLocalization('de-DE');

    expect(info.localizationFor('de-DE')).toBeUndefined();
    expect(info.localizations).toHaveLength(1);
    expect(info.hasUnsavedChanges).toBe(true);
  });

  it('removeLocalization throws when the locale is not present', () => {
    const info = makeInfo();
    expect(() => info.removeLocalization('zz-ZZ')).toThrow(/not found/i);
  });

  it('hasUnsavedChanges is true when a child localization is dirty', () => {
    const info = makeInfo();
    info.localizationFor('en-US')!.setName('Edited');
    expect(info.hasUnsavedChanges).toBe(true);
  });

  // ── Discard ──

  it('discard restores top-level fields', () => {
    const info = makeInfo();
    info.setPrimaryCategory('PRODUCTIVITY');
    info.setPrivacyPolicyUrl('https://x.test/p');

    info.discard();

    expect(info.primaryCategoryId).toBe('FOOD_AND_DRINK');
    expect(info.privacyPolicyUrl).toBe('https://example.com/privacy');
    expect(info.hasUnsavedChanges).toBe(false);
  });

  it('discard drops locally-added localizations', () => {
    const info = makeInfo();
    info.addLocalization('fr-FR');

    info.discard();

    expect(info.localizationFor('fr-FR')).toBeUndefined();
    expect(info.hasUnsavedChanges).toBe(false);
  });

  it('discard restores locally-removed localizations', () => {
    const info = makeInfo();
    info.removeLocalization('de-DE');

    info.discard();

    expect(info.localizationFor('de-DE')?.name).toBe('Bäckerei');
    expect(info.hasUnsavedChanges).toBe(false);
  });

  it('discard resets each localization to its snapshot', () => {
    const info = makeInfo();
    info.localizationFor('en-US')!.setName('Edited');

    info.discard();

    expect(info.localizationFor('en-US')!.name).toBe('Bakery App');
    expect(info.hasUnsavedChanges).toBe(false);
  });

  // ── Save delegation ──

  it('save delegates to the repository and then clears dirty', async () => {
    const repo = stubRepo();
    const info = makeInfo();
    info.setRepository(repo);
    info.setPrimaryCategory('PRODUCTIVITY');

    await info.save();

    expect(repo.save).toHaveBeenCalledWith(info);
    expect(info.hasUnsavedChanges).toBe(false);
  });

  it('save propagates errors and keeps the dirty state', async () => {
    const repo = stubRepo({ save: vi.fn().mockRejectedValue(new Error('boom')) });
    const info = makeInfo();
    info.setRepository(repo);
    info.setPrimaryCategory('PRODUCTIVITY');

    await expect(info.save()).rejects.toThrow('boom');
    expect(info.hasUnsavedChanges).toBe(true);
  });

  it('save throws without a repository', async () => {
    const info = makeInfo();
    info.setPrimaryCategory('PRODUCTIVITY');
    await expect(info.save()).rejects.toThrow(/no repository/i);
  });

  // ── Readiness helpers ──

  it('isComplete is true when primary locale + categories + privacy are set', () => {
    const info = makeInfo();
    expect(info.isComplete).toBe(true);
  });

  it('isComplete is false when the primary locale has no subtitle', () => {
    const info = makeInfo({
      localizations: [
        new AppInfoLocalization({ id: 'loc-1', locale: 'en-US', name: 'Bakery App', subtitle: null }),
      ],
    });
    expect(info.isComplete).toBe(false);
  });

  it('isComplete is false when primary category is missing', () => {
    const info = makeInfo({ primaryCategoryId: null });
    expect(info.isComplete).toBe(false);
  });

  it('isComplete is false when privacy policy URL is missing', () => {
    const info = makeInfo({ privacyPolicyUrl: null });
    expect(info.isComplete).toBe(false);
  });

  it('missingFields lists missing items for a locale', () => {
    const info = makeInfo({
      primaryCategoryId: null,
      privacyPolicyUrl: null,
      localizations: [
        new AppInfoLocalization({ id: 'loc-1', locale: 'en-US', name: '', subtitle: null }),
      ],
    });
    const missing = info.missingFields('en-US');
    expect(missing).toContain('Name');
    expect(missing).toContain('Subtitle');
    expect(missing).toContain('Primary category');
    expect(missing).toContain('Privacy Policy URL');
  });

  it('missingFields returns an empty list when the locale is complete', () => {
    const info = makeInfo();
    expect(info.missingFields('en-US')).toEqual([]);
  });

  // ── Hydration ──

  it('fromJSON hydrates info and its localizations', () => {
    const info = AppInfo.fromJSON({
      id: 'info-2',
      appId: 'app-9',
      primaryCategoryId: 'UTILITIES',
      secondaryCategoryId: null,
      privacyPolicyUrl: null,
      supportUrl: null,
      marketingUrl: null,
      primaryLocale: 'en-US',
      localizations: [
        { id: 'loc-x', locale: 'en-US', name: 'Thing', subtitle: null },
      ],
    });
    expect(info.id).toBe('info-2');
    expect(info.appId).toBe('app-9');
    expect(info.primaryCategoryId).toBe('UTILITIES');
    expect(info.localizations[0]).toBeInstanceOf(AppInfoLocalization);
    expect(info.localizations[0].name).toBe('Thing');
  });
});
