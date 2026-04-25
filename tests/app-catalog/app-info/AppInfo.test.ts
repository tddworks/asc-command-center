import { describe, it, expect, vi } from 'vitest';
import { AppInfo, type AppInfoInit } from '../../../src/app-catalog/app-info/AppInfo.ts';
import { AppInfoLocalization } from '../../../src/app-catalog/app-info/AppInfoLocalization.ts';
import type { AppInfoRepository } from '../../../src/app-catalog/app-info/AppInfoRepository.ts';

function stubRepo(overrides: Partial<AppInfoRepository> = {}): AppInfoRepository {
  return {
    list: vi.fn(),
    saveCategories: vi.fn().mockResolvedValue(undefined),
    saveLocalization: vi.fn().mockResolvedValue(undefined),
    createLocalization: vi.fn().mockResolvedValue({ id: 'new-id', affordances: {} }),
    deleteLocalization: vi.fn().mockResolvedValue(undefined),
    ageRating: vi.fn().mockResolvedValue(null),
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

  it('applies init.privacyPolicyUrl to the primary localization at construction', () => {
    const info = makeInfo();
    expect(info.localizationFor('en-US')!.privacyPolicyUrl).toBe('https://example.com/privacy');
    expect(info.localizationFor('en-US')!.hasUnsavedChanges).toBe(false);
  });

  // ── Category-level setters ──

  it('setPrimaryCategory flips dirty', () => {
    const info = makeInfo();
    info.setPrimaryCategory('PRODUCTIVITY');
    expect(info.primaryCategoryId).toBe('PRODUCTIVITY');
    expect(info.categoriesDirty).toBe(true);
    expect(info.hasUnsavedChanges).toBe(true);
  });

  it('setSecondaryCategory accepts null to clear', () => {
    const info = makeInfo({ secondaryCategoryId: 'UTILITIES' });
    info.setSecondaryCategory(null);
    expect(info.secondaryCategoryId).toBeNull();
    expect(info.categoriesDirty).toBe(true);
  });

  it('setPrivacyPolicyUrl writes to the primary localization and flips dirty', () => {
    const info = makeInfo();
    info.setPrivacyPolicyUrl('https://x.test/p');
    expect(info.privacyPolicyUrl).toBe('https://x.test/p');
    expect(info.localizationFor('en-US')!.privacyPolicyUrl).toBe('https://x.test/p');
    expect(info.localizationFor('en-US')!.hasUnsavedChanges).toBe(true);
    expect(info.hasUnsavedChanges).toBe(true);
    // Privacy URLs live on the localization, not on the AppInfo resource.
    expect(info.categoriesDirty).toBe(false);
  });

  it('setPrivacyChoicesUrl writes to the primary localization', () => {
    const info = makeInfo();
    info.setPrivacyChoicesUrl('https://x.test/choices');
    expect(info.privacyChoicesUrl).toBe('https://x.test/choices');
    expect(info.localizationFor('en-US')!.privacyChoicesUrl).toBe('https://x.test/choices');
  });

  it('setContentRightsDeclaration flips dirty', () => {
    const info = makeInfo();
    info.setContentRightsDeclaration('USES_THIRD_PARTY_CONTENT');
    expect(info.contentRightsDeclaration).toBe('USES_THIRD_PARTY_CONTENT');
    expect(info.categoriesDirty).toBe(true);
  });

  it('setContentRightsDeclaration can clear back to null', () => {
    const info = makeInfo({ contentRightsDeclaration: 'USES_THIRD_PARTY_CONTENT' });
    info.setContentRightsDeclaration(null);
    expect(info.contentRightsDeclaration).toBeNull();
    expect(info.categoriesDirty).toBe(true);
  });

  it('setting a field to its current value does not flip dirty', () => {
    const info = makeInfo();
    info.setPrimaryCategory('FOOD_AND_DRINK');
    expect(info.hasUnsavedChanges).toBe(false);
  });

  // ── Capability checks ──

  it('canUpdateCategories reflects the updateCategories affordance', () => {
    expect(makeInfo().canUpdateCategories).toBe(false);
    const info = makeInfo({ affordances: { updateCategories: '/api/v1/app-infos/info-1' } });
    expect(info.canUpdateCategories).toBe(true);
  });

  it('canCreateLocalization reflects the createLocalization affordance', () => {
    expect(makeInfo().canCreateLocalization).toBe(false);
    const info = makeInfo({
      affordances: { createLocalization: '/api/v1/app-infos/info-1/localizations' },
    });
    expect(info.canCreateLocalization).toBe(true);
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

  it('addLocalization inherits name and subtitle from the primary localization', () => {
    // Mirrors the iOS Mac app: a non-empty `name` is required by Apple's
    // create endpoint, so new locales default to the primary's content.
    const info = makeInfo();
    const added = info.addLocalization('fr-FR');
    expect(added.name).toBe('Bakery App');     // primary en-US name
    expect(added.subtitle).toBe('Fresh bread'); // primary en-US subtitle
  });

  it('addLocalization inherits privacy URLs from the primary localization', () => {
    const info = makeInfo();
    const added = info.addLocalization('fr-FR');
    expect(added.privacyPolicyUrl).toBe('https://example.com/privacy');
  });

  it('addLocalization with explicit init overrides the primary fallback', () => {
    const info = makeInfo();
    const added = info.addLocalization('fr-FR', { name: 'Boulangerie', subtitle: null });
    expect(added.name).toBe('Boulangerie');
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

  // ── Pending removals (staged delete) ──

  it('pendingRemovals starts empty', () => {
    expect(makeInfo().pendingRemovals).toEqual([]);
  });

  it('pendingRemovals lists saved locales staged for removal', () => {
    const info = makeInfo();
    info.removeLocalization('de-DE');
    expect(info.pendingRemovals.map((l) => l.locale)).toEqual(['de-DE']);
  });

  it('pendingRemovals does NOT include locales that were never saved', () => {
    const info = makeInfo();
    info.addLocalization('fr-FR');
    info.removeLocalization('fr-FR');
    expect(info.pendingRemovals).toEqual([]);
  });

  it('restoreLocalization pulls a pending removal back into the live list', () => {
    const info = makeInfo();
    info.removeLocalization('de-DE');
    info.restoreLocalization('de-DE');

    expect(info.pendingRemovals).toEqual([]);
    expect(info.localizationFor('de-DE')).toBeDefined();
    expect(info.localizationFor('de-DE')!.name).toBe('Bäckerei');
  });

  it('restoreLocalization is a no-op for locales that are not pending', () => {
    const info = makeInfo();
    info.restoreLocalization('zz-ZZ');
    expect(info.pendingRemovals).toEqual([]);
    expect(info.hasUnsavedChanges).toBe(false);
  });

  it('restoring a pending removal returns the AppInfo to a clean state', () => {
    const info = makeInfo();
    info.removeLocalization('de-DE');
    expect(info.hasUnsavedChanges).toBe(true);
    info.restoreLocalization('de-DE');
    expect(info.hasUnsavedChanges).toBe(false);
  });

  // ── availableLocalesToAdd ──

  it('availableLocalesToAdd excludes the locales currently on the AppInfo', () => {
    const info = makeInfo();
    const codes = info.availableLocalesToAdd.map((l) => l.code);
    expect(codes).not.toContain('en-US');
    expect(codes).not.toContain('de-DE');
    expect(codes).toContain('fr-FR');
    expect(codes).toContain('ja');
  });

  it('availableLocalesToAdd shrinks after addLocalization', () => {
    const info = makeInfo();
    const before = info.availableLocalesToAdd.length;
    info.addLocalization('fr-FR');
    expect(info.availableLocalesToAdd).toHaveLength(before - 1);
    expect(info.availableLocalesToAdd.map((l) => l.code)).not.toContain('fr-FR');
  });

  it('availableLocalesToAdd grows back after removeLocalization', () => {
    const info = makeInfo();
    info.addLocalization('fr-FR');
    const after = info.availableLocalesToAdd.length;
    info.removeLocalization('fr-FR');
    expect(info.availableLocalesToAdd).toHaveLength(after + 1);
    expect(info.availableLocalesToAdd.map((l) => l.code)).toContain('fr-FR');
  });

  it('availableLocalesToAdd entries carry the human display name', () => {
    const info = makeInfo();
    const ja = info.availableLocalesToAdd.find((l) => l.code === 'ja');
    expect(ja?.displayName).toBe('Japanese');
  });

  it('hasUnsavedChanges is true when a child localization is dirty', () => {
    const info = makeInfo();
    info.localizationFor('en-US')!.setName('Edited');
    expect(info.hasUnsavedChanges).toBe(true);
  });

  // ── Discard ──

  it('discard restores category-level fields', () => {
    const info = makeInfo();
    info.setPrimaryCategory('PRODUCTIVITY');
    info.setContentRightsDeclaration('USES_THIRD_PARTY_CONTENT');

    info.discard();

    expect(info.primaryCategoryId).toBe('FOOD_AND_DRINK');
    expect(info.contentRightsDeclaration).toBeNull();
    expect(info.hasUnsavedChanges).toBe(false);
  });

  it('discard restores privacy URLs via the primary localization', () => {
    const info = makeInfo();
    info.setPrivacyPolicyUrl('https://edited.test/p');

    info.discard();

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

  // ── Save orchestration ──

  it('save patches categories when category-level fields changed', async () => {
    const repo = stubRepo();
    const info = makeInfo();
    info.setRepository(repo);
    info.setPrimaryCategory('PRODUCTIVITY');

    await info.save();

    expect(repo.saveCategories).toHaveBeenCalledWith(info);
    expect(info.hasUnsavedChanges).toBe(false);
  });

  it('save does not patch categories when only a localization changed', async () => {
    const repo = stubRepo();
    const info = makeInfo();
    info.setRepository(repo);
    info.localizationFor('en-US')!.setName('Edited');

    await info.save();

    expect(repo.saveCategories).not.toHaveBeenCalled();
    expect(repo.saveLocalization).toHaveBeenCalledWith(info.localizationFor('en-US'));
    expect(info.hasUnsavedChanges).toBe(false);
  });

  it('save patches each existing dirty localization', async () => {
    const repo = stubRepo();
    const info = makeInfo();
    info.setRepository(repo);
    info.localizationFor('en-US')!.setName('Edited EN');
    info.localizationFor('de-DE')!.setSubtitle('Edited DE');

    await info.save();

    expect(repo.saveLocalization).toHaveBeenCalledTimes(2);
    expect(info.localizationFor('en-US')!.hasUnsavedChanges).toBe(false);
    expect(info.localizationFor('de-DE')!.hasUnsavedChanges).toBe(false);
  });

  it('save posts newly-added localizations and backfills the returned id', async () => {
    const createLocalization = vi.fn().mockResolvedValue({
      id: 'loc-fr-100',
      affordances: {
        updateLocalization: '/api/v1/app-info-localizations/loc-fr-100',
        delete: '/api/v1/app-info-localizations/loc-fr-100',
      },
    });
    const repo = stubRepo({ createLocalization });
    const info = makeInfo();
    info.setRepository(repo);
    const added = info.addLocalization('fr-FR', { name: 'Boulangerie' });

    await info.save();

    expect(createLocalization).toHaveBeenCalledWith(info, added);
    expect(added.id).toBe('loc-fr-100');
    expect(added.hasUnsavedChanges).toBe(false);
    // New locales go through createLocalization, not saveLocalization.
    expect(repo.saveLocalization).not.toHaveBeenCalled();
    // Affordances from the POST response land on the new loc so a follow-up
    // edit in the same session can PATCH without a page refresh.
    expect(added.canUpdate).toBe(true);
    expect(added.canDelete).toBe(true);
  });

  it('save backfills affordances onto a newly-created locale so it can save itself next time', async () => {
    const createLocalization = vi.fn().mockResolvedValue({
      id: 'loc-fr-200',
      affordances: {
        updateLocalization: '/api/v1/app-info-localizations/loc-fr-200',
      },
    });
    const saveLocalization = vi.fn().mockResolvedValue(undefined);
    const repo = stubRepo({ createLocalization, saveLocalization });
    const info = makeInfo();
    info.setRepository(repo);
    const added = info.addLocalization('fr-FR', { name: 'Boulangerie' });

    // First save → POST creates the resource + seeds affordances.
    await info.save();

    // Second edit + save → PATCH fires on the same instance.
    added.setSubtitle('Du pain frais');
    await info.save();

    expect(saveLocalization).toHaveBeenCalledTimes(1);
    expect(saveLocalization).toHaveBeenCalledWith(added);
  });

  it('save deletes locales that were removed after the last save', async () => {
    const repo = stubRepo();
    const info = makeInfo();
    info.setRepository(repo);
    const de = info.localizationFor('de-DE')!;
    info.removeLocalization('de-DE');

    await info.save();

    expect(repo.deleteLocalization).toHaveBeenCalledWith(de);
    expect(info.hasUnsavedChanges).toBe(false);
  });

  it('save skips delete for locales added and removed before save', async () => {
    const repo = stubRepo();
    const info = makeInfo();
    info.setRepository(repo);
    info.addLocalization('fr-FR');
    info.removeLocalization('fr-FR');

    await info.save();

    expect(repo.deleteLocalization).not.toHaveBeenCalled();
    expect(repo.createLocalization).not.toHaveBeenCalled();
  });

  it('save propagates errors and keeps the dirty state', async () => {
    const repo = stubRepo({
      saveCategories: vi.fn().mockRejectedValue(new Error('boom')),
    });
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

  // ── appStoreAgeRating (read-only, hydrated from backend) ──

  it('accepts appStoreAgeRating in the constructor init', () => {
    const info = makeInfo({ appStoreAgeRating: 'FOUR_PLUS' });
    expect(info.appStoreAgeRating).toBe('FOUR_PLUS');
  });

  it('appStoreAgeRating defaults to undefined when not provided', () => {
    const info = makeInfo();
    expect(info.appStoreAgeRating).toBeUndefined();
  });

  it('fromJSON hydrates appStoreAgeRating from backend payload', () => {
    const info = AppInfo.fromJSON({
      id: 'info-1',
      appId: 'app-1',
      primaryLocale: 'en-US',
      appStoreAgeRating: 'TWELVE_PLUS',
      localizations: [],
    });
    expect(info.appStoreAgeRating).toBe('TWELVE_PLUS');
  });

  it('appStoreAgeRating is not part of dirty tracking', () => {
    const info = makeInfo({ appStoreAgeRating: 'FOUR_PLUS' });
    expect(info.hasUnsavedChanges).toBe(false);
  });

  // ── Hydration ──

  it('fromJSON hydrates info and its localizations', () => {
    const info = AppInfo.fromJSON({
      id: 'info-2',
      appId: 'app-9',
      primaryCategoryId: 'UTILITIES',
      secondaryCategoryId: null,
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

  it('fromJSON hydrates per-localization privacy URLs', () => {
    const info = AppInfo.fromJSON({
      id: 'info-3',
      appId: 'app-9',
      primaryLocale: 'en-US',
      localizations: [
        {
          id: 'loc-x',
          locale: 'en-US',
          name: 'Thing',
          subtitle: null,
          privacyPolicyUrl: 'https://x.test/p',
          privacyChoicesUrl: 'https://x.test/c',
        },
      ],
    });
    expect(info.privacyPolicyUrl).toBe('https://x.test/p');
    expect(info.privacyChoicesUrl).toBe('https://x.test/c');
  });
});
