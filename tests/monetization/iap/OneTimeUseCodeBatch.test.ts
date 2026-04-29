import { describe, it, expect, vi } from 'vitest';
import {
  CodeEnvironment,
  IAPOneTimeUseCodeBatch,
} from '../../../src/monetization/iap/OneTimeUseCodeBatch.ts';
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
    images: vi.fn().mockResolvedValue([]),
    uploadImage: vi.fn(),
    deleteImage: vi.fn().mockResolvedValue(undefined),
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

describe('IAPOneTimeUseCodeBatch', () => {

  it('environmentLabel maps the enum to a human label', () => {
    expect(new IAPOneTimeUseCodeBatch({
      id: 'b-1', numberOfCodes: 100,
      environment: CodeEnvironment.Production, isActive: true,
    }).environmentLabel).toBe('Production');

    expect(new IAPOneTimeUseCodeBatch({
      id: 'b-2', numberOfCodes: 25,
      environment: CodeEnvironment.Sandbox, isActive: true,
    }).environmentLabel).toBe('Sandbox');
  });

  it('fromJSON tolerates string environments and missing dates', () => {
    const b = IAPOneTimeUseCodeBatch.fromJSON({
      id: 'b-9',
      numberOfCodes: 50,
      environment: 'PRODUCTION',
      isActive: true,
    });
    expect(b.environment).toBe(CodeEnvironment.Production);
    expect(b.expirationDate).toBeNull();
  });
});

describe('InAppPurchaseOfferCode + one-time-use code batches', () => {

  it('loadOneTimeUseCodes populates the batches list', async () => {
    const batches = [
      new IAPOneTimeUseCodeBatch({
        id: 'b-1', numberOfCodes: 100,
        environment: CodeEnvironment.Production, isActive: true,
      }),
    ];
    const oneTimeUseCodes = vi.fn().mockResolvedValue(batches);
    const repo = stubRepo({ oneTimeUseCodes });
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'X',
      customerEligibilities: [IAPCustomerEligibility.NonSpender],
      isActive: true,
    });
    code.setRepository(repo);

    await code.loadOneTimeUseCodes();

    expect(oneTimeUseCodes).toHaveBeenCalledWith(code);
    expect(code.oneTimeUseCodes).toEqual(batches);
    expect(code.isOneTimeUseCodesLoaded).toBe(true);
  });

  it('generateOneTimeUseCodes appends a new batch and counts toward the totals', async () => {
    const created = new IAPOneTimeUseCodeBatch({
      id: 'b-new', numberOfCodes: 200,
      environment: CodeEnvironment.Production, isActive: true,
    });
    const repo = stubRepo({
      generateOneTimeUseCodes: vi.fn().mockResolvedValue(created),
    });
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'X',
      customerEligibilities: [],
      isActive: true,
    });
    code.setRepository(repo);

    const result = await code.generateOneTimeUseCodes({
      count: 200,
      environment: CodeEnvironment.Production,
    });

    expect(result).toBe(created);
    expect(code.oneTimeUseCodes).toContain(created);
    expect(code.totalOneTimeUseCodes).toBe(200);
  });

  it('generateOneTimeUseCodes throws when no repository is attached', async () => {
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'X',
      customerEligibilities: [], isActive: true,
    });

    await expect(code.generateOneTimeUseCodes({
      count: 5,
      environment: CodeEnvironment.Production,
    })).rejects.toThrow(/no repository/);
  });
});
