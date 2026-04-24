import { describe, it, expect, vi } from 'vitest';
import {
  AgeRatingDeclaration,
  ContentFrequency,
  AgeRatingOverride,
  KidsAgeBand,
  AppStoreAgeRating,
} from '../../../src/app-catalog/age-rating/AgeRatingDeclaration.ts';
import type { AgeRatingDeclarationRepository } from '../../../src/app-catalog/age-rating/AgeRatingDeclarationRepository.ts';

function stubRepo(overrides: Partial<AgeRatingDeclarationRepository> = {}): AgeRatingDeclarationRepository {
  return {
    get: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function make(overrides: Partial<ConstructorParameters<typeof AgeRatingDeclaration>[0]> = {}): AgeRatingDeclaration {
  return new AgeRatingDeclaration({
    id: 'decl-1',
    ...overrides,
  });
}

describe('AgeRatingDeclaration', () => {

  // ── Construction defaults ──

  it('defaults every answerable field to null', () => {
    const d = make();
    expect(d.isParentalControls).toBeNull();
    expect(d.profanityOrCrudeHumor).toBeNull();
    expect(d.ageRatingOverrideV2).toBeNull();
    expect(d.kidsAgeBand).toBeNull();
    expect(d.developerAgeRatingInfoURL).toBeNull();
  });

  it('hasAnyAnswer is false for a pristine declaration', () => {
    expect(make().hasAnyAnswer).toBe(false);
  });

  it('hasAnyAnswer flips true once any field is set', () => {
    const d = make();
    d.isParentalControls = true;
    expect(d.hasAnyAnswer).toBe(true);
  });

  // ── Display ──

  it('displayRating defaults to FOUR_PLUS when not computed yet', () => {
    expect(make().displayRating).toBe(AppStoreAgeRating.FourPlus);
  });

  it('displayRating reflects the backend-computed rating', () => {
    const d = make({ appStoreAgeRating: AppStoreAgeRating.TwelvePlus });
    expect(d.displayRating).toBe(AppStoreAgeRating.TwelvePlus);
  });

  // ── Capability ──

  it('canUpdate is true when updateAgeRatingDeclaration affordance is present', () => {
    const d = make({ affordances: { updateAgeRatingDeclaration: '/api/v1/age-rating-declarations/d-1' } });
    expect(d.canUpdate).toBe(true);
    expect(d.updateUrl).toBe('/api/v1/age-rating-declarations/d-1');
  });

  it('canUpdate accepts the shorter update variant', () => {
    const d = make({ affordances: { update: '/api/v1/x' } });
    expect(d.canUpdate).toBe(true);
    expect(d.updateUrl).toBe('/api/v1/x');
  });

  it('canUpdate is false when no mutation affordance is present', () => {
    expect(make().canUpdate).toBe(false);
    expect(make().updateUrl).toBeNull();
  });

  // ── Coupled setters (override vs. kids band) ──

  it('chooseOverrideV2 clears legacy override and kids band', () => {
    const d = make({
      ageRatingOverride: AgeRatingOverride.NinePlus,
      kidsAgeBand: KidsAgeBand.SixToEight,
    });
    d.chooseOverrideV2(AgeRatingOverride.TwelvePlus);
    expect(d.ageRatingOverrideV2).toBe(AgeRatingOverride.TwelvePlus);
    expect(d.ageRatingOverride).toBeNull();
    expect(d.kidsAgeBand).toBeNull();
  });

  it('chooseKidsAgeBand sets override V2 to NONE and clears legacy', () => {
    const d = make({ ageRatingOverride: AgeRatingOverride.NinePlus });
    d.chooseKidsAgeBand(KidsAgeBand.NineToEleven);
    expect(d.kidsAgeBand).toBe(KidsAgeBand.NineToEleven);
    expect(d.ageRatingOverrideV2).toBe(AgeRatingOverride.None);
    expect(d.ageRatingOverride).toBeNull();
  });

  it('clearAgeCategory resets all three mutually-exclusive fields', () => {
    const d = make({
      ageRatingOverrideV2: AgeRatingOverride.SeventeenPlus,
      kidsAgeBand: KidsAgeBand.FiveAndUnder,
    });
    d.clearAgeCategory();
    expect(d.ageRatingOverrideV2).toBe(AgeRatingOverride.None);
    expect(d.ageRatingOverride).toBeNull();
    expect(d.kidsAgeBand).toBeNull();
  });

  // ── Dirty tracking ──

  it('is not dirty on construction', () => {
    expect(make().hasUnsavedChanges).toBe(false);
  });

  it('flips dirty when a boolean field changes', () => {
    const d = make();
    d.isParentalControls = true;
    expect(d.hasUnsavedChanges).toBe(true);
  });

  it('flips dirty when a frequency field changes', () => {
    const d = make();
    d.profanityOrCrudeHumor = ContentFrequency.InfrequentMild;
    expect(d.hasUnsavedChanges).toBe(true);
  });

  it('flips dirty when ageRatingOverrideV2 changes', () => {
    const d = make();
    d.chooseOverrideV2(AgeRatingOverride.TwelvePlus);
    expect(d.hasUnsavedChanges).toBe(true);
  });

  it('discard restores the snapshot', () => {
    const d = make({ isGambling: false });
    d.isGambling = true;
    d.profanityOrCrudeHumor = ContentFrequency.FrequentIntense;

    d.discard();

    expect(d.isGambling).toBe(false);
    expect(d.profanityOrCrudeHumor).toBeNull();
    expect(d.hasUnsavedChanges).toBe(false);
  });

  it('markSaved promotes current values into the snapshot', () => {
    const d = make();
    d.isLootBox = true;
    d.markSaved();
    expect(d.hasUnsavedChanges).toBe(false);
    d.isLootBox = false;
    d.discard();
    expect(d.isLootBox).toBe(true);
  });

  // ── Save ──

  it('save delegates to repository.update and clears dirty', async () => {
    const repo = stubRepo();
    const d = make({ affordances: { updateAgeRatingDeclaration: '/x' } });
    d.setRepository(repo);
    d.isAdvertising = true;

    await d.save();

    expect(repo.update).toHaveBeenCalledWith(d);
    expect(d.hasUnsavedChanges).toBe(false);
  });

  it('save propagates errors and keeps dirty', async () => {
    const repo = stubRepo({ update: vi.fn().mockRejectedValue(new Error('boom')) });
    const d = make();
    d.setRepository(repo);
    d.isAdvertising = true;

    await expect(d.save()).rejects.toThrow('boom');
    expect(d.hasUnsavedChanges).toBe(true);
  });

  it('save throws without a repository', async () => {
    const d = make();
    d.isAdvertising = true;
    await expect(d.save()).rejects.toThrow(/no repository/i);
  });

  // ── Update payload ──

  it('toUpdatePayload sends V2 override and nulls the legacy override', () => {
    const d = make();
    d.chooseOverrideV2(AgeRatingOverride.TwelvePlus);
    const body = d.toUpdatePayload();
    expect(body.ageRatingOverrideV2).toBe(AgeRatingOverride.TwelvePlus);
    expect(body.ageRatingOverride).toBeNull();
  });

  it('toUpdatePayload sends the legacy override when V2 is untouched', () => {
    const d = make({ ageRatingOverride: AgeRatingOverride.NinePlus });
    const body = d.toUpdatePayload();
    expect(body.ageRatingOverride).toBe(AgeRatingOverride.NinePlus);
    expect('ageRatingOverrideV2' in body).toBe(false);
  });

  it('toUpdatePayload always includes every boolean + frequency key (null clears)', () => {
    const body = make().toUpdatePayload();
    expect(body.isParentalControls).toBeNull();
    expect(body.profanityOrCrudeHumor).toBeNull();
    expect(body.kidsAgeBand).toBeNull();
    expect(body.developerAgeRatingInfoURL).toBeNull();
  });

  // ── Hydration ──

  it('fromJSON hydrates every field including enums', () => {
    const d = AgeRatingDeclaration.fromJSON({
      id: 'decl-42',
      appStoreAgeRating: 'TWELVE_PLUS',
      isParentalControls: true,
      profanityOrCrudeHumor: 'INFREQUENT_OR_MILD',
      ageRatingOverrideV2: 'NINE_PLUS',
      kidsAgeBand: 'SIX_TO_EIGHT',
      developerAgeRatingInfoURL: 'https://example.com/rating',
      affordances: { updateAgeRatingDeclaration: '/api/v1/age-rating-declarations/decl-42' },
    });
    expect(d.id).toBe('decl-42');
    expect(d.appStoreAgeRating).toBe(AppStoreAgeRating.TwelvePlus);
    expect(d.isParentalControls).toBe(true);
    expect(d.profanityOrCrudeHumor).toBe(ContentFrequency.InfrequentMild);
    expect(d.ageRatingOverrideV2).toBe(AgeRatingOverride.NinePlus);
    expect(d.kidsAgeBand).toBe(KidsAgeBand.SixToEight);
    expect(d.developerAgeRatingInfoURL).toBe('https://example.com/rating');
    expect(d.canUpdate).toBe(true);
  });
});
