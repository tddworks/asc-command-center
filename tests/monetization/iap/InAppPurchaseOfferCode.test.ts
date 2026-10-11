import { describe, it, expect, vi } from 'vitest';
import {
  IAPCustomerEligibility,
  InAppPurchaseOfferCode,
} from '../../../src/monetization/iap/InAppPurchaseOfferCode.ts';
import { IAPOneTimeUseCodeBatch, CodeEnvironment } from '../../../src/monetization/iap/OneTimeUseCodeBatch.ts';
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

function batch(id: string, count: number): IAPOneTimeUseCodeBatch {
  return new IAPOneTimeUseCodeBatch({
    id,
    numberOfCodes: count,
    environment: CodeEnvironment.Production,
    isActive: true,
  });
}

describe('InAppPurchaseOfferCode', () => {

  // ── Display ──

  it('eligibilityLabels maps the enum to human strings', () => {
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1',
      iapId: 'iap-1',
      name: 'GEMPACK20',
      customerEligibilities: [IAPCustomerEligibility.NonSpender, IAPCustomerEligibility.ChurnedSpender],
      isActive: true,
    });
    expect(code.eligibilityLabels).toEqual(['Non-Spender', 'Churned']);
  });

  it('totalCodes sums production + sandbox counts when present', () => {
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'X',
      customerEligibilities: [IAPCustomerEligibility.NonSpender],
      isActive: true,
      productionCodeCount: 100,
      sandboxCodeCount: 25,
    });
    expect(code.totalCodes).toBe(125);
  });

  it('totalCodes is 0 when neither count is set', () => {
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'X',
      customerEligibilities: [],
      isActive: false,
    });
    expect(code.totalCodes).toBe(0);
  });

  // ── Capability checks ──

  it('canDeactivate requires isActive AND deactivate affordance', () => {
    const live = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'X',
      customerEligibilities: [], isActive: true,
      affordances: { deactivate: '/x' },
    });
    expect(live.canDeactivate).toBe(true);

    const inactive = new InAppPurchaseOfferCode({
      id: 'oc-2', iapId: 'iap-1', name: 'X',
      customerEligibilities: [], isActive: false,
      affordances: { deactivate: '/x' },
    });
    expect(inactive.canDeactivate).toBe(false);

    const noAffordance = new InAppPurchaseOfferCode({
      id: 'oc-3', iapId: 'iap-1', name: 'X',
      customerEligibilities: [], isActive: true,
    });
    expect(noAffordance.canDeactivate).toBe(false);
  });

  // ── Mutators ──

  it('deactivate calls repo.deactivateOfferCode and flips isActive locally', async () => {
    const repo = stubRepo();
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'X',
      customerEligibilities: [], isActive: true,
      affordances: { deactivate: '/x' },
    });
    code.setRepository(repo);

    await code.deactivate();

    expect(repo.deactivateOfferCode).toHaveBeenCalledWith(code);
    expect(code.isActive).toBe(false);
  });

  it('deactivate throws when canDeactivate is false', async () => {
    const repo = stubRepo();
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'X',
      customerEligibilities: [], isActive: false,
      affordances: { deactivate: '/x' },
    });
    code.setRepository(repo);

    await expect(code.deactivate()).rejects.toThrow(/cannot deactivate/);
    expect(repo.deactivateOfferCode).not.toHaveBeenCalled();
  });

  it('deactivate throws when no repository attached', async () => {
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'X',
      customerEligibilities: [], isActive: true,
      affordances: { deactivate: '/x' },
    });
    await expect(code.deactivate()).rejects.toThrow(/no repository/);
  });

  // ── downloadCodes ──

  it('downloadCodes returns CSV of <code>,<redemption-url> using affordances.appId', async () => {
    const repo = stubRepo({
      oneTimeUseCodeValues: vi.fn().mockResolvedValue('ABC123\nDEF456\nGHI789'),
    });
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'WELCOME',
      customerEligibilities: [], isActive: true,
      affordances: { appId: '1000000003' },
    });
    code.setRepository(repo);
    const b = batch('batch-1', 3);

    const csv = await code.downloadCodes(b);

    expect(csv).toBe(
      'ABC123,https://apps.apple.com/redeem?ctx=offercodes&id=1000000003&code=ABC123\n' +
      'DEF456,https://apps.apple.com/redeem?ctx=offercodes&id=1000000003&code=DEF456\n' +
      'GHI789,https://apps.apple.com/redeem?ctx=offercodes&id=1000000003&code=GHI789',
    );
    expect(repo.oneTimeUseCodeValues).toHaveBeenCalledWith(code, b);
  });

  it('downloadCodes returns the raw CSV when affordances.appId is missing', async () => {
    const repo = stubRepo({
      oneTimeUseCodeValues: vi.fn().mockResolvedValue('ABC123\nDEF456'),
    });
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'WELCOME',
      customerEligibilities: [], isActive: true,
    });
    code.setRepository(repo);

    const csv = await code.downloadCodes(batch('batch-1', 2));

    expect(csv).toBe('ABC123\nDEF456');
  });

  it('downloadCodes filters blank lines so the CSV stays clean', async () => {
    const repo = stubRepo({
      oneTimeUseCodeValues: vi.fn().mockResolvedValue('ABC\n\nDEF\n'),
    });
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'X',
      customerEligibilities: [], isActive: true,
      affordances: { appId: '111' },
    });
    code.setRepository(repo);

    const csv = await code.downloadCodes(batch('b', 2));

    expect(csv.split('\n')).toHaveLength(2);
    expect(csv).toContain('ABC,https://apps.apple.com/redeem?ctx=offercodes&id=111&code=ABC');
    expect(csv).toContain('DEF,https://apps.apple.com/redeem?ctx=offercodes&id=111&code=DEF');
  });

  it('downloadCodes throws when no repository is attached', async () => {
    const code = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'X',
      customerEligibilities: [], isActive: true,
    });
    await expect(code.downloadCodes(batch('b', 1))).rejects.toThrow(/no repository/);
  });

  // ── fromJSON ──

  it('fromJSON tolerates string eligibilities and missing counts', () => {
    const code = InAppPurchaseOfferCode.fromJSON({
      id: 'oc-1',
      iapId: 'iap-1',
      name: 'WELCOME',
      customerEligibilities: ['NON_SPENDER', 'ACTIVE_SPENDER'],
      isActive: true,
    });
    expect(code.id).toBe('oc-1');
    expect(code.name).toBe('WELCOME');
    expect(code.customerEligibilities).toEqual([
      IAPCustomerEligibility.NonSpender,
      IAPCustomerEligibility.ActiveSpender,
    ]);
    expect(code.totalCodes).toBe(0);
  });
});
