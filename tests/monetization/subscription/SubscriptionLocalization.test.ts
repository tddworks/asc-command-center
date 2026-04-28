import { describe, it, expect, vi } from 'vitest';
import {
  SubscriptionLocalization,
  SUBSCRIPTION_LOCALIZATION_NAME_LIMIT,
  SUBSCRIPTION_LOCALIZATION_DESCRIPTION_LIMIT,
} from '../../../src/monetization/subscription/SubscriptionLocalization.ts';
import type { SubscriptionRepository } from '../../../src/monetization/subscription/SubscriptionRepository.ts';

function stubRepo(overrides: Partial<SubscriptionRepository> = {}): SubscriptionRepository {
  return {
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    submit: vi.fn().mockResolvedValue(undefined),
    unsubmit: vi.fn().mockResolvedValue(undefined),
    localizations: vi.fn().mockResolvedValue([]),
    createLocalization: vi.fn(),
    saveLocalization: vi.fn().mockResolvedValue(undefined),
    deleteLocalization: vi.fn().mockResolvedValue(undefined),
    priceSchedule: vi.fn().mockResolvedValue(null),
    reviewScreenshot: vi.fn().mockResolvedValue(null),
    uploadReviewScreenshot: vi.fn(),
    deleteReviewScreenshot: vi.fn().mockResolvedValue(undefined),
    availability: vi.fn().mockResolvedValue(null),
    setAvailability: vi.fn().mockResolvedValue(undefined),
    introductoryOffers: vi.fn().mockResolvedValue([]),
    createIntroductoryOffer: vi.fn(),
    deleteIntroductoryOffer: vi.fn().mockResolvedValue(undefined),
    promotionalOffers: vi.fn().mockResolvedValue([]),
    createPromotionalOffer: vi.fn(),
    deletePromotionalOffer: vi.fn().mockResolvedValue(undefined),
    offerCodes: vi.fn().mockResolvedValue([]),
    createOfferCode: vi.fn(),
    setPrices: vi.fn().mockResolvedValue(undefined),
    pricePoints: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    equalizations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    winBackOffers: vi.fn().mockResolvedValue([]),
    deactivateOfferCode: vi.fn().mockResolvedValue(undefined),
    oneTimeUseCodes: vi.fn().mockResolvedValue([]),
    generateOneTimeUseCodes: vi.fn(),
    customCodes: vi.fn().mockResolvedValue([]),
    createCustomCode: vi.fn(),
    oneTimeUseCodeValues: vi.fn().mockResolvedValue(''),
    ...overrides,
  };
}

describe('SubscriptionLocalization', () => {

  it('isNew is true when id is empty', () => {
    expect(new SubscriptionLocalization({ id: '', locale: 'en-US', name: '', description: null }).isNew).toBe(true);
    expect(new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'X', description: null }).isNew).toBe(false);
  });

  it('isComplete requires non-empty trimmed name', () => {
    expect(new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: '   ', description: null }).isComplete).toBe(false);
    expect(new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'Premium', description: null }).isComplete).toBe(true);
  });

  it('nameRemaining and descriptionRemaining track remaining chars', () => {
    const loc = new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'Hello', description: 'World' });
    expect(loc.nameRemaining).toBe(SUBSCRIPTION_LOCALIZATION_NAME_LIMIT - 5);
    expect(loc.descriptionRemaining).toBe(SUBSCRIPTION_LOCALIZATION_DESCRIPTION_LIMIT - 5);
  });

  it('canUpdate / canDelete accept short and long affordance keys', () => {
    expect(new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'X', description: null, affordances: { update: '/x', delete: '/y' } }).canUpdate).toBe(true);
    expect(new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'X', description: null, affordances: { updateLocalization: '/x', deleteLocalization: '/y' } }).canDelete).toBe(true);
    expect(new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'X', description: null }).canUpdate).toBe(false);
  });

  it('hasUnsavedChanges flips after a setter and reverts via discard', () => {
    const loc = new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'Premium', description: 'Unlock' });
    expect(loc.hasUnsavedChanges).toBe(false);
    loc.setName('Modified');
    expect(loc.hasUnsavedChanges).toBe(true);
    loc.discard();
    expect(loc.name).toBe('Premium');
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  it('save calls repo.saveLocalization and clears dirty', async () => {
    const repo = stubRepo();
    const loc = new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'X', description: null });
    loc.setRepository(repo);
    loc.setName('Y');

    await loc.save();

    expect(repo.saveLocalization).toHaveBeenCalledWith(loc);
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  it('save throws when no repository attached', async () => {
    const loc = new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'X', description: null });
    await expect(loc.save()).rejects.toThrow(/no repository/);
  });

  it('delete calls repo.deleteLocalization', async () => {
    const repo = stubRepo();
    const loc = new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'X', description: null });
    loc.setRepository(repo);

    await loc.delete();

    expect(repo.deleteLocalization).toHaveBeenCalledWith(loc);
  });

  it('fromJSON tolerates missing description', () => {
    const loc = SubscriptionLocalization.fromJSON({ id: 'l-2', locale: 'fr-FR', name: 'X' });
    expect(loc.description).toBeNull();
  });
});
