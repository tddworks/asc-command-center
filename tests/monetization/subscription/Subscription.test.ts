import { describe, it, expect, vi } from 'vitest';
import {
  Subscription,
  SubscriptionPeriod,
  SubscriptionState,
  type SubscriptionInit,
} from '../../../src/monetization/subscription/Subscription.ts';
import { SubscriptionLocalization } from '../../../src/monetization/subscription/SubscriptionLocalization.ts';
import { SubscriptionPriceSchedule } from '../../../src/monetization/subscription/SubscriptionPriceSchedule.ts';
import { SubscriptionReviewScreenshot } from '../../../src/monetization/subscription/SubscriptionReviewScreenshot.ts';
import { SubscriptionAvailability, SubscriptionTerritoryAvailability } from '../../../src/monetization/subscription/SubscriptionAvailability.ts';
import {
  OfferMode,
  SubscriptionDuration,
  SubscriptionIntroductoryOffer,
  SubscriptionPromotionalOffer,
  SubscriptionOfferCode,
  SubscriptionCustomerEligibility,
} from '../../../src/monetization/subscription/SubscriptionOffers.ts';
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
    promotionalOffers: vi.fn().mockResolvedValue([]),
    offerCodes: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function subInit(overrides: Partial<SubscriptionInit> = {}): SubscriptionInit {
  return {
    id: 'sub-1',
    groupId: 'sg-1',
    name: 'Premium Monthly',
    productId: 'com.example.premium.monthly',
    subscriptionPeriod: SubscriptionPeriod.OneMonth,
    isFamilySharable: true,
    state: SubscriptionState.Approved,
    affordances: {},
    ...overrides,
  };
}

