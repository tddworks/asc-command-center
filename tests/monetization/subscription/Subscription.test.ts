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
import { SubscriptionPricePoint } from '../../../src/monetization/subscription/SubscriptionPricePoint.ts';
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
    createOfferCode: vi.fn(),
    createIntroductoryOffer: vi.fn(),
    deleteIntroductoryOffer: vi.fn().mockResolvedValue(undefined),
    createPromotionalOffer: vi.fn(),
    deletePromotionalOffer: vi.fn().mockResolvedValue(undefined),
    setPrices: vi.fn().mockResolvedValue(undefined),
    pricePoints: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    equalizations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    winBackOffers: vi.fn().mockResolvedValue([]),
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

  it('canViewPricing accepts either getPriceSchedule or listPricePoints affordance', () => {
    expect(new Subscription(subInit({ affordances: { getPriceSchedule: '/x' } })).canViewPricing).toBe(true);
    // Backend currently advertises only listPricePoints on the subscription
    // listing — the price-schedule endpoint exists at the standard path.
    expect(new Subscription(subInit({ affordances: { listPricePoints: '/x' } })).canViewPricing).toBe(true);
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

  // ── createIntroductoryOffer / deleteIntroductoryOffer ──

  it('canCreateIntroductoryOffer maps to the createIntroductoryOffer affordance', () => {
    expect(new Subscription(subInit({ affordances: { createIntroductoryOffer: '/x' } })).canCreateIntroductoryOffer).toBe(true);
    expect(new Subscription(subInit({ affordances: {} })).canCreateIntroductoryOffer).toBe(false);
  });

  it('createIntroductoryOffer appends the offer to the list', async () => {
    const created = new SubscriptionIntroductoryOffer({
      id: 'i-new',
      offerMode: OfferMode.FreeTrial,
      duration: SubscriptionDuration.OneWeek,
      numberOfPeriods: 1,
    });
    const repo = stubRepo({ createIntroductoryOffer: vi.fn().mockResolvedValue(created) });
    const sub = new Subscription(subInit({ affordances: { createIntroductoryOffer: '/x' } }), repo);

    const result = await sub.createIntroductoryOffer({
      offerMode: OfferMode.FreeTrial,
      duration: SubscriptionDuration.OneWeek,
      numberOfPeriods: 1,
    });

    expect(result).toBe(created);
    expect(sub.introductoryOffers).toContain(created);
  });

  it('deleteIntroductoryOffer prunes the offer from the list', async () => {
    const a = new SubscriptionIntroductoryOffer({
      id: 'i-1', offerMode: OfferMode.FreeTrial,
      duration: SubscriptionDuration.OneWeek, numberOfPeriods: 1,
    });
    const b = new SubscriptionIntroductoryOffer({
      id: 'i-2', offerMode: OfferMode.PayAsYouGo,
      duration: SubscriptionDuration.OneMonth, numberOfPeriods: 3,
    });
    const repo = stubRepo({ introductoryOffers: vi.fn().mockResolvedValue([a, b]) });
    const sub = new Subscription(subInit({ affordances: { listIntroductoryOffers: '/x' } }), repo);
    await sub.loadIntroductoryOffers();

    await sub.deleteIntroductoryOffer(a);

    expect(repo.deleteIntroductoryOffer).toHaveBeenCalledWith(a);
    expect(sub.introductoryOffers).toEqual([b]);
  });

  // ── createPromotionalOffer / deletePromotionalOffer ──

  it('canCreatePromotionalOffer maps to the createPromotionalOffer affordance', () => {
    expect(new Subscription(subInit({ affordances: { createPromotionalOffer: '/x' } })).canCreatePromotionalOffer).toBe(true);
    expect(new Subscription(subInit({ affordances: {} })).canCreatePromotionalOffer).toBe(false);
  });

  it('createPromotionalOffer appends the offer to the list', async () => {
    const created = new SubscriptionPromotionalOffer({
      id: 'p-new', name: 'Holiday', offerCode: 'HOLIDAY',
      offerMode: OfferMode.PayAsYouGo,
      duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1,
    });
    const repo = stubRepo({ createPromotionalOffer: vi.fn().mockResolvedValue(created) });
    const sub = new Subscription(subInit({ affordances: { createPromotionalOffer: '/x' } }), repo);

    const result = await sub.createPromotionalOffer({
      name: 'Holiday', offerCode: 'HOLIDAY',
      offerMode: OfferMode.PayAsYouGo,
      duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1,
    });

    expect(result).toBe(created);
    expect(sub.promotionalOffers).toContain(created);
  });

  it('deletePromotionalOffer prunes the offer from the list', async () => {
    const a = new SubscriptionPromotionalOffer({
      id: 'p-1', name: 'A', offerCode: 'A',
      offerMode: OfferMode.PayAsYouGo,
      duration: SubscriptionDuration.OneMonth, numberOfPeriods: 1,
    });
    const repo = stubRepo({ promotionalOffers: vi.fn().mockResolvedValue([a]) });
    const sub = new Subscription(subInit({ affordances: { listPromotionalOffers: '/x' } }), repo);
    await sub.loadPromotionalOffers();

    await sub.deletePromotionalOffer(a);

    expect(repo.deletePromotionalOffer).toHaveBeenCalledWith(a);
    expect(sub.promotionalOffers).toEqual([]);
  });

  // ── createOfferCode ──

  it('canCreateOfferCode maps to the createOfferCode affordance', () => {
    expect(new Subscription(subInit({ affordances: { createOfferCode: '/x' } })).canCreateOfferCode).toBe(true);
    expect(new Subscription(subInit({ affordances: {} })).canCreateOfferCode).toBe(false);
  });

  it('createOfferCode appends the created code to the list', async () => {
    const created = new SubscriptionOfferCode({
      id: 'sc-new', name: 'WIN',
      offerMode: OfferMode.FreeTrial,
      duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1,
      customerEligibilities: [SubscriptionCustomerEligibility.New],
      isActive: true,
    });
    const createOfferCode = vi.fn().mockResolvedValue(created);
    const repo = stubRepo({ createOfferCode });
    const sub = new Subscription(subInit({ affordances: { createOfferCode: '/x' } }), repo);

    const result = await sub.createOfferCode({
      name: 'WIN',
      offerMode: OfferMode.FreeTrial,
      duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1,
      customerEligibilities: [SubscriptionCustomerEligibility.New],
    });

    expect(result).toBe(created);
    expect(sub.offerCodes).toContain(created);
  });

  it('createOfferCode throws when affordance missing', async () => {
    const repo = stubRepo();
    const sub = new Subscription(subInit({ affordances: {} }), repo);

    await expect(sub.createOfferCode({
      name: 'X',
      offerMode: OfferMode.FreeTrial,
      duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1,
      customerEligibilities: [],
    })).rejects.toThrow(/cannot create offer code/);
    expect(repo.createOfferCode).not.toHaveBeenCalled();
  });

  // ── Price-point picker ──

  it('loadPricePoints passes territory + cursor + limit to the repo', async () => {
    const items = [new SubscriptionPricePoint({ id: 'pp-1', territoryId: 'USA', formattedPrice: '$0.99', currency: 'USD', proceeds: '$0.69' })];
    const pricePoints = vi.fn().mockResolvedValue({ items, nextCursor: 'CURSOR-2' });
    const repo = stubRepo({ pricePoints });
    const sub = new Subscription(subInit({ affordances: { setPrices: '/x' } }), repo);

    const page = await sub.loadPricePoints({ territoryId: 'USA', cursor: 'CURSOR-1', limit: 25 });

    expect(pricePoints).toHaveBeenCalledWith(sub, { territoryId: 'USA', cursor: 'CURSOR-1', limit: 25 });
    expect(page.items).toBe(items);
    expect(page.nextCursor).toBe('CURSOR-2');
  });

  it('loadEqualizations passes pricePointId + cursor to the repo', async () => {
    const equalizations = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const repo = stubRepo({ equalizations });
    const sub = new Subscription(subInit({ affordances: { setPrices: '/x' } }), repo);

    await sub.loadEqualizations({ pricePointId: 'pp-anchor', cursor: null });

    expect(equalizations).toHaveBeenCalledWith(sub, { pricePointId: 'pp-anchor', cursor: null });
  });

  // ── setPrices ──

  it('canSetPrices maps to the setPrices affordance', () => {
    expect(new Subscription(subInit({ affordances: { setPrices: '/x' } })).canSetPrices).toBe(true);
    expect(new Subscription(subInit({ affordances: {} })).canSetPrices).toBe(false);
  });

  it('setPrices calls repo.setPrices with the input list then refetches the schedule', async () => {
    const sched = SubscriptionPriceSchedule.fromJSON({ territoryPrices: [] });
    const setPrices = vi.fn().mockResolvedValue(undefined);
    const priceSchedule = vi.fn().mockResolvedValue(sched);
    const repo = stubRepo({ setPrices, priceSchedule });
    const sub = new Subscription(subInit({
      affordances: { setPrices: '/x', getPriceSchedule: '/y' },
    }), repo);

    const input = [{ territoryId: 'USA', pricePointId: 'pp-usa-9-99' }];
    await sub.setPrices(input);

    expect(setPrices).toHaveBeenCalledWith(sub, input);
    expect(priceSchedule).toHaveBeenCalledWith(sub);
    expect(sub.priceSchedule).toBe(sched);
    expect(sub.isPriceScheduleLoaded).toBe(true);
  });

  it('setPrices throws when canSetPrices is false', async () => {
    const repo = stubRepo();
    const sub = new Subscription(subInit({ affordances: {} }), repo);

    await expect(sub.setPrices([{ territoryId: 'USA', pricePointId: 'p' }])).rejects.toThrow(/cannot set prices/);
    expect(repo.setPrices).not.toHaveBeenCalled();
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
