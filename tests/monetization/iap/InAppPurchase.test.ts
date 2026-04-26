import { describe, it, expect, vi } from 'vitest';
import {
  InAppPurchase,
  InAppPurchaseState,
  InAppPurchaseType,
  type InAppPurchaseInit,
} from '../../../src/monetization/iap/InAppPurchase.ts';
import { InAppPurchaseLocalization } from '../../../src/monetization/iap/InAppPurchaseLocalization.ts';
import { ReviewScreenshot } from '../../../src/monetization/iap/ReviewScreenshot.ts';
import { IAPPriceSchedule } from '../../../src/monetization/iap/IAPPriceSchedule.ts';
import { IAPAvailability, TerritoryAvailability } from '../../../src/monetization/iap/IAPAvailability.ts';
import { IAPCustomerEligibility, InAppPurchaseOfferCode } from '../../../src/monetization/iap/InAppPurchaseOfferCode.ts';
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
    ...overrides,
  };
}

function iapInit(overrides: Partial<InAppPurchaseInit> = {}): InAppPurchaseInit {
  return {
    id: 'iap-1',
    appId: 'app-1',
    referenceName: 'Premium Upgrade',
    productId: 'com.example.premium',
    inAppPurchaseType: InAppPurchaseType.NonConsumable,
    state: InAppPurchaseState.Approved,
    affordances: {},
    ...overrides,
  };
}

