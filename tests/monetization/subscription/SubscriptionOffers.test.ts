import { describe, it, expect, vi } from 'vitest';
import {
  OfferMode,
  SubscriptionDuration,
  SubscriptionIntroductoryOffer,
  SubscriptionPromotionalOffer,
  SubscriptionOfferCode,
  SubscriptionCustomerEligibility,
  SubscriptionOfferEligibility,
  SubscriptionCustomCode,
  SubscriptionOneTimeUseCodeBatch,
  CodeEnvironment,
} from '../../../src/monetization/subscription/SubscriptionOffers.ts';
import type { SubscriptionRepository } from '../../../src/monetization/subscription/SubscriptionRepository.ts';

function stubSubRepo(overrides: Partial<SubscriptionRepository> = {}): SubscriptionRepository {
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
    images: vi.fn().mockResolvedValue([]),
    uploadImage: vi.fn(),
    deleteImage: vi.fn().mockResolvedValue(undefined),
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
    deactivateOfferCode: vi.fn().mockResolvedValue(undefined),
    oneTimeUseCodes: vi.fn().mockResolvedValue([]),
    customCodes: vi.fn().mockResolvedValue([]),
    generateOneTimeUseCodes: vi.fn(),
    createCustomCode: vi.fn(),
    oneTimeUseCodeValues: vi.fn().mockResolvedValue(''),
    winBackOffers: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function batch(id: string, count: number, env: CodeEnvironment = CodeEnvironment.Production): SubscriptionOneTimeUseCodeBatch {
  return new SubscriptionOneTimeUseCodeBatch({
    id, numberOfCodes: count, environment: env, isActive: true,
  });
}

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
        SubscriptionCustomerEligibility.Lapsed,
        SubscriptionCustomerEligibility.WinBack,
        SubscriptionCustomerEligibility.PaidSubscriber,
      ],
      isActive: true,
    });
    expect(code.eligibilityLabels).toEqual(['New', 'Lapsed', 'Win-Back', 'Paid Subscriber']);
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

  // ── Identity / extended init ──

  it('exposes subscriptionId, autoRenewEnabled (default true), and offerEligibility', () => {
    const code = new SubscriptionOfferCode({
      id: 'c-3', subscriptionId: 'sub-1', name: 'X',
      offerMode: OfferMode.PayAsYouGo, duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1, customerEligibilities: [],
      offerEligibility: SubscriptionOfferEligibility.Stackable,
      isActive: true,
    });
    expect(code.subscriptionId).toBe('sub-1');
    expect(code.autoRenewEnabled).toBe(true);
    expect(code.offerEligibility).toBe(SubscriptionOfferEligibility.Stackable);
  });

  it('autoRenewEnabled honours explicit false', () => {
    const code = new SubscriptionOfferCode({
      id: 'c-4', subscriptionId: 'sub-1', name: 'X',
      offerMode: OfferMode.FreeTrial, duration: SubscriptionDuration.OneWeek,
      numberOfPeriods: 1, customerEligibilities: [],
      isActive: true, autoRenewEnabled: false,
    });
    expect(code.autoRenewEnabled).toBe(false);
  });

  // ── Capability checks ──

  it('canDeactivate requires isActive AND deactivate affordance', () => {
    const live = new SubscriptionOfferCode({
      id: 'c-5', subscriptionId: 'sub-1', name: 'X',
      offerMode: OfferMode.FreeTrial, duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1, customerEligibilities: [],
      isActive: true, affordances: { deactivate: '/x' },
    });
    expect(live.canDeactivate).toBe(true);

    const inactive = new SubscriptionOfferCode({
      id: 'c-6', subscriptionId: 'sub-1', name: 'X',
      offerMode: OfferMode.FreeTrial, duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1, customerEligibilities: [],
      isActive: false, affordances: { deactivate: '/x' },
    });
    expect(inactive.canDeactivate).toBe(false);

    const noAffordance = new SubscriptionOfferCode({
      id: 'c-7', subscriptionId: 'sub-1', name: 'X',
      offerMode: OfferMode.FreeTrial, duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1, customerEligibilities: [],
      isActive: true,
    });
    expect(noAffordance.canDeactivate).toBe(false);
  });

  it('redemptionUrl substitutes appId from affordances', () => {
    const code = new SubscriptionOfferCode({
      id: 'c-8', subscriptionId: 'sub-1', name: 'X',
      offerMode: OfferMode.FreeTrial, duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1, customerEligibilities: [],
      isActive: true, affordances: { appId: '1000000003' },
    });
    expect(code.redemptionUrl).toBe(
      'https://apps.apple.com/redeem?ctx=offercodes&id=1000000003&code=CODE',
    );
  });

  // ── Mutators ──

  it('loadOneTimeUseCodes asks the repo and stores the batch list', async () => {
    const list = [batch('b1', 100), batch('b2', 200, CodeEnvironment.Sandbox)];
    const repo = stubSubRepo({ oneTimeUseCodes: vi.fn().mockResolvedValue(list) });
    const code = new SubscriptionOfferCode({
      id: 'c-9', subscriptionId: 'sub-1', name: 'X',
      offerMode: OfferMode.FreeTrial, duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1, customerEligibilities: [], isActive: true,
    });
    code.setRepository(repo);

    await code.loadOneTimeUseCodes();

    expect(repo.oneTimeUseCodes).toHaveBeenCalledWith(code);
    expect(code.oneTimeUseCodes).toEqual(list);
    expect(code.isOneTimeUseCodesLoaded).toBe(true);
  });

  it('loadCustomCodes stores the result and flips the loaded flag', async () => {
    const customs = [
      new SubscriptionCustomCode({ id: 'cc1', customCode: 'WIN26', numberOfCodes: 50, isActive: true }),
    ];
    const repo = stubSubRepo({ customCodes: vi.fn().mockResolvedValue(customs) });
    const code = new SubscriptionOfferCode({
      id: 'c-10', subscriptionId: 'sub-1', name: 'X',
      offerMode: OfferMode.FreeTrial, duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1, customerEligibilities: [], isActive: true,
    });
    code.setRepository(repo);

    await code.loadCustomCodes();

    expect(repo.customCodes).toHaveBeenCalledWith(code);
    expect(code.customCodes).toEqual(customs);
    expect(code.isCustomCodesLoaded).toBe(true);
  });

  it('createCustomCode appends the created code to the list', async () => {
    const created = new SubscriptionCustomCode({
      id: 'cc-new', customCode: 'NEW', numberOfCodes: 10, isActive: true,
    });
    const repo = stubSubRepo({ createCustomCode: vi.fn().mockResolvedValue(created) });
    const code = new SubscriptionOfferCode({
      id: 'c-11', subscriptionId: 'sub-1', name: 'X',
      offerMode: OfferMode.FreeTrial, duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1, customerEligibilities: [], isActive: true,
    });
    code.setRepository(repo);

    const result = await code.createCustomCode({
      customCode: 'NEW', numberOfCodes: 10,
    });

    expect(result).toBe(created);
    expect(code.customCodes).toContain(created);
    expect(code.isCustomCodesLoaded).toBe(true);
  });

  it('generateOneTimeUseCodes appends the new batch', async () => {
    const created = batch('b-new', 500);
    const repo = stubSubRepo({ generateOneTimeUseCodes: vi.fn().mockResolvedValue(created) });
    const code = new SubscriptionOfferCode({
      id: 'c-12', subscriptionId: 'sub-1', name: 'X',
      offerMode: OfferMode.FreeTrial, duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1, customerEligibilities: [], isActive: true,
    });
    code.setRepository(repo);

    await code.generateOneTimeUseCodes({ count: 500, environment: CodeEnvironment.Production });

    expect(code.oneTimeUseCodes).toContain(created);
    expect(code.isOneTimeUseCodesLoaded).toBe(true);
  });

  it('deactivate flips isActive and calls repo.deactivateOfferCode', async () => {
    const repo = stubSubRepo();
    const code = new SubscriptionOfferCode({
      id: 'c-13', subscriptionId: 'sub-1', name: 'X',
      offerMode: OfferMode.FreeTrial, duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1, customerEligibilities: [],
      isActive: true, affordances: { deactivate: '/x' },
    });
    code.setRepository(repo);

    await code.deactivate();

    expect(repo.deactivateOfferCode).toHaveBeenCalledWith(code);
    expect(code.isActive).toBe(false);
  });

  it('deactivate throws when not active or affordance missing', async () => {
    const repo = stubSubRepo();
    const code = new SubscriptionOfferCode({
      id: 'c-14', subscriptionId: 'sub-1', name: 'X',
      offerMode: OfferMode.FreeTrial, duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1, customerEligibilities: [], isActive: false,
      affordances: { deactivate: '/x' },
    });
    code.setRepository(repo);
    await expect(code.deactivate()).rejects.toThrow(/cannot deactivate/);
    expect(repo.deactivateOfferCode).not.toHaveBeenCalled();
  });

  it('downloadCodes returns CSV with redemption URLs when appId is set', async () => {
    const repo = stubSubRepo({
      oneTimeUseCodeValues: vi.fn().mockResolvedValue('AAA\nBBB\nCCC'),
    });
    const code = new SubscriptionOfferCode({
      id: 'c-15', subscriptionId: 'sub-1', name: 'X',
      offerMode: OfferMode.FreeTrial, duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1, customerEligibilities: [],
      isActive: true, affordances: { appId: '111' },
    });
    code.setRepository(repo);
    const b = batch('b1', 3);

    const csv = await code.downloadCodes(b);
    expect(csv).toBe(
      'AAA,https://apps.apple.com/redeem?ctx=offercodes&id=111&code=AAA\n' +
      'BBB,https://apps.apple.com/redeem?ctx=offercodes&id=111&code=BBB\n' +
      'CCC,https://apps.apple.com/redeem?ctx=offercodes&id=111&code=CCC',
    );
    expect(repo.oneTimeUseCodeValues).toHaveBeenCalledWith(code, b);
  });

  it('downloadCodes returns raw CSV when appId affordance missing', async () => {
    const repo = stubSubRepo({
      oneTimeUseCodeValues: vi.fn().mockResolvedValue('XYZ\nQRS'),
    });
    const code = new SubscriptionOfferCode({
      id: 'c-16', subscriptionId: 'sub-1', name: 'X',
      offerMode: OfferMode.FreeTrial, duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1, customerEligibilities: [], isActive: true,
    });
    code.setRepository(repo);
    expect(await code.downloadCodes(batch('b1', 2))).toBe('XYZ\nQRS');
  });
});

// ── Children ──

describe('SubscriptionCustomCode', () => {
  it('fromJSON tolerates missing expiration and inherits defaults', () => {
    const c = SubscriptionCustomCode.fromJSON({
      id: 'cc1', customCode: 'BLACK26', numberOfCodes: 200, isActive: true,
    });
    expect(c.id).toBe('cc1');
    expect(c.customCode).toBe('BLACK26');
    expect(c.expirationDate).toBeNull();
  });
});

describe('SubscriptionOneTimeUseCodeBatch', () => {
  it('environmentLabel maps the enum to a human string', () => {
    expect(new SubscriptionOneTimeUseCodeBatch({
      id: 'b1', numberOfCodes: 100, environment: CodeEnvironment.Production, isActive: true,
    }).environmentLabel).toBe('Production');
    expect(new SubscriptionOneTimeUseCodeBatch({
      id: 'b2', numberOfCodes: 10, environment: CodeEnvironment.Sandbox, isActive: true,
    }).environmentLabel).toBe('Sandbox');
  });
});