describe('Subscription', () => {

  it('isApproved/isLive reflect APPROVED state', () => {
    expect(new Subscription(subInit()).isApproved).toBe(true);
    expect(new Subscription(subInit()).isLive).toBe(true);
    expect(new Subscription(subInit({ state: SubscriptionState.MissingMetadata })).isApproved).toBe(false);
  });

  it('isEditable additionally includes ReadyToSubmit (vs IAP)', () => {
    expect(new Subscription(subInit({ state: SubscriptionState.ReadyToSubmit })).isEditable).toBe(true);
    expect(new Subscription(subInit({ state: SubscriptionState.MissingMetadata })).isEditable).toBe(true);
    expect(new Subscription(subInit({ state: SubscriptionState.WaitingForReview })).isEditable).toBe(false);
  });

  it('canSubmit requires ReadyToSubmit AND submit affordance', () => {
    expect(new Subscription(subInit({
      state: SubscriptionState.ReadyToSubmit,
      affordances: { submit: '/x' },
    })).canSubmit).toBe(true);
    expect(new Subscription(subInit({ state: SubscriptionState.ReadyToSubmit })).canSubmit).toBe(false);
  });

  it('canUnsubmit requires hasSubmission AND unsubmit affordance', () => {
    expect(new Subscription(subInit({
      hasSubmission: true,
      affordances: { unsubmit: '/x' },
    })).canUnsubmit).toBe(true);
    expect(new Subscription(subInit({
      affordances: { unsubmit: '/x' },
    })).canUnsubmit).toBe(false);
  });

  it('periodLabel maps the enum to a label', () => {
    expect(new Subscription(subInit({ subscriptionPeriod: SubscriptionPeriod.OneMonth })).periodLabel).toBe('1 Month');
    expect(new Subscription(subInit({ subscriptionPeriod: SubscriptionPeriod.OneYear })).periodLabel).toBe('1 Year');
    expect(new Subscription(subInit({ subscriptionPeriod: SubscriptionPeriod.SixMonths })).periodLabel).toBe('6 Months');
  });

  it('statusLabel and statusTone map known states', () => {
    expect(new Subscription(subInit({ state: SubscriptionState.Approved })).statusTone).toBe('success');
    expect(new Subscription(subInit({ state: SubscriptionState.Rejected })).statusTone).toBe('danger');
    expect(new Subscription(subInit({ state: SubscriptionState.MissingMetadata })).statusLabel).toBe('Missing Metadata');
  });

  it('submit calls the repo and flips state to WaitingForReview', async () => {
    const repo = stubRepo();
    const sub = new Subscription(
      subInit({ state: SubscriptionState.ReadyToSubmit, affordances: { submit: '/x' } }),
      repo,
    );

    await sub.submit();

    expect(repo.submit).toHaveBeenCalledWith(sub);
    expect(sub.state).toBe(SubscriptionState.WaitingForReview);
    expect(sub.hasSubmission).toBe(true);
  });

  it('unsubmit calls the repo, clears submission, reverts state', async () => {
    const repo = stubRepo();
    const sub = new Subscription(
      subInit({
        state: SubscriptionState.WaitingForReview,
        hasSubmission: true,
        affordances: { unsubmit: '/x' },
      }),
      repo,
    );

    await sub.unsubmit();

    expect(repo.unsubmit).toHaveBeenCalledWith(sub);
    expect(sub.hasSubmission).toBe(false);
    expect(sub.state).toBe(SubscriptionState.ReadyToSubmit);
  });

  it('update applies the patch only after the repo call resolves', async () => {
    const repo = stubRepo();
    const sub = new Subscription(
      subInit({ state: SubscriptionState.MissingMetadata, affordances: { update: '/x' } }),
      repo,
    );

    await sub.update({
      name: 'Premium Monthly v2',
      subscriptionPeriod: SubscriptionPeriod.OneYear,
      isFamilySharable: false,
      groupLevel: 5,
      reviewNote: 'note',
    });

    expect(sub.name).toBe('Premium Monthly v2');
    expect(sub.subscriptionPeriod).toBe(SubscriptionPeriod.OneYear);
    expect(sub.isFamilySharable).toBe(false);
    expect(sub.groupLevel).toBe(5);
    expect(sub.reviewNote).toBe('note');
  });

  it('update throws when the subscription is not editable', async () => {
    const repo = stubRepo();
    const sub = new Subscription(
      subInit({ state: SubscriptionState.Approved, affordances: { update: '/x' } }),
      repo,
    );

    await expect(sub.update({ name: 'x' })).rejects.toThrow(/not editable/);
    expect(repo.update).not.toHaveBeenCalled();
  });

  // ── Localizations ──

  it('canViewLocalizations / canCreateLocalization map to affordances', () => {
    const open = new Subscription(subInit({ affordances: { listLocalizations: '/x', createLocalization: '/y' } }));
    expect(open.canViewLocalizations).toBe(true);
    expect(open.canCreateLocalization).toBe(true);

    const closed = new Subscription(subInit({ affordances: {} }));
    expect(closed.canViewLocalizations).toBe(false);
    expect(closed.canCreateLocalization).toBe(false);
  });

  it('loadLocalizations populates and attaches the repo', async () => {
    const en = new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'Premium', description: null });
    const repo = stubRepo({ localizations: vi.fn().mockResolvedValue([en]) });
    const sub = new Subscription(subInit({ affordances: { listLocalizations: '/x' } }), repo);

    await sub.loadLocalizations();

    expect(sub.localizations).toEqual([en]);
    expect(en.repository).toBe(repo);
    expect(sub.isLocalizationsLoaded).toBe(true);
  });

  it('addLocalization gates on affordance and appends', async () => {
    const created = new SubscriptionLocalization({ id: 'l-new', locale: 'de-DE', name: 'X', description: null });
    const repo = stubRepo({ createLocalization: vi.fn().mockResolvedValue(created) });
    const sub = new Subscription(subInit({ affordances: { createLocalization: '/x' } }), repo);

    const result = await sub.addLocalization({ locale: 'de-DE', name: 'X' });

    expect(result).toBe(created);
    expect(sub.localizations).toContain(created);
    expect(repo.createLocalization).toHaveBeenCalledWith(sub, { locale: 'de-DE', name: 'X' });
  });

  it('removeLocalization delegates to loc.delete and prunes the list', async () => {
    const a = new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'X', description: null, affordances: { delete: '/x' } });
    const b = new SubscriptionLocalization({ id: 'l-2', locale: 'fr-FR', name: 'X', description: null, affordances: { delete: '/y' } });
    const repo = stubRepo({ localizations: vi.fn().mockResolvedValue([a, b]) });
    const sub = new Subscription(subInit({ affordances: { listLocalizations: '/x' } }), repo);
    await sub.loadLocalizations();

    await sub.removeLocalization(a);

    expect(repo.deleteLocalization).toHaveBeenCalledWith(a);
    expect(sub.localizations).toEqual([b]);
  });

  it('completeLocalizationCount counts non-empty names', async () => {
    const a = new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'Premium', description: null });
    const b = new SubscriptionLocalization({ id: 'l-2', locale: 'fr-FR', name: '', description: null });
    const repo = stubRepo({ localizations: vi.fn().mockResolvedValue([a, b]) });
    const sub = new Subscription(subInit({ affordances: { listLocalizations: '/x' } }), repo);
    await sub.loadLocalizations();

    expect(sub.completeLocalizationCount).toBe(1);
    expect(sub.hasAnyCompleteLocalization).toBe(true);
  });

  // ── Pricing ──

  it('canViewPricing maps to the getPriceSchedule affordance', () => {
    expect(new Subscription(subInit({ affordances: { getPriceSchedule: '/x' } })).canViewPricing).toBe(true);
    expect(new Subscription(subInit({ affordances: {} })).canViewPricing).toBe(false);
  });

  it('loadPriceSchedule short-circuits to null when the affordance is missing', async () => {
    const repo = stubRepo();
    const sub = new Subscription(subInit({ affordances: {} }), repo);

    const result = await sub.loadPriceSchedule();

    expect(result).toBeNull();
    expect(sub.isPriceScheduleLoaded).toBe(true);
    expect(repo.priceSchedule).not.toHaveBeenCalled();
  });

  it('loadPriceSchedule populates priceSchedule from the repo', async () => {
    const sched = SubscriptionPriceSchedule.fromJSON({
      territoryPrices: [
        { territory: { id: 'USA', displayName: 'United States', currency: 'USD' }, customerPrice: '$9.99', pricePoint: { id: 'pp-1' } },
      ],
    });
    const repo = stubRepo({ priceSchedule: vi.fn().mockResolvedValue(sched) });
    const sub = new Subscription(subInit({ affordances: { getPriceSchedule: '/x' } }), repo);

    await sub.loadPriceSchedule();

    expect(sub.priceSchedule).toBe(sched);
    expect(sub.isPriceScheduleLoaded).toBe(true);
    expect(repo.priceSchedule).toHaveBeenCalledWith(sub);
  });

  // ── Review (notes + screenshot) ──

  it('updateReviewNote calls update with reviewNote and mutates locally', async () => {
    const repo = stubRepo();
    const sub = new Subscription(subInit({
      state: SubscriptionState.MissingMetadata,
      affordances: { update: '/x' },
    }), repo);

    await sub.updateReviewNote('Use code TESTING');

    expect(repo.update).toHaveBeenCalledWith(sub, { reviewNote: 'Use code TESTING' });
    expect(sub.reviewNote).toBe('Use code TESTING');
  });

  it('updateReviewNote throws when not editable', async () => {
    const repo = stubRepo();
    const sub = new Subscription(subInit({
      state: SubscriptionState.Approved,
      affordances: { update: '/x' },
    }), repo);

    await expect(sub.updateReviewNote('x')).rejects.toThrow(/cannot update review note/);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('canViewReviewScreenshot / canUploadReviewScreenshot map to affordances', () => {
    const open = new Subscription(subInit({
      affordances: { getReviewScreenshot: '/x', uploadReviewScreenshot: '/y' },
    }));
    expect(open.canViewReviewScreenshot).toBe(true);
    expect(open.canUploadReviewScreenshot).toBe(true);

    const closed = new Subscription(subInit({ affordances: {} }));
    expect(closed.canViewReviewScreenshot).toBe(false);
    expect(closed.canUploadReviewScreenshot).toBe(false);
  });

  it('loadReviewScreenshot short-circuits to null when affordance missing', async () => {
    const repo = stubRepo();
    const sub = new Subscription(subInit({ affordances: {} }), repo);

    const result = await sub.loadReviewScreenshot();

    expect(result).toBeNull();
    expect(sub.isReviewScreenshotLoaded).toBe(true);
    expect(repo.reviewScreenshot).not.toHaveBeenCalled();
  });

  it('loadReviewScreenshot populates from the repo', async () => {
    const shot = new SubscriptionReviewScreenshot({ id: 'shot-1', fileName: 'a.png', previewUrl: 'data:x' });
    const repo = stubRepo({ reviewScreenshot: vi.fn().mockResolvedValue(shot) });
    const sub = new Subscription(subInit({ affordances: { getReviewScreenshot: '/x' } }), repo);

    await sub.loadReviewScreenshot();

    expect(sub.reviewScreenshot).toBe(shot);
    expect(sub.isReviewScreenshotLoaded).toBe(true);
  });

  it('uploadReviewScreenshot replaces an existing screenshot (delete + upload)', async () => {
    const existing = new SubscriptionReviewScreenshot({ id: 'shot-1', fileName: 'old.png', previewUrl: 'data:x', affordances: { delete: '/d' } });
    const fresh = new SubscriptionReviewScreenshot({ id: 'shot-2', fileName: 'new.png', previewUrl: 'data:y' });
    const repo = stubRepo({
      reviewScreenshot: vi.fn().mockResolvedValue(existing),
      uploadReviewScreenshot: vi.fn().mockResolvedValue(fresh),
    });
    const sub = new Subscription(subInit({
      affordances: { getReviewScreenshot: '/x', uploadReviewScreenshot: '/y' },
    }), repo);
    await sub.loadReviewScreenshot();

    const file = new File(['x'], 'new.png', { type: 'image/png' });
    const result = await sub.uploadReviewScreenshot(file);

    expect(repo.deleteReviewScreenshot).toHaveBeenCalledWith(sub, existing);
    expect(repo.uploadReviewScreenshot).toHaveBeenCalledWith(sub, file);
    expect(result).toBe(fresh);
    expect(sub.reviewScreenshot).toBe(fresh);
  });

  it('uploadReviewScreenshot throws when affordance missing', async () => {
    const repo = stubRepo();
    const sub = new Subscription(subInit({ affordances: {} }), repo);
    await expect(sub.uploadReviewScreenshot(new File([''], 'a.png'))).rejects.toThrow(/cannot upload review screenshot/);
    expect(repo.uploadReviewScreenshot).not.toHaveBeenCalled();
  });

  it('deleteReviewScreenshot clears the screenshot on success', async () => {
    const shot = new SubscriptionReviewScreenshot({ id: 'shot-1', fileName: 'x.png', previewUrl: 'data:x', affordances: { delete: '/d' } });
    const repo = stubRepo({ reviewScreenshot: vi.fn().mockResolvedValue(shot) });
    const sub = new Subscription(subInit({ affordances: { getReviewScreenshot: '/x' } }), repo);
    await sub.loadReviewScreenshot();

    await sub.deleteReviewScreenshot();

    expect(repo.deleteReviewScreenshot).toHaveBeenCalledWith(sub, shot);
    expect(sub.reviewScreenshot).toBeNull();
  });

  it('deleteReviewScreenshot throws when no screenshot present', async () => {
    const repo = stubRepo();
    const sub = new Subscription(subInit(), repo);
    await expect(sub.deleteReviewScreenshot()).rejects.toThrow(/no review screenshot to delete/);
  });

  // ── Availability ──

  it('canViewAvailability / canSetAvailability map to affordances', () => {
    const open = new Subscription(subInit({ affordances: { getAvailability: '/x', setAvailability: '/y' } }));
    expect(open.canViewAvailability).toBe(true);
    expect(open.canSetAvailability).toBe(true);

    const closed = new Subscription(subInit({ affordances: {} }));
    expect(closed.canViewAvailability).toBe(false);
    expect(closed.canSetAvailability).toBe(false);
  });

  it('loadAvailability short-circuits to null when affordance missing', async () => {
    const repo = stubRepo();
    const sub = new Subscription(subInit({ affordances: {} }), repo);

    const result = await sub.loadAvailability();

    expect(result).toBeNull();
    expect(sub.isAvailabilityLoaded).toBe(true);
    expect(repo.availability).not.toHaveBeenCalled();
  });

  it('loadAvailability populates availability from the repo', async () => {
    const avail = new SubscriptionAvailability({
      availableInNewTerritories: false,
      territories: [new SubscriptionTerritoryAvailability({ territoryId: 'USA', territoryName: 'US', currency: 'USD', isAvailable: true })],
    });
    const repo = stubRepo({ availability: vi.fn().mockResolvedValue(avail) });
    const sub = new Subscription(subInit({ affordances: { getAvailability: '/x' } }), repo);

    await sub.loadAvailability();

    expect(sub.availability).toBe(avail);
    expect(sub.isAvailabilityLoaded).toBe(true);
  });

  it('saveAvailability calls repo.setAvailability with current state and clears dirty', async () => {
    const avail = new SubscriptionAvailability({
      availableInNewTerritories: false,
      territories: [
        new SubscriptionTerritoryAvailability({ territoryId: 'USA', territoryName: 'US', currency: 'USD', isAvailable: true }),
        new SubscriptionTerritoryAvailability({ territoryId: 'JPN', territoryName: 'Japan', currency: 'JPY', isAvailable: false }),
      ],
    });
    const repo = stubRepo({ availability: vi.fn().mockResolvedValue(avail) });
    const sub = new Subscription(subInit({
      affordances: { getAvailability: '/x', setAvailability: '/y' },
    }), repo);
    await sub.loadAvailability();

    avail.toggleTerritory('JPN');
    avail.setAvailableInNewTerritories(true);

    await sub.saveAvailability();

    expect(repo.setAvailability).toHaveBeenCalledWith(sub, {
      territoryIds: ['USA', 'JPN'],
      availableInNewTerritories: true,
    });
    expect(avail.isDirty).toBe(false);
  });

  it('saveAvailability throws when nothing is loaded', async () => {
    const repo = stubRepo();
    const sub = new Subscription(subInit({ affordances: { setAvailability: '/y' } }), repo);

    await expect(sub.saveAvailability()).rejects.toThrow(/no availability loaded/);
  });

  // ── Offers ──

  it('canViewIntroductoryOffers / canViewPromotionalOffers / canViewOfferCodes map to affordances', () => {
    const open = new Subscription(subInit({
      affordances: {
        listIntroductoryOffers: '/x',
        listPromotionalOffers: '/y',
        listOfferCodes: '/z',
      },
    }));
    expect(open.canViewIntroductoryOffers).toBe(true);
    expect(open.canViewPromotionalOffers).toBe(true);
    expect(open.canViewOfferCodes).toBe(true);

    const closed = new Subscription(subInit({ affordances: {} }));
    expect(closed.canViewIntroductoryOffers).toBe(false);
    expect(closed.canViewPromotionalOffers).toBe(false);
    expect(closed.canViewOfferCodes).toBe(false);
  });

  it('loadIntroductoryOffers populates the list and short-circuits on missing affordance', async () => {
    const offer = new SubscriptionIntroductoryOffer({
      id: 'i-1',
      offerMode: OfferMode.FreeTrial,
      duration: SubscriptionDuration.OneWeek,
      numberOfPeriods: 1,
    });
    const repo = stubRepo({ introductoryOffers: vi.fn().mockResolvedValue([offer]) });
    const sub = new Subscription(subInit({ affordances: { listIntroductoryOffers: '/x' } }), repo);

    await sub.loadIntroductoryOffers();
    expect(sub.introductoryOffers).toEqual([offer]);
    expect(sub.isIntroductoryOffersLoaded).toBe(true);

    const closedRepo = stubRepo();
    const closedSub = new Subscription(subInit({ affordances: {} }), closedRepo);
    await closedSub.loadIntroductoryOffers();
    expect(closedSub.introductoryOffers).toEqual([]);
    expect(closedRepo.introductoryOffers).not.toHaveBeenCalled();
  });

  it('loadPromotionalOffers populates the list', async () => {
    const offer = new SubscriptionPromotionalOffer({
      id: 'p-1',
      name: 'Holiday',
      offerCode: 'HOLIDAY',
      offerMode: OfferMode.PayUpFront,
      duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1,
    });
    const repo = stubRepo({ promotionalOffers: vi.fn().mockResolvedValue([offer]) });
    const sub = new Subscription(subInit({ affordances: { listPromotionalOffers: '/x' } }), repo);

    await sub.loadPromotionalOffers();
    expect(sub.promotionalOffers).toEqual([offer]);
    expect(sub.isPromotionalOffersLoaded).toBe(true);
  });

  it('loadOfferCodes populates the list', async () => {
    const code = new SubscriptionOfferCode({
      id: 'c-1', name: 'WELCOME',
      offerMode: OfferMode.FreeTrial,
      duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1,
      customerEligibilities: [SubscriptionCustomerEligibility.New],
      isActive: true,
    });
    const repo = stubRepo({ offerCodes: vi.fn().mockResolvedValue([code]) });
    const sub = new Subscription(subInit({ affordances: { listOfferCodes: '/x' } }), repo);

    await sub.loadOfferCodes();
    expect(sub.offerCodes).toEqual([code]);
    expect(sub.isOfferCodesLoaded).toBe(true);
  });

  it('suggestedProductId derives a com.bundle.<slug> shape', () => {
    expect(Subscription.suggestedProductId('com.example.app', 'Premium Monthly'))
      .toBe('com.example.premium_monthly');
    expect(Subscription.suggestedProductId('com.example.app', '')).toBe('com.example.app');
  });

  it('fromJSON tolerates `referenceName`/`subscriptionGroupId` aliases', () => {
    const sub = Subscription.fromJSON({
      id: 'sub-9',
      subscriptionGroupId: 'sg-2',
      referenceName: 'Pro',
      productId: 'com.example.pro',
      subscriptionPeriod: 'ONE_YEAR',
      isFamilySharable: true,
      state: 'APPROVED',
    });

    expect(sub.id).toBe('sub-9');
    expect(sub.groupId).toBe('sg-2');
    expect(sub.name).toBe('Pro');
    expect(sub.subscriptionPeriod).toBe('ONE_YEAR');
    expect(sub.isFamilySharable).toBe(true);
  });
});