describe('InAppPurchase', () => {

  // ── Semantic Booleans ──

  it('isApproved is true only when state is APPROVED', () => {
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.Approved })).isApproved).toBe(true);
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.MissingMetadata })).isApproved).toBe(false);
  });

  it('isLive aliases isApproved', () => {
    const iap = new InAppPurchase(iapInit({ state: InAppPurchaseState.Approved }));
    expect(iap.isLive).toBe(iap.isApproved);
  });

  it('isEditable covers MissingMetadata, Rejected, DeveloperActionNeeded', () => {
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.MissingMetadata })).isEditable).toBe(true);
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.Rejected })).isEditable).toBe(true);
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.DeveloperActionNeeded })).isEditable).toBe(true);
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.Approved })).isEditable).toBe(false);
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.WaitingForReview })).isEditable).toBe(false);
  });

  it('isPendingReview covers WaitingForReview and InReview', () => {
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.WaitingForReview })).isPendingReview).toBe(true);
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.InReview })).isPendingReview).toBe(true);
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.Approved })).isPendingReview).toBe(false);
  });

  // ── Capability Checks ──

  it('canSubmit requires ReadyToSubmit state AND submit affordance', () => {
    const ready = new InAppPurchase(iapInit({
      state: InAppPurchaseState.ReadyToSubmit,
      affordances: { submit: '/api/v1/iap/iap-1/submit' },
    }));
    expect(ready.canSubmit).toBe(true);

    const noAffordance = new InAppPurchase(iapInit({ state: InAppPurchaseState.ReadyToSubmit, affordances: {} }));
    expect(noAffordance.canSubmit).toBe(false);

    const wrongState = new InAppPurchase(iapInit({
      state: InAppPurchaseState.MissingMetadata,
      affordances: { submit: '/api/v1/iap/iap-1/submit' },
    }));
    expect(wrongState.canSubmit).toBe(false);
  });

  it('canUnsubmit requires hasSubmission AND unsubmit affordance', () => {
    const submitted = new InAppPurchase(iapInit({
      state: InAppPurchaseState.WaitingForReview,
      hasSubmission: true,
      affordances: { unsubmit: '/api/v1/iap/iap-1/submit' },
    }));
    expect(submitted.canUnsubmit).toBe(true);

    const notSubmitted = new InAppPurchase(iapInit({
      hasSubmission: false,
      affordances: { unsubmit: '/api/v1/iap/iap-1/submit' },
    }));
    expect(notSubmitted.canUnsubmit).toBe(false);
  });

  it('canDelete maps to delete affordance presence', () => {
    expect(new InAppPurchase(iapInit({ affordances: { delete: '/api/v1/iap/iap-1' } })).canDelete).toBe(true);
    expect(new InAppPurchase(iapInit({ affordances: {} })).canDelete).toBe(false);
  });

  it('canUpdate requires editable state AND update affordance', () => {
    const editable = new InAppPurchase(iapInit({
      state: InAppPurchaseState.MissingMetadata,
      affordances: { update: '/api/v1/iap/iap-1' },
    }));
    expect(editable.canUpdate).toBe(true);

    const approved = new InAppPurchase(iapInit({
      state: InAppPurchaseState.Approved,
      affordances: { update: '/api/v1/iap/iap-1' },
    }));
    expect(approved.canUpdate).toBe(false);
  });

  // ── Display ──

  it('displayType maps the IAP type enum to a label', () => {
    expect(new InAppPurchase(iapInit({ inAppPurchaseType: InAppPurchaseType.Consumable })).displayType).toBe('Consumable');
    expect(new InAppPurchase(iapInit({ inAppPurchaseType: InAppPurchaseType.NonConsumable })).displayType).toBe('Non-Consumable');
    expect(new InAppPurchase(iapInit({ inAppPurchaseType: InAppPurchaseType.NonRenewingSubscription })).displayType).toBe('Non-Renewing');
  });

  it('statusLabel and statusTone map known states', () => {
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.Approved })).statusLabel).toBe('Approved');
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.Approved })).statusTone).toBe('success');
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.MissingMetadata })).statusTone).toBe('warning');
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.Rejected })).statusTone).toBe('danger');
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.WaitingForReview })).statusTone).toBe('info');
  });

  // ── Mutators ──

  it('submit calls the repo, sets hasSubmission, and flips state to WaitingForReview', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(
      iapInit({
        state: InAppPurchaseState.ReadyToSubmit,
        affordances: { submit: '/api/v1/iap/iap-1/submit' },
      }),
      repo,
    );

    await iap.submit();

    expect(repo.submit).toHaveBeenCalledWith(iap);
    expect(iap.hasSubmission).toBe(true);
    expect(iap.state).toBe(InAppPurchaseState.WaitingForReview);
  });

  it('submit throws and does not call the repo when canSubmit is false', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit({ state: InAppPurchaseState.MissingMetadata }), repo);

    await expect(iap.submit()).rejects.toThrow(/cannot submit/);
    expect(repo.submit).not.toHaveBeenCalled();
  });

  it('unsubmit calls the repo, clears hasSubmission, and reverts state to ReadyToSubmit', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(
      iapInit({
        state: InAppPurchaseState.WaitingForReview,
        hasSubmission: true,
        affordances: { unsubmit: '/api/v1/iap/iap-1/submit' },
      }),
      repo,
    );

    await iap.unsubmit();

    expect(repo.unsubmit).toHaveBeenCalledWith(iap);
    expect(iap.hasSubmission).toBe(false);
    expect(iap.state).toBe(InAppPurchaseState.ReadyToSubmit);
  });

  it('unsubmit throws and does not call the repo when there is no submission', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit(), repo);

    await expect(iap.unsubmit()).rejects.toThrow(/no active submission/);
    expect(repo.unsubmit).not.toHaveBeenCalled();
  });

  it('update applies the patch only after the repo call resolves', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(
      iapInit({
        state: InAppPurchaseState.MissingMetadata,
        affordances: { update: '/api/v1/iap/iap-1' },
      }),
      repo,
    );

    await iap.update({ referenceName: 'New Name', reviewNote: 'Use code TEST' });

    expect(repo.update).toHaveBeenCalledWith(iap, { referenceName: 'New Name', reviewNote: 'Use code TEST' });
    expect(iap.referenceName).toBe('New Name');
    expect(iap.reviewNote).toBe('Use code TEST');
  });

  it('update throws and skips local mutation when the IAP is not editable', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(
      iapInit({ state: InAppPurchaseState.Approved, affordances: { update: '/api/v1/iap/iap-1' } }),
      repo,
    );

    await expect(iap.update({ referenceName: 'x' })).rejects.toThrow(/not editable/);
    expect(repo.update).not.toHaveBeenCalled();
    expect(iap.referenceName).toBe('Premium Upgrade');
  });

  it('mutators throw when no repository is attached', async () => {
    const iap = new InAppPurchase(iapInit({
      state: InAppPurchaseState.ReadyToSubmit,
      affordances: { submit: '/x' },
    }));

    await expect(iap.submit()).rejects.toThrow(/no repository/);
  });

  // ── Localizations ──

  it('canViewLocalizations / canCreateLocalization map to affordances', () => {
    const open = new InAppPurchase(iapInit({
      affordances: { listLocalizations: '/x', createLocalization: '/y' },
    }));
    expect(open.canViewLocalizations).toBe(true);
    expect(open.canCreateLocalization).toBe(true);

    const closed = new InAppPurchase(iapInit({ affordances: {} }));
    expect(closed.canViewLocalizations).toBe(false);
    expect(closed.canCreateLocalization).toBe(false);
  });

  it('loadLocalizations populates localizations and attaches the repo', async () => {
    const en = new InAppPurchaseLocalization({ id: 'l-1', locale: 'en-US', name: 'Premium', description: null });
    const fr = new InAppPurchaseLocalization({ id: 'l-2', locale: 'fr-FR', name: 'Premium', description: null });
    const repo = stubRepo({ localizations: vi.fn().mockResolvedValue([en, fr]) });
    const iap = new InAppPurchase(iapInit({ affordances: { listLocalizations: '/x' } }), repo);

    const list = await iap.loadLocalizations();

    expect(list).toEqual([en, fr]);
    expect(iap.localizations).toEqual([en, fr]);
    expect(iap.isLocalizationsLoaded).toBe(true);
    expect(en.repository).toBe(repo);
    expect(fr.repository).toBe(repo);
    expect(repo.localizations).toHaveBeenCalledWith(iap);
  });

  it('loadLocalizations short-circuits to [] when the affordance is missing', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit({ affordances: {} }), repo);

    const list = await iap.loadLocalizations();

    expect(list).toEqual([]);
    expect(iap.isLocalizationsLoaded).toBe(true);
    expect(repo.localizations).not.toHaveBeenCalled();
  });

  it('addLocalization gates on canCreateLocalization, attaches the repo, appends', async () => {
    const created = new InAppPurchaseLocalization({ id: 'l-new', locale: 'de-DE', name: 'Premium', description: null });
    const repo = stubRepo({ createLocalization: vi.fn().mockResolvedValue(created) });
    const iap = new InAppPurchase(iapInit({ affordances: { createLocalization: '/x' } }), repo);

    const result = await iap.addLocalization({ locale: 'de-DE', name: 'Premium' });

    expect(result).toBe(created);
    expect(iap.localizations).toContain(created);
    expect(created.repository).toBe(repo);
    expect(repo.createLocalization).toHaveBeenCalledWith(iap, { locale: 'de-DE', name: 'Premium' });
  });

  it('addLocalization throws when the affordance is missing', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit({ affordances: {} }), repo);

    await expect(iap.addLocalization({ locale: 'de-DE', name: 'X' })).rejects.toThrow(/cannot create a localization/);
    expect(repo.createLocalization).not.toHaveBeenCalled();
  });

  it('removeLocalization delegates to loc.delete and prunes the list', async () => {
    const a = new InAppPurchaseLocalization({ id: 'l-1', locale: 'en-US', name: 'X', description: null, affordances: { delete: '/x' } });
    const b = new InAppPurchaseLocalization({ id: 'l-2', locale: 'fr-FR', name: 'X', description: null, affordances: { delete: '/y' } });
    const repo = stubRepo({ localizations: vi.fn().mockResolvedValue([a, b]) });
    const iap = new InAppPurchase(iapInit({ affordances: { listLocalizations: '/x' } }), repo);
    await iap.loadLocalizations();

    await iap.removeLocalization(a);

    expect(repo.deleteLocalization).toHaveBeenCalledWith(a);
    expect(iap.localizations).toEqual([b]);
  });

  it('completeLocalizationCount counts only locales whose name is non-empty', async () => {
    const a = new InAppPurchaseLocalization({ id: 'l-1', locale: 'en-US', name: 'Premium', description: null });
    const b = new InAppPurchaseLocalization({ id: 'l-2', locale: 'fr-FR', name: '', description: null });
    const repo = stubRepo({ localizations: vi.fn().mockResolvedValue([a, b]) });
    const iap = new InAppPurchase(iapInit({ affordances: { listLocalizations: '/x' } }), repo);
    await iap.loadLocalizations();

    expect(iap.completeLocalizationCount).toBe(1);
    expect(iap.hasAnyCompleteLocalization).toBe(true);
  });

  // ── Review (notes + screenshot) ──

  it('updateReviewNote calls update with reviewNote and mutates locally', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit({ affordances: { update: '/x' } }), repo);

    await iap.updateReviewNote('Use code TESTING');

    expect(repo.update).toHaveBeenCalledWith(iap, { reviewNote: 'Use code TESTING' });
    expect(iap.reviewNote).toBe('Use code TESTING');
  });

  it('updateReviewNote throws when update affordance is missing', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit({ affordances: {} }), repo);
    await expect(iap.updateReviewNote('x')).rejects.toThrow(/cannot update review note/);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('canViewReviewScreenshot / canUploadReviewScreenshot map to affordances', () => {
    const open = new InAppPurchase(iapInit({
      affordances: { getReviewScreenshot: '/x', uploadReviewScreenshot: '/y' },
    }));
    expect(open.canViewReviewScreenshot).toBe(true);
    expect(open.canUploadReviewScreenshot).toBe(true);

    const closed = new InAppPurchase(iapInit({ affordances: {} }));
    expect(closed.canViewReviewScreenshot).toBe(false);
    expect(closed.canUploadReviewScreenshot).toBe(false);
  });

  it('loadReviewScreenshot short-circuits to null when affordance missing', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit({ affordances: {} }), repo);

    const result = await iap.loadReviewScreenshot();

    expect(result).toBeNull();
    expect(iap.isReviewScreenshotLoaded).toBe(true);
    expect(repo.reviewScreenshot).not.toHaveBeenCalled();
  });

  it('loadReviewScreenshot populates reviewScreenshot from the repo', async () => {
    const shot = new ReviewScreenshot({ id: 'shot-1', fileName: 'a.png', previewUrl: 'data:image/x;base64,X' });
    const repo = stubRepo({ reviewScreenshot: vi.fn().mockResolvedValue(shot) });
    const iap = new InAppPurchase(iapInit({ affordances: { getReviewScreenshot: '/x' } }), repo);

    await iap.loadReviewScreenshot();

    expect(iap.reviewScreenshot).toBe(shot);
    expect(iap.isReviewScreenshotLoaded).toBe(true);
  });

  it('uploadReviewScreenshot replaces existing screenshot (delete + upload) and stores result', async () => {
    const existing = new ReviewScreenshot({ id: 'shot-1', fileName: 'old.png', previewUrl: 'data:x', affordances: { delete: '/d' } });
    const fresh = new ReviewScreenshot({ id: 'shot-2', fileName: 'new.png', previewUrl: 'data:y' });
    const repo = stubRepo({
      reviewScreenshot: vi.fn().mockResolvedValue(existing),
      uploadReviewScreenshot: vi.fn().mockResolvedValue(fresh),
    });
    const iap = new InAppPurchase(iapInit({
      affordances: { getReviewScreenshot: '/x', uploadReviewScreenshot: '/y' },
    }), repo);
    await iap.loadReviewScreenshot();

    const file = new File(['png-bytes'], 'new.png', { type: 'image/png' });
    const result = await iap.uploadReviewScreenshot(file);

    expect(repo.deleteReviewScreenshot).toHaveBeenCalledWith(iap, existing);
    expect(repo.uploadReviewScreenshot).toHaveBeenCalledWith(iap, file);
    expect(result).toBe(fresh);
    expect(iap.reviewScreenshot).toBe(fresh);
  });

  it('uploadReviewScreenshot throws when affordance is missing', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit({ affordances: {} }), repo);
    await expect(iap.uploadReviewScreenshot(new File([''], 'a.png'))).rejects.toThrow(/cannot upload review screenshot/);
    expect(repo.uploadReviewScreenshot).not.toHaveBeenCalled();
  });

  it('deleteReviewScreenshot clears reviewScreenshot on success', async () => {
    const shot = new ReviewScreenshot({ id: 'shot-1', fileName: 'x.png', previewUrl: 'data:x', affordances: { delete: '/d' } });
    const repo = stubRepo({ reviewScreenshot: vi.fn().mockResolvedValue(shot) });
    const iap = new InAppPurchase(iapInit({ affordances: { getReviewScreenshot: '/x' } }), repo);
    await iap.loadReviewScreenshot();

    await iap.deleteReviewScreenshot();

    expect(repo.deleteReviewScreenshot).toHaveBeenCalledWith(iap, shot);
    expect(iap.reviewScreenshot).toBeNull();
  });

  it('deleteReviewScreenshot throws when no screenshot is present', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit(), repo);
    await expect(iap.deleteReviewScreenshot()).rejects.toThrow(/no review screenshot to delete/);
  });

  // ── Pricing ──

  it('loadPriceSchedule short-circuits to null when affordance is missing', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit({ affordances: {} }), repo);

    const result = await iap.loadPriceSchedule();

    expect(result).toBeNull();
    expect(iap.isPriceScheduleLoaded).toBe(true);
    expect(repo.priceSchedule).not.toHaveBeenCalled();
  });

  it('loadPriceSchedule populates priceSchedule from the repo', async () => {
    const sched = IAPPriceSchedule.fromJSON({
      baseTerritory: { id: 'USA', displayName: 'United States', currency: 'USD' },
      basePrice: '$9.99',
      basePricePoint: { id: 'pp-base' },
      territoryPrices: [],
    });
    const repo = stubRepo({ priceSchedule: vi.fn().mockResolvedValue(sched) });
    const iap = new InAppPurchase(iapInit({ affordances: { getPriceSchedule: '/x' } }), repo);

    await iap.loadPriceSchedule();

    expect(iap.priceSchedule).toBe(sched);
    expect(iap.isPriceScheduleLoaded).toBe(true);
  });

  // ── Availability ──

  it('canViewAvailability / canSetAvailability map to affordances', () => {
    const open = new InAppPurchase(iapInit({
      affordances: { getAvailability: '/x', setAvailability: '/y' },
    }));
    expect(open.canViewAvailability).toBe(true);
    expect(open.canSetAvailability).toBe(true);

    const closed = new InAppPurchase(iapInit({ affordances: {} }));
    expect(closed.canViewAvailability).toBe(false);
    expect(closed.canSetAvailability).toBe(false);
  });

  it('loadAvailability short-circuits to null when affordance missing', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit({ affordances: {} }), repo);

    const result = await iap.loadAvailability();

    expect(result).toBeNull();
    expect(iap.isAvailabilityLoaded).toBe(true);
    expect(repo.availability).not.toHaveBeenCalled();
  });

  it('loadAvailability populates availability from the repo', async () => {
    const avail = new IAPAvailability({
      availableInNewTerritories: false,
      territories: [new TerritoryAvailability({ territoryId: 'USA', territoryName: 'US', currency: 'USD', isAvailable: true })],
    });
    const repo = stubRepo({ availability: vi.fn().mockResolvedValue(avail) });
    const iap = new InAppPurchase(iapInit({ affordances: { getAvailability: '/x' } }), repo);

    await iap.loadAvailability();

    expect(iap.availability).toBe(avail);
    expect(iap.isAvailabilityLoaded).toBe(true);
  });

  it('saveAvailability calls repo.setAvailability with current state and marks the snapshot saved', async () => {
    const avail = new IAPAvailability({
      availableInNewTerritories: false,
      territories: [
        new TerritoryAvailability({ territoryId: 'USA', territoryName: 'US', currency: 'USD', isAvailable: true }),
        new TerritoryAvailability({ territoryId: 'JPN', territoryName: 'Japan', currency: 'JPY', isAvailable: false }),
      ],
    });
    const repo = stubRepo({ availability: vi.fn().mockResolvedValue(avail) });
    const iap = new InAppPurchase(iapInit({
      affordances: { getAvailability: '/x', setAvailability: '/y' },
    }), repo);
    await iap.loadAvailability();

    avail.toggleTerritory('JPN');
    avail.setAvailableInNewTerritories(true);
    expect(avail.isDirty).toBe(true);

    await iap.saveAvailability();

    expect(repo.setAvailability).toHaveBeenCalledWith(iap, {
      territoryIds: ['USA', 'JPN'],
      availableInNewTerritories: true,
    });
    expect(avail.isDirty).toBe(false);
  });

  it('saveAvailability throws when no availability is loaded', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit({ affordances: { setAvailability: '/y' } }), repo);

    await expect(iap.saveAvailability()).rejects.toThrow(/no availability loaded/);
    expect(repo.setAvailability).not.toHaveBeenCalled();
  });

  it('saveAvailability throws when canSetAvailability is false', async () => {
    const avail = new IAPAvailability({ availableInNewTerritories: false, territories: [] });
    const repo = stubRepo({ availability: vi.fn().mockResolvedValue(avail) });
    const iap = new InAppPurchase(iapInit({ affordances: { getAvailability: '/x' } }), repo);
    await iap.loadAvailability();

    await expect(iap.saveAvailability()).rejects.toThrow(/cannot set availability/);
  });

  // ── Offer codes ──

  it('loadOfferCodes short-circuits to [] when affordance is missing', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit({ affordances: {} }), repo);

    const result = await iap.loadOfferCodes();

    expect(result).toEqual([]);
    expect(iap.isOfferCodesLoaded).toBe(true);
    expect(repo.offerCodes).not.toHaveBeenCalled();
  });

  it('loadOfferCodes populates offerCodes and attaches the repo to each', async () => {
    const a = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'WELCOME',
      customerEligibilities: [IAPCustomerEligibility.NonSpender],
      isActive: true,
    });
    const b = new InAppPurchaseOfferCode({
      id: 'oc-2', iapId: 'iap-1', name: 'CHURN',
      customerEligibilities: [IAPCustomerEligibility.ChurnedSpender],
      isActive: false,
    });
    const repo = stubRepo({ offerCodes: vi.fn().mockResolvedValue([a, b]) });
    const iap = new InAppPurchase(iapInit({ affordances: { listOfferCodes: '/x' } }), repo);

    await iap.loadOfferCodes();

    expect(iap.offerCodes).toEqual([a, b]);
    expect(iap.isOfferCodesLoaded).toBe(true);
    expect(a.repository).toBe(repo);
    expect(b.repository).toBe(repo);
  });

  it('activeOfferCodeCount counts active codes only', async () => {
    const a = new InAppPurchaseOfferCode({
      id: 'oc-1', iapId: 'iap-1', name: 'A',
      customerEligibilities: [], isActive: true,
    });
    const b = new InAppPurchaseOfferCode({
      id: 'oc-2', iapId: 'iap-1', name: 'B',
      customerEligibilities: [], isActive: false,
    });
    const repo = stubRepo({ offerCodes: vi.fn().mockResolvedValue([a, b]) });
    const iap = new InAppPurchase(iapInit({ affordances: { listOfferCodes: '/x' } }), repo);
    await iap.loadOfferCodes();

    expect(iap.activeOfferCodeCount).toBe(1);
  });

  // ── Helpers ──

  it('suggestedProductId replaces the last bundle segment with a slug', () => {
    expect(InAppPurchase.suggestedProductId('com.example.weather', 'Premium Upgrade'))
      .toBe('com.example.premium_upgrade');
    expect(InAppPurchase.suggestedProductId('com.example.weather', '100 Coins'))
      .toBe('com.example.100_coins');
  });

  it('suggestedProductId trims punctuation and collapses whitespace', () => {
    expect(InAppPurchase.suggestedProductId('com.example.app', '  Pro!! Bundle  '))
      .toBe('com.example.pro_bundle');
  });

  it('suggestedProductId falls back when one side is empty', () => {
    expect(InAppPurchase.suggestedProductId('com.example.app', '')).toBe('com.example.app');
    expect(InAppPurchase.suggestedProductId('', 'Premium')).toBe('premium');
    expect(InAppPurchase.suggestedProductId('singleseg', 'Premium')).toBe('singleseg.premium');
  });

  // ── fromJSON ──

  it('fromJSON hydrates the standard backend shape', () => {
    const iap = InAppPurchase.fromJSON({
      id: 'iap-9',
      appId: 'app-2',
      referenceName: 'Pro Bundle',
      productId: 'com.example.pro',
      inAppPurchaseType: 'NON_CONSUMABLE',
      state: 'APPROVED',
      reviewNote: 'Use Wi-Fi',
      affordances: { submit: '/x' },
    });

    expect(iap.id).toBe('iap-9');
    expect(iap.referenceName).toBe('Pro Bundle');
    expect(iap.isApproved).toBe(true);
    expect(iap.affordances.submit).toBe('/x');
    expect(iap.reviewNote).toBe('Use Wi-Fi');
  });

  it('fromJSON tolerates `name`/`type` aliases and infers hasSubmission from a submission object', () => {
    const iap = InAppPurchase.fromJSON({
      id: 'iap-10',
      appId: 'app-2',
      name: 'Aliased',
      productId: 'com.example.aliased',
      type: 'CONSUMABLE',
      state: 'WAITING_FOR_REVIEW',
      submission: { id: 'sub-1' },
    });

    expect(iap.referenceName).toBe('Aliased');
    expect(iap.inAppPurchaseType).toBe('CONSUMABLE');
    expect(iap.hasSubmission).toBe(true);
  });
});
