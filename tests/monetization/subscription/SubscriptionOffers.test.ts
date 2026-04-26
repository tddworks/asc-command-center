import { describe, it, expect } from 'vitest';
import {
  OfferMode,
  SubscriptionDuration,
  SubscriptionIntroductoryOffer,
  SubscriptionPromotionalOffer,
  SubscriptionOfferCode,
  SubscriptionCustomerEligibility,
} from '../../../src/monetization/subscription/SubscriptionOffers.ts';

describe('SubscriptionIntroductoryOffer', () => {
  it('isFreeTrial maps to the FREE_TRIAL mode', () => {
    expect(new SubscriptionIntroductoryOffer({
      id: 'i-1',
      offerMode: OfferMode.FreeTrial,
      duration: SubscriptionDuration.OneWeek,
      numberOfPeriods: 1,
    }).isFreeTrial).toBe(true);

    expect(new SubscriptionIntroductoryOffer({
      id: 'i-2',
      offerMode: OfferMode.PayAsYouGo,
      duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 3,
    }).isFreeTrial).toBe(false);
  });

  it('summaryLabel renders mode + duration + periods', () => {
    expect(new SubscriptionIntroductoryOffer({
      id: 'i-1',
      offerMode: OfferMode.FreeTrial,
      duration: SubscriptionDuration.OneWeek,
      numberOfPeriods: 1,
    }).summaryLabel).toBe('Free Trial · 1 Week');

    expect(new SubscriptionIntroductoryOffer({
      id: 'i-2',
      offerMode: OfferMode.PayAsYouGo,
      duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 3,
    }).summaryLabel).toBe('Pay as You Go · 3 × 1 Month');
  });

  it('fromJSON tolerates `mode` and `periods` aliases', () => {
    const offer = SubscriptionIntroductoryOffer.fromJSON({
      id: 'i-9',
      mode: 'FREE_TRIAL',
      duration: 'ONE_WEEK',
      periods: 1,
    });
    expect(offer.offerMode).toBe(OfferMode.FreeTrial);
    expect(offer.duration).toBe(SubscriptionDuration.OneWeek);
    expect(offer.numberOfPeriods).toBe(1);
  });
});

describe('SubscriptionPromotionalOffer', () => {
  it('summaryLabel includes name and identifier', () => {
    const offer = new SubscriptionPromotionalOffer({
      id: 'p-1',
      name: 'Holiday 2026',
      offerCode: 'HOLIDAY2026',
      offerMode: OfferMode.PayUpFront,
      duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1,
    });
    expect(offer.summaryLabel).toBe('Pay Up Front · 1 Month');
    expect(offer.identifier).toBe('HOLIDAY2026');
  });
});

describe('SubscriptionOfferCode', () => {
  it('eligibilityLabels maps the enum to human strings', () => {
    const code = new SubscriptionOfferCode({
      id: 'c-1',
      name: 'WELCOME',
      offerMode: OfferMode.FreeTrial,
      duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1,
      customerEligibilities: [
        SubscriptionCustomerEligibility.New,
        SubscriptionCustomerEligibility.Existing,
        SubscriptionCustomerEligibility.Expired,
      ],
      isActive: true,
    });
    expect(code.eligibilityLabels).toEqual(['New', 'Existing', 'Expired']);
  });

  it('isActive defaults to false when missing in payload', () => {
    const code = SubscriptionOfferCode.fromJSON({
      id: 'c-2',
      name: 'X',
      offerMode: 'FREE_TRIAL',
      duration: 'ONE_MONTH',
      numberOfPeriods: 1,
    });
    expect(code.isActive).toBe(false);
  });
});
