import { describe, it, expect, vi } from 'vitest';
import {
  InAppPurchase,
  InAppPurchaseState,
  InAppPurchaseType,
  type InAppPurchaseInit,
} from '../../../src/monetization/iap/InAppPurchase.ts';
import { InAppPurchaseLocalization } from '../../../src/monetization/iap/InAppPurchaseLocalization.ts';
import { ReviewScreenshot } from '../../../src/monetization/iap/ReviewScreenshot.ts';
import {
  InAppPurchaseImage,
  InAppPurchaseImageState,
} from '../../../src/monetization/iap/InAppPurchaseImage.ts';
import { IAPPriceSchedule } from '../../../src/monetization/iap/IAPPriceSchedule.ts';
import { IAPAvailability, TerritoryAvailability } from '../../../src/monetization/iap/IAPAvailability.ts';
import { IAPCustomerEligibility, InAppPurchaseOfferCode } from '../../../src/monetization/iap/InAppPurchaseOfferCode.ts';
import { IAPPricePoint } from '../../../src/monetization/iap/IAPPricePoint.ts';
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
    expect(new InAppPurchase(iapInit({ state: InAppPurchaseState.ReadyToSubmit })).statusTone).toBe('info');
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

  it('canUploadReviewScreenshot is true for an editable IAP whose screenshot is viewable, even without an explicit uploadReviewScreenshot link', () => {
    // The asc-cli backend returns `getReviewScreenshot` + `update` on an
    // editable IAP but not always a discrete uploadReviewScreenshot link;
    // POST to the same URL handles both create and replace. Match the
    // same fallback shape canSetAvailability uses.
    const iap = new InAppPurchase(iapInit({
      state: InAppPurchaseState.MissingMetadata,
      affordances: { getReviewScreenshot: '/x', update: '/y' },
    }));
    expect(iap.canUploadReviewScreenshot).toBe(true);
  });

  it('canUploadReviewScreenshot stays false when the IAP itself is not editable and no explicit upload link is present', () => {
    const approved = new InAppPurchase(iapInit({
      state: InAppPurchaseState.Approved,
      affordances: { getReviewScreenshot: '/x', update: '/y' },
    }));
    expect(approved.canUploadReviewScreenshot).toBe(false);
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

  // ── Promotional images ──

  it('canViewImages / canCreateImage / canUploadImage map to affordances', () => {
    const open = new InAppPurchase(iapInit({
      affordances: { listImages: '/x', createImage: '/y' },
    }));
    expect(open.canViewImages).toBe(true);
    expect(open.canCreateImage).toBe(true);
    expect(open.canUploadImage).toBe(true);

    const closed = new InAppPurchase(iapInit({ affordances: {} }));
    expect(closed.canViewImages).toBe(false);
    expect(closed.canCreateImage).toBe(false);
    expect(closed.canUploadImage).toBe(false);
  });

  it('canCreateImage is true for an editable IAP whose images are viewable, even without an explicit createImage link', () => {
    // Same fallback as canSetAvailability — backend exposes listImages +
    // update without a separate createImage link, but POST on the listImages
    // URL accepts new uploads.
    const iap = new InAppPurchase(iapInit({
      state: InAppPurchaseState.MissingMetadata,
      affordances: { listImages: '/x', update: '/y' },
    }));
    expect(iap.canCreateImage).toBe(true);
    expect(iap.canUploadImage).toBe(true);
  });

  it('canCreateImage stays false when the IAP is not editable', () => {
    const approved = new InAppPurchase(iapInit({
      state: InAppPurchaseState.Approved,
      affordances: { listImages: '/x', update: '/y' },
    }));
    expect(approved.canCreateImage).toBe(false);
  });

  it('canUploadImage is false once a completed image exists (Apple allows one)', async () => {
    const completed = new InAppPurchaseImage({
      id: 'img-1', fileName: 'a.png', state: InAppPurchaseImageState.Approved,
    });
    const repo = stubRepo({ images: vi.fn().mockResolvedValue([completed]) });
    const iap = new InAppPurchase(iapInit({
      affordances: { listImages: '/x', createImage: '/y' },
    }), repo);
    await iap.loadImages();

    expect(iap.hasExistingImage).toBe(true);
    expect(iap.canUploadImage).toBe(false);
  });

  it('canUploadImage stays true when only a failed/awaiting image is present', async () => {
    const awaiting = new InAppPurchaseImage({
      id: 'img-1', fileName: 'a.png', state: InAppPurchaseImageState.AwaitingUpload,
    });
    const repo = stubRepo({ images: vi.fn().mockResolvedValue([awaiting]) });
    const iap = new InAppPurchase(iapInit({
      affordances: { listImages: '/x', createImage: '/y' },
    }), repo);
    await iap.loadImages();

    expect(iap.hasExistingImage).toBe(false);
    expect(iap.canUploadImage).toBe(true);
  });

  it('loadImages short-circuits to [] when affordance is missing', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit({ affordances: {} }), repo);

    const result = await iap.loadImages();

    expect(result).toEqual([]);
    expect(iap.isImagesLoaded).toBe(true);
    expect(repo.images).not.toHaveBeenCalled();
  });

  it('loadImages populates images from the repo', async () => {
    const a = new InAppPurchaseImage({ id: 'img-1', fileName: 'a.png', state: InAppPurchaseImageState.Approved });
    const b = new InAppPurchaseImage({ id: 'img-2', fileName: 'b.png', state: InAppPurchaseImageState.AwaitingUpload });
    const repo = stubRepo({ images: vi.fn().mockResolvedValue([a, b]) });
    const iap = new InAppPurchase(iapInit({ affordances: { listImages: '/x' } }), repo);

    const list = await iap.loadImages();

    expect(list).toEqual([a, b]);
    expect(iap.images).toEqual([a, b]);
    expect(iap.isImagesLoaded).toBe(true);
    expect(repo.images).toHaveBeenCalledWith(iap);
  });

  it('uploadImage appends the created image to the list', async () => {
    const created = new InAppPurchaseImage({
      id: 'img-new', fileName: 'promo.jpg', state: InAppPurchaseImageState.UploadComplete,
    });
    const uploadImage = vi.fn().mockResolvedValue(created);
    const repo = stubRepo({ uploadImage });
    const iap = new InAppPurchase(iapInit({
      affordances: { listImages: '/x', createImage: '/y' },
    }), repo);

    const file = new File(['jpg-bytes'], 'promo.jpg', { type: 'image/jpeg' });
    const result = await iap.uploadImage(file);

    expect(uploadImage).toHaveBeenCalledWith(iap, file);
    expect(result).toBe(created);
    expect(iap.images).toContain(created);
  });

  it('uploadImage reloads the IAP after success so state transitions land', async () => {
    // Adding the first image often transitions the IAP from MISSING_METADATA
    // to READY_TO_SUBMIT on the backend. Front-end pulls the new state by
    // re-fetching the IAP via the parent app's collection (the asc-cli
    // backend doesn't expose a single-IAP GET endpoint).
    const created = new InAppPurchaseImage({
      id: 'img-new', fileName: 'p.jpg', state: InAppPurchaseImageState.UploadComplete,
    });
    const refreshed = new InAppPurchase(iapInit({
      state: InAppPurchaseState.ReadyToSubmit,
      reviewNote: 'note from server',
      affordances: { listImages: '/x', createImage: '/y', submit: '/s' },
    }));
    const repo = stubRepo({
      uploadImage: vi.fn().mockResolvedValue(created),
      list: vi.fn().mockResolvedValue([refreshed]),
    });
    const iap = new InAppPurchase(iapInit({
      state: InAppPurchaseState.MissingMetadata,
      affordances: { listImages: '/x', createImage: '/y' },
    }), repo);

    await iap.uploadImage(new File([''], 'p.jpg'));

    expect(repo.list).toHaveBeenCalledWith(iap.appId);
    expect(iap.state).toBe(InAppPurchaseState.ReadyToSubmit);
    expect(iap.affordances.submit).toBe('/s');
    expect(iap.reviewNote).toBe('note from server');
    // Locally appended image survives the reload — reload is for the IAP
    // header, not its loaded children.
    expect(iap.images).toContain(created);
  });

  it('deleteImage reloads the IAP after success so state transitions land', async () => {
    const a = new InAppPurchaseImage({
      id: 'img-1', fileName: 'a.png', state: InAppPurchaseImageState.Approved,
      affordances: { delete: '/d1' },
    });
    const refreshed = new InAppPurchase(iapInit({
      state: InAppPurchaseState.MissingMetadata,
      affordances: { listImages: '/x' },
    }));
    const repo = stubRepo({
      images: vi.fn().mockResolvedValue([a]),
      list: vi.fn().mockResolvedValue([refreshed]),
    });
    const iap = new InAppPurchase(iapInit({
      state: InAppPurchaseState.ReadyToSubmit,
      affordances: { listImages: '/x' },
    }), repo);
    await iap.loadImages();

    await iap.deleteImage(a);

    expect(repo.list).toHaveBeenCalledWith(iap.appId);
    expect(iap.state).toBe(InAppPurchaseState.MissingMetadata);
  });

  it('reload finds the IAP in the parent app collection and merges header fields', async () => {
    const refreshed = new InAppPurchase(iapInit({
      referenceName: 'New Name',
      state: InAppPurchaseState.WaitingForReview,
      hasSubmission: true,
      reviewNote: 'updated',
      affordances: { unsubmit: '/u' },
    }));
    const other = new InAppPurchase(iapInit({
      id: 'iap-other', state: InAppPurchaseState.Approved,
    }));
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([other, refreshed]) });
    const iap = new InAppPurchase(iapInit({
      referenceName: 'Old Name',
      state: InAppPurchaseState.ReadyToSubmit,
      hasSubmission: false,
      reviewNote: null,
      affordances: { submit: '/s' },
    }), repo);

    await iap.reload();

    expect(repo.list).toHaveBeenCalledWith(iap.appId);
    expect(iap.referenceName).toBe('New Name');
    expect(iap.state).toBe(InAppPurchaseState.WaitingForReview);
    expect(iap.hasSubmission).toBe(true);
    expect(iap.reviewNote).toBe('updated');
    expect(iap.affordances.unsubmit).toBe('/u');
    expect('submit' in iap.affordances).toBe(false);
  });

  it('reload is a no-op when the IAP is no longer in the parent collection', async () => {
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([]) });
    const iap = new InAppPurchase(iapInit({
      state: InAppPurchaseState.ReadyToSubmit,
      affordances: { submit: '/s' },
    }), repo);

    await iap.reload();

    expect(iap.state).toBe(InAppPurchaseState.ReadyToSubmit);
    expect(iap.affordances.submit).toBe('/s');
  });

  it('uploadImage throws when the affordance is missing', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit({ affordances: {} }), repo);

    await expect(iap.uploadImage(new File([''], 'a.jpg'))).rejects.toThrow(/cannot upload promotional image/);
    expect(repo.uploadImage).not.toHaveBeenCalled();
  });

  it('uploadImage throws when a completed image already exists (Apple allows one)', async () => {
    const completed = new InAppPurchaseImage({
      id: 'img-1', fileName: 'a.png', state: InAppPurchaseImageState.Approved,
    });
    const repo = stubRepo({ images: vi.fn().mockResolvedValue([completed]) });
    const iap = new InAppPurchase(iapInit({
      affordances: { listImages: '/x', createImage: '/y' },
    }), repo);
    await iap.loadImages();

    await expect(iap.uploadImage(new File([''], 'a.jpg'))).rejects.toThrow(/already has a promotional image/);
    expect(repo.uploadImage).not.toHaveBeenCalled();
  });

  it('replaceImage deletes the old image then uploads the new one and replaces in place', async () => {
    const old = new InAppPurchaseImage({
      id: 'img-old', fileName: 'old.jpg', state: InAppPurchaseImageState.Approved,
      affordances: { delete: '/d' },
    });
    const fresh = new InAppPurchaseImage({
      id: 'img-new', fileName: 'new.jpg', state: InAppPurchaseImageState.UploadComplete,
    });
    const repo = stubRepo({
      images: vi.fn().mockResolvedValue([old]),
      uploadImage: vi.fn().mockResolvedValue(fresh),
    });
    const iap = new InAppPurchase(iapInit({
      affordances: { listImages: '/x', createImage: '/y' },
    }), repo);
    await iap.loadImages();

    const file = new File(['jpg'], 'new.jpg', { type: 'image/jpeg' });
    const result = await iap.replaceImage(old, file);

    expect(repo.deleteImage).toHaveBeenCalledWith(iap, old);
    expect(repo.uploadImage).toHaveBeenCalledWith(iap, file);
    expect(result).toBe(fresh);
    expect(iap.images).not.toContain(old);
    expect(iap.images).toContain(fresh);
  });

  it('deleteImage calls the repo and prunes the list', async () => {
    const a = new InAppPurchaseImage({
      id: 'img-1', fileName: 'a.png', state: InAppPurchaseImageState.Approved,
      affordances: { delete: '/d1' },
    });
    const b = new InAppPurchaseImage({
      id: 'img-2', fileName: 'b.png', state: InAppPurchaseImageState.UploadComplete,
      affordances: { delete: '/d2' },
    });
    const repo = stubRepo({ images: vi.fn().mockResolvedValue([a, b]) });
    const iap = new InAppPurchase(iapInit({ affordances: { listImages: '/x' } }), repo);
    await iap.loadImages();

    await iap.deleteImage(a);

    expect(repo.deleteImage).toHaveBeenCalledWith(iap, a);
    expect(iap.images).toEqual([b]);
  });

  it('deleteImage throws when the image cannot be deleted', async () => {
    const noDelete = new InAppPurchaseImage({
      id: 'img-1', fileName: 'a.png', state: InAppPurchaseImageState.Approved,
      affordances: {},
    });
    const repo = stubRepo({ images: vi.fn().mockResolvedValue([noDelete]) });
    const iap = new InAppPurchase(iapInit({ affordances: { listImages: '/x' } }), repo);
    await iap.loadImages();

    await expect(iap.deleteImage(noDelete)).rejects.toThrow(/cannot be deleted/);
    expect(repo.deleteImage).not.toHaveBeenCalled();
  });

  // ── Pricing ──

  it('canViewPricing maps to either getPriceSchedule or listPricePoints affordance', () => {
    const explicit = new InAppPurchase(iapInit({ affordances: { getPriceSchedule: '/x' } }));
    expect(explicit.canViewPricing).toBe(true);

    // Backend currently emits only listPricePoints on the IAP listing — the
    // price-schedule endpoint exists at the standard path and the UI should
    // still show pricing.
    const implied = new InAppPurchase(iapInit({ affordances: { listPricePoints: '/x' } }));
    expect(implied.canViewPricing).toBe(true);

    const closed = new InAppPurchase(iapInit({ affordances: {} }));
    expect(closed.canViewPricing).toBe(false);
  });

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

  it('canSetAvailability is true for an editable IAP whose availability is viewable, even if the backend omits a discrete setAvailability link', () => {
    // The asc-cli backend returns `getAvailability` + `update` on the IAP
    // resource but not a separate `setAvailability` link — the same URL
    // accepts PATCH. An editable, view-able IAP should be settable.
    const iap = new InAppPurchase(iapInit({
      affordances: { getAvailability: '/x', update: '/y' },
    }));
    expect(iap.canSetAvailability).toBe(true);
  });

  it('canSetAvailability is false when the IAP itself is not editable (no update affordance) and no explicit setAvailability link is present', () => {
    const iap = new InAppPurchase(iapInit({
      affordances: { getAvailability: '/x' },
    }));
    expect(iap.canSetAvailability).toBe(false);
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

  // ── createOfferCode ──

  it('canCreateOfferCode maps to the createOfferCode affordance', () => {
    expect(new InAppPurchase(iapInit({ affordances: { createOfferCode: '/x' } })).canCreateOfferCode).toBe(true);
    expect(new InAppPurchase(iapInit({ affordances: {} })).canCreateOfferCode).toBe(false);
  });

  it('createOfferCode appends the created offer code to the list and attaches the repo', async () => {
    const created = new InAppPurchaseOfferCode({
      id: 'oc-new',
      iapId: 'iap-1',
      name: 'WELCOME',
      customerEligibilities: [IAPCustomerEligibility.NonSpender],
      isActive: true,
    });
    const createOfferCode = vi.fn().mockResolvedValue(created);
    const repo = stubRepo({ createOfferCode });
    const iap = new InAppPurchase(iapInit({ affordances: { createOfferCode: '/x' } }), repo);

    const result = await iap.createOfferCode({
      name: 'WELCOME',
      customerEligibilities: [IAPCustomerEligibility.NonSpender],
    });

    expect(createOfferCode).toHaveBeenCalledWith(iap, {
      name: 'WELCOME',
      customerEligibilities: [IAPCustomerEligibility.NonSpender],
    });
    expect(result).toBe(created);
    expect(iap.offerCodes).toContain(created);
    expect(created.repository).toBe(repo);
  });

  it('createOfferCode forwards a prices array to the repo when supplied', async () => {
    const created = new InAppPurchaseOfferCode({
      id: 'oc-paid', iapId: 'iap-1', name: 'PAID',
      customerEligibilities: [IAPCustomerEligibility.NonSpender],
      isActive: true,
    });
    const createOfferCode = vi.fn().mockResolvedValue(created);
    const repo = stubRepo({ createOfferCode });
    const iap = new InAppPurchase(iapInit({ affordances: { createOfferCode: '/x' } }), repo);

    await iap.createOfferCode({
      name: 'PAID',
      customerEligibilities: [IAPCustomerEligibility.NonSpender],
      prices: [
        { territory: 'USA', pricePointId: 'pp-1' },
        { territory: 'GBR', pricePointId: null },
      ],
    });

    expect(createOfferCode).toHaveBeenCalledWith(iap, {
      name: 'PAID',
      customerEligibilities: [IAPCustomerEligibility.NonSpender],
      prices: [
        { territory: 'USA', pricePointId: 'pp-1' },
        { territory: 'GBR', pricePointId: null },
      ],
    });
  });

  it('createOfferCode throws when affordance missing', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit({ affordances: {} }), repo);

    await expect(iap.createOfferCode({
      name: 'X',
      customerEligibilities: [IAPCustomerEligibility.NonSpender],
    })).rejects.toThrow(/cannot create offer code/);
    expect(repo.createOfferCode).not.toHaveBeenCalled();
  });

  // ── Price-point picker ──

  it('loadPricePoints passes territory + cursor + limit to the repo', async () => {
    const items = [
      new IAPPricePoint({ id: 'pp-1', territoryId: 'USA', formattedPrice: '$0.99', currency: 'USD', proceeds: '$0.69' }),
      new IAPPricePoint({ id: 'pp-2', territoryId: 'USA', formattedPrice: '$4.99', currency: 'USD', proceeds: '$3.49' }),
    ];
    const pricePoints = vi.fn().mockResolvedValue({ items, nextCursor: 'CURSOR-2' });
    const repo = stubRepo({ pricePoints });
    const iap = new InAppPurchase(iapInit({ affordances: { setPrice: '/x' } }), repo);

    const page = await iap.loadPricePoints({ territoryId: 'USA', cursor: 'CURSOR-1', limit: 25 });

    expect(pricePoints).toHaveBeenCalledWith(iap, { territoryId: 'USA', cursor: 'CURSOR-1', limit: 25 });
    expect(page.items).toBe(items);
    expect(page.nextCursor).toBe('CURSOR-2');
  });

  it('loadEqualizations passes pricePointId + cursor to the repo', async () => {
    const equalizations = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const repo = stubRepo({ equalizations });
    const iap = new InAppPurchase(iapInit({ affordances: { setPrice: '/x' } }), repo);

    await iap.loadEqualizations({ pricePointId: 'pp-base', cursor: null });

    expect(equalizations).toHaveBeenCalledWith(iap, { pricePointId: 'pp-base', cursor: null });
  });

  // ── setPrice ──

  it('canSetPrice maps to the setPrice affordance', () => {
    expect(new InAppPurchase(iapInit({ affordances: { setPrice: '/x' } })).canSetPrice).toBe(true);
    expect(new InAppPurchase(iapInit({ affordances: {} })).canSetPrice).toBe(false);
  });

  it('setPrice calls repo.setPrice with input then reloads the schedule', async () => {
    const sched = IAPPriceSchedule.fromJSON({
      baseTerritory: { id: 'USA', displayName: 'United States', currency: 'USD' },
      basePrice: '$9.99',
      basePricePoint: { id: 'pp-base' },
      territoryPrices: [],
    });
    const setPrice = vi.fn().mockResolvedValue(undefined);
    const priceSchedule = vi.fn().mockResolvedValue(sched);
    const repo = stubRepo({ setPrice, priceSchedule });
    const iap = new InAppPurchase(iapInit({
      affordances: { setPrice: '/x', getPriceSchedule: '/y' },
    }), repo);

    await iap.setPrice({ territoryId: 'USA', pricePointId: 'pp-base' });

    expect(setPrice).toHaveBeenCalledWith(iap, { territoryId: 'USA', pricePointId: 'pp-base' });
    expect(priceSchedule).toHaveBeenCalledWith(iap);
    expect(iap.priceSchedule).toBe(sched);
    expect(iap.isPriceScheduleLoaded).toBe(true);
  });

  it('setPrice throws when canSetPrice is false', async () => {
    const repo = stubRepo();
    const iap = new InAppPurchase(iapInit({ affordances: {} }), repo);

    await expect(iap.setPrice({ territoryId: 'USA', pricePointId: 'pp-1' })).rejects.toThrow(/cannot set price/);
    expect(repo.setPrice).not.toHaveBeenCalled();
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
