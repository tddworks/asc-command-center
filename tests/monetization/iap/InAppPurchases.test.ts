import { describe, it, expect, vi } from 'vitest';
import {
  InAppPurchase,
  InAppPurchaseState,
  InAppPurchaseType,
} from '../../../src/monetization/iap/InAppPurchase.ts';
import { InAppPurchases } from '../../../src/monetization/iap/InAppPurchases.ts';
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

function mkIap(id: string, overrides: Partial<{ state: string; affordances: Record<string, string> }> = {}): InAppPurchase {
  return new InAppPurchase({
    id,
    appId: 'app-1',
    referenceName: id,
    productId: `com.example.${id}`,
    inAppPurchaseType: InAppPurchaseType.NonConsumable,
    state: overrides.state ?? InAppPurchaseState.Approved,
    affordances: overrides.affordances ?? {},
  });
}

describe('InAppPurchases (root aggregate)', () => {

  it('refreshFor populates the list and marks loaded', async () => {
    const a = mkIap('iap-1');
    const b = mkIap('iap-2');
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([a, b]) });
    const iaps = new InAppPurchases(repo);

    await iaps.refreshFor('app-1');

    expect(repo.list).toHaveBeenCalledWith('app-1');
    expect(iaps.list).toEqual([a, b]);
    expect(iaps.loaded).toBe(true);
    expect(iaps.appId).toBe('app-1');
    expect(iaps.error).toBeNull();
  });

  it('refreshFor records the error and still flips loaded', async () => {
    const repo = stubRepo({ list: vi.fn().mockRejectedValue(new Error('boom')) });
    const iaps = new InAppPurchases(repo);

    await iaps.refreshFor('app-1');

    expect(iaps.error?.message).toBe('boom');
    expect(iaps.loaded).toBe(true);
    expect(iaps.list).toEqual([]);
  });

  it('counts categorize the loaded list', async () => {
    const approved = mkIap('iap-1', { state: InAppPurchaseState.Approved });
    const pending = mkIap('iap-2', { state: InAppPurchaseState.WaitingForReview });
    const inReview = mkIap('iap-3', { state: InAppPurchaseState.InReview });
    const missing = mkIap('iap-4', { state: InAppPurchaseState.MissingMetadata });
    const rejected = mkIap('iap-5', { state: InAppPurchaseState.Rejected });

    const repo = stubRepo({ list: vi.fn().mockResolvedValue([approved, pending, inReview, missing, rejected]) });
    const iaps = new InAppPurchases(repo);
    await iaps.refreshFor('app-1');

    expect(iaps.count).toBe(5);
    expect(iaps.pendingCount).toBe(2);
    expect(iaps.needsActionCount).toBe(2);
  });

  it('create appends the new IAP to the list', async () => {
    const created = mkIap('iap-new');
    const repo = stubRepo({ create: vi.fn().mockResolvedValue(created) });
    const iaps = new InAppPurchases(repo);

    const result = await iaps.create({
      appId: 'app-1',
      referenceName: 'iap-new',
      productId: 'com.example.iap-new',
      inAppPurchaseType: InAppPurchaseType.NonConsumable,
    });

    expect(result).toBe(created);
    expect(iaps.list).toContain(created);
  });

  it('remove gates on canDelete and removes from the list on success', async () => {
    const deletable = mkIap('iap-1', { affordances: { delete: '/x' } });
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([deletable]) });
    const iaps = new InAppPurchases(repo);
    await iaps.refreshFor('app-1');

    await iaps.remove(deletable);

    expect(repo.remove).toHaveBeenCalledWith(deletable);
    expect(iaps.list).not.toContain(deletable);
  });

  it('remove throws when the affordance is missing and does not call the repo', async () => {
    const noDelete = mkIap('iap-1', { affordances: {} });
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([noDelete]) });
    const iaps = new InAppPurchases(repo);
    await iaps.refreshFor('app-1');

    await expect(iaps.remove(noDelete)).rejects.toThrow(/cannot be deleted/);
    expect(repo.remove).not.toHaveBeenCalled();
    expect(iaps.list).toContain(noDelete);
  });

  it('switchRepository clears state, selection, and rebinds the repo', async () => {
    const initial = mkIap('iap-1');
    const repo1 = stubRepo({ list: vi.fn().mockResolvedValue([initial]) });
    const iaps = new InAppPurchases(repo1);
    await iaps.refreshFor('app-1');
    iaps.select(iaps.list[0]);
    expect(iaps.list).toHaveLength(1);
    expect(iaps.selectedIap).toBe(initial);

    const repo2 = stubRepo();
    iaps.switchRepository(repo2);

    expect(iaps.repository).toBe(repo2);
    expect(iaps.list).toEqual([]);
    expect(iaps.loaded).toBe(false);
    expect(iaps.appId).toBeNull();
    expect(iaps.selectedIap).toBeNull();
  });

  it('select focuses an IAP and clearSelection resets', async () => {
    const a = mkIap('iap-1');
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([a]) });
    const iaps = new InAppPurchases(repo);
    await iaps.refreshFor('app-1');

    iaps.select(a);
    expect(iaps.selectedIap).toBe(a);

    iaps.clearSelection();
    expect(iaps.selectedIap).toBeNull();
  });

  it('select throws when the IAP is not in the loaded list', async () => {
    const a = mkIap('iap-1');
    const stranger = mkIap('iap-X');
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([a]) });
    const iaps = new InAppPurchases(repo);
    await iaps.refreshFor('app-1');

    expect(() => iaps.select(stranger)).toThrow(/not in the loaded list/);
  });

  it('refreshFor clears selection when switching apps', async () => {
    const repo = stubRepo({ list: vi.fn().mockImplementation((appId: string) => Promise.resolve([mkIap(`iap-${appId}`)])) });
    const iaps = new InAppPurchases(repo);
    await iaps.refreshFor('app-1');
    iaps.select(iaps.list[0]);

    await iaps.refreshFor('app-2');

    expect(iaps.selectedIap).toBeNull();
  });

  it('byId looks up loaded IAPs', async () => {
    const a = mkIap('iap-1');
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([a]) });
    const iaps = new InAppPurchases(repo);
    await iaps.refreshFor('app-1');

    expect(iaps.byId('iap-1')).toBe(a);
    expect(iaps.byId('missing')).toBeUndefined();
  });
});
