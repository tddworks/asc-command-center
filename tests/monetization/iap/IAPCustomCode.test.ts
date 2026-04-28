import { describe, it, expect, vi } from 'vitest';
import { IAPCustomCode } from '../../../src/monetization/iap/IAPCustomCode.ts';
import {
  IAPCustomerEligibility,
  InAppPurchaseOfferCode,
} from '../../../src/monetization/iap/InAppPurchaseOfferCode.ts';
import type { InAppPurchaseRepository } from '../../../src/monetization/iap/InAppPurchaseRepository.ts';

function stubRepo(overrides: Partial<InAppPurchaseRepository> = {}): InAppPurchaseRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    submit: vi.fn().mockResolvedValue(undefined),
    unsubmit: vi.fn().mockResolvedValue(undefined),
    localizations: vi.fn().mockResolvedValue([]),
    createLocalization: vi.fn(),
    saveLocalization: vi.fn().mockResolvedValue(undefined),
    deleteLocalization: vi.fn().mockResolvedValue(undefined),
    reviewScreenshot: vi.fn().mockResolvedValue(null),
    uploadReviewScreenshot: vi.fn(),
    deleteReviewScreenshot: vi.fn().mockResolvedValue(undefined),
    priceSchedule: vi.fn().mockResolvedValue(null),
    availability: vi.fn().mockResolvedValue(null),
    setAvailability: vi.fn().mockResolvedValue(undefined),
    offerCodes: vi.fn().mockResolvedValue([]),
    deactivateOfferCode: vi.fn().mockResolvedValue(undefined),
    createOfferCode: vi.fn(),
    setPrice: vi.fn().mockResolvedValue(undefined),
    pricePoints: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    equalizations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    oneTimeUseCodes: vi.fn().mockResolvedValue([]),
    generateOneTimeUseCodes: vi.fn(),
    customCodes: vi.fn().mockResolvedValue([]),
    createCustomCode: vi.fn(),
    oneTimeUseCodeValues: vi.fn().mockResolvedValue(''),
    ...overrides,
  };
}

describe('IAPCustomCode', () => {
  it('fromJSON tolerates missing expiration', () => {
    const c = IAPCustomCode.fromJSON({
      id: 'cc-1',
      customCode: 'TESTING2026',
      numberOfCodes: 100,
      isActive: true,
    });
    expect(c.id).toBe('cc-1');
    expect(c.customCode).toBe('TESTING2026');
    expect(c.numberOfCodes).toBe(100);
    expect(c.isActive).toBe(true);
    expect(c.expirationDate).toBeNull();
  });
});

describe('InAppPurchaseOfferCode + custom codes & redemption URL', () => {

  it('redemptionUrl returns the production-redeem URL with the appId', () => {
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'WELCOME20',
      customerEligibilities: [], isActive: true,
      affordances: { appId: 'app-store-id-12345' } as Record<string, string>,
    });
    expect(code.redemptionUrl).toBe(
      'https://apps.apple.com/redeem?ctx=offercodes&id=app-store-id-12345&code=CODE',
    );
  });

  it('redemptionUrl falls back to {appId} placeholder when no appId is provided', () => {
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'X',
      customerEligibilities: [], isActive: true,
    });
    expect(code.redemptionUrl).toContain('id=%7BappId%7D');
  });

  it('loadCustomCodes populates the list and attaches the repo', async () => {
    const codes = [new IAPCustomCode({ id: 'cc-1', customCode: 'WEL', numberOfCodes: 100, isActive: true })];
    const repo = stubRepo({ customCodes: vi.fn().mockResolvedValue(codes) });
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'WELCOME',
      customerEligibilities: [IAPCustomerEligibility.NonSpender],
      isActive: true,
    });
    code.setRepository(repo);

    await code.loadCustomCodes();

    expect(repo.customCodes).toHaveBeenCalledWith(code);
    expect(code.customCodes).toEqual(codes);
    expect(code.isCustomCodesLoaded).toBe(true);
  });

  it('createCustomCode appends and counts toward the totals', async () => {
    const created = new IAPCustomCode({ id: 'cc-new', customCode: 'BLACKFRIDAY', numberOfCodes: 50, isActive: true });
    const repo = stubRepo({ createCustomCode: vi.fn().mockResolvedValue(created) });
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'X',
      customerEligibilities: [],
      isActive: true,
    });
    code.setRepository(repo);

    const result = await code.createCustomCode({
      customCode: 'BLACKFRIDAY',
      numberOfCodes: 50,
    });

    expect(result).toBe(created);
    expect(code.customCodes).toContain(created);
    expect(code.totalCustomCodes).toBe(50);
  });

  it('createCustomCode throws when no repository is attached', async () => {
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'X',
      customerEligibilities: [], isActive: true,
    });

    await expect(code.createCustomCode({ customCode: 'X', numberOfCodes: 10 })).rejects.toThrow(/no repository/);
  });
});
