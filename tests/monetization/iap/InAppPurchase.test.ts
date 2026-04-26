import { describe, it, expect, vi } from 'vitest';
import {
  InAppPurchase,
  InAppPurchaseState,
  InAppPurchaseType,
  type InAppPurchaseInit,
} from '../../../src/monetization/iap/InAppPurchase.ts';
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
