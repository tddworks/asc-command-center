import { describe, it, expect, vi } from 'vitest';
import {
  WinBackOffer,
  WinBackPriority,
} from '../../../src/monetization/subscription/WinBackOffer.ts';
import {
  Subscription,
  SubscriptionPeriod,
  SubscriptionState,
  type SubscriptionInit,
} from '../../../src/monetization/subscription/Subscription.ts';
import { OfferMode, SubscriptionDuration } from '../../../src/monetization/subscription/SubscriptionOffers.ts';
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
    setPrices: vi.fn().mockResolvedValue(undefined),
    pricePoints: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    equalizations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
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
    isFamilySharable: false,
    state: SubscriptionState.Approved,
    affordances: {},
    ...overrides,
  };
}

describe('WinBackOffer', () => {

  it('summaryLabel renders mode + duration + periods', () => {
    const offer = new WinBackOffer({
      id: 'wb-1',
      referenceName: 'Q1 Win-back',
      offerMode: OfferMode.PayAsYouGo,
      duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 3,
      priority: WinBackPriority.High,
    });
    expect(offer.summaryLabel).toBe('Pay as You Go · 3 × 1 Month');
  });

  it('priorityLabel maps the enum', () => {
    expect(new WinBackOffer({
      id: 'wb-1', referenceName: 'X',
      offerMode: OfferMode.FreeTrial, duration: SubscriptionDuration.OneWeek,
      numberOfPeriods: 1, priority: WinBackPriority.High,
    }).priorityLabel).toBe('High');

    expect(new WinBackOffer({
      id: 'wb-2', referenceName: 'X',
      offerMode: OfferMode.FreeTrial, duration: SubscriptionDuration.OneWeek,
      numberOfPeriods: 1, priority: WinBackPriority.Normal,
    }).priorityLabel).toBe('Normal');
  });

  it('fromJSON tolerates `priority` aliases and missing periods', () => {
    const offer = WinBackOffer.fromJSON({
      id: 'wb-9',
      referenceName: 'Loyalty',
      offerMode: 'FREE_TRIAL',
      duration: 'ONE_MONTH',
      priority: 'HIGH',
    });
    expect(offer.referenceName).toBe('Loyalty');
    expect(offer.priority).toBe(WinBackPriority.High);
    expect(offer.numberOfPeriods).toBe(1);
  });
});

describe('Subscription + win-back offers', () => {

  it('canViewWinBackOffers requires both isApproved AND the affordance', () => {
    const approvedNoAffordance = new Subscription(subInit({ state: SubscriptionState.Approved, affordances: {} }));
    expect(approvedNoAffordance.canViewWinBackOffers).toBe(false);

    const unapprovedWithAffordance = new Subscription(subInit({
      state: SubscriptionState.MissingMetadata,
      affordances: { listWinBackOffers: '/x' },
    }));
    expect(unapprovedWithAffordance.canViewWinBackOffers).toBe(false);

    const ready = new Subscription(subInit({
      state: SubscriptionState.Approved,
      affordances: { listWinBackOffers: '/x' },
    }));
    expect(ready.canViewWinBackOffers).toBe(true);
  });

  it('loadWinBackOffers populates the list when canView is true', async () => {
    const offer = new WinBackOffer({
      id: 'wb-1', referenceName: 'Q1',
      offerMode: OfferMode.PayAsYouGo, duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 3, priority: WinBackPriority.High,
    });
    const winBackOffers = vi.fn().mockResolvedValue([offer]);
    const repo = stubRepo({ winBackOffers });
    const sub = new Subscription(subInit({
      state: SubscriptionState.Approved,
      affordances: { listWinBackOffers: '/x' },
    }), repo);

    await sub.loadWinBackOffers();

    expect(winBackOffers).toHaveBeenCalledWith(sub);
    expect(sub.winBackOffers).toEqual([offer]);
    expect(sub.isWinBackOffersLoaded).toBe(true);
  });

  it('loadWinBackOffers short-circuits to [] when canView is false', async () => {
    const repo = stubRepo();
    const sub = new Subscription(subInit({
      state: SubscriptionState.MissingMetadata,
      affordances: {},
    }), repo);

    const result = await sub.loadWinBackOffers();

    expect(result).toEqual([]);
    expect(sub.isWinBackOffersLoaded).toBe(true);
    expect(repo.winBackOffers).not.toHaveBeenCalled();
  });
});
