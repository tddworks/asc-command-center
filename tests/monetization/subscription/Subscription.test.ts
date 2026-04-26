import { describe, it, expect, vi } from 'vitest';
import {
  Subscription,
  SubscriptionPeriod,
  SubscriptionState,
  type SubscriptionInit,
} from '../../../src/monetization/subscription/Subscription.ts';
import { SubscriptionLocalization } from '../../../src/monetization/subscription/SubscriptionLocalization.ts';
import { SubscriptionPriceSchedule } from '../../../src/monetization/subscription/SubscriptionPriceSchedule.ts';
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
    isFamilySharable: true,
    state: SubscriptionState.Approved,
    affordances: {},
    ...overrides,
  };
}

describe('Subscription', () => {

  it('isApproved/isLive reflect APPROVED state', () => {
    expect(new Subscription(subInit()).isApproved).toBe(true);
    expect(new Subscription(subInit()).isLive).toBe(true);
    expect(new Subscription(subInit({ state: SubscriptionState.MissingMetadata })).isApproved).toBe(false);
  });

  it('isEditable additionally includes ReadyToSubmit (vs IAP)', () => {
    expect(new Subscription(subInit({ state: SubscriptionState.ReadyToSubmit })).isEditable).toBe(true);
    expect(new Subscription(subInit({ state: SubscriptionState.MissingMetadata })).isEditable).toBe(true);
    expect(new Subscription(subInit({ state: SubscriptionState.WaitingForReview })).isEditable).toBe(false);
  });

  it('canSubmit requires ReadyToSubmit AND submit affordance', () => {
    expect(new Subscription(subInit({
      state: SubscriptionState.ReadyToSubmit,
      affordances: { submit: '/x' },
    })).canSubmit).toBe(true);
    expect(new Subscription(subInit({ state: SubscriptionState.ReadyToSubmit })).canSubmit).toBe(false);
  });

  it('canUnsubmit requires hasSubmission AND unsubmit affordance', () => {
    expect(new Subscription(subInit({
      hasSubmission: true,
      affordances: { unsubmit: '/x' },
    })).canUnsubmit).toBe(true);
    expect(new Subscription(subInit({
      affordances: { unsubmit: '/x' },
    })).canUnsubmit).toBe(false);
  });

  it('periodLabel maps the enum to a label', () => {
    expect(new Subscription(subInit({ subscriptionPeriod: SubscriptionPeriod.OneMonth })).periodLabel).toBe('1 Month');
    expect(new Subscription(subInit({ subscriptionPeriod: SubscriptionPeriod.OneYear })).periodLabel).toBe('1 Year');
    expect(new Subscription(subInit({ subscriptionPeriod: SubscriptionPeriod.SixMonths })).periodLabel).toBe('6 Months');
  });

  it('statusLabel and statusTone map known states', () => {
    expect(new Subscription(subInit({ state: SubscriptionState.Approved })).statusTone).toBe('success');
    expect(new Subscription(subInit({ state: SubscriptionState.Rejected })).statusTone).toBe('danger');
    expect(new Subscription(subInit({ state: SubscriptionState.MissingMetadata })).statusLabel).toBe('Missing Metadata');
  });

  it('submit calls the repo and flips state to WaitingForReview', async () => {
    const repo = stubRepo();
    const sub = new Subscription(
      subInit({ state: SubscriptionState.ReadyToSubmit, affordances: { submit: '/x' } }),
      repo,
    );

    await sub.submit();

    expect(repo.submit).toHaveBeenCalledWith(sub);
    expect(sub.state).toBe(SubscriptionState.WaitingForReview);
    expect(sub.hasSubmission).toBe(true);
  });

  it('unsubmit calls the repo, clears submission, reverts state', async () => {
    const repo = stubRepo();
    const sub = new Subscription(
      subInit({
        state: SubscriptionState.WaitingForReview,
        hasSubmission: true,
        affordances: { unsubmit: '/x' },
      }),
      repo,
    );

    await sub.unsubmit();

    expect(repo.unsubmit).toHaveBeenCalledWith(sub);
    expect(sub.hasSubmission).toBe(false);
    expect(sub.state).toBe(SubscriptionState.ReadyToSubmit);
  });

  it('update applies the patch only after the repo call resolves', async () => {
    const repo = stubRepo();
    const sub = new Subscription(
      subInit({ state: SubscriptionState.MissingMetadata, affordances: { update: '/x' } }),
      repo,
    );

    await sub.update({
      name: 'Premium Monthly v2',
      subscriptionPeriod: SubscriptionPeriod.OneYear,
      isFamilySharable: false,
      groupLevel: 5,
      reviewNote: 'note',
    });

    expect(sub.name).toBe('Premium Monthly v2');
    expect(sub.subscriptionPeriod).toBe(SubscriptionPeriod.OneYear);
    expect(sub.isFamilySharable).toBe(false);
    expect(sub.groupLevel).toBe(5);
    expect(sub.reviewNote).toBe('note');
  });

  it('update throws when the subscription is not editable', async () => {
    const repo = stubRepo();
    const sub = new Subscription(
      subInit({ state: SubscriptionState.Approved, affordances: { update: '/x' } }),
      repo,
    );

    await expect(sub.update({ name: 'x' })).rejects.toThrow(/not editable/);
    expect(repo.update).not.toHaveBeenCalled();
  });

  // ── Localizations ──

  it('canViewLocalizations / canCreateLocalization map to affordances', () => {
    const open = new Subscription(subInit({ affordances: { listLocalizations: '/x', createLocalization: '/y' } }));
    expect(open.canViewLocalizations).toBe(true);
    expect(open.canCreateLocalization).toBe(true);

    const closed = new Subscription(subInit({ affordances: {} }));
    expect(closed.canViewLocalizations).toBe(false);
    expect(closed.canCreateLocalization).toBe(false);
  });

  it('loadLocalizations populates and attaches the repo', async () => {
    const en = new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'Premium', description: null });
    const repo = stubRepo({ localizations: vi.fn().mockResolvedValue([en]) });
    const sub = new Subscription(subInit({ affordances: { listLocalizations: '/x' } }), repo);

    await sub.loadLocalizations();

    expect(sub.localizations).toEqual([en]);
    expect(en.repository).toBe(repo);
    expect(sub.isLocalizationsLoaded).toBe(true);
  });

  it('addLocalization gates on affordance and appends', async () => {
    const created = new SubscriptionLocalization({ id: 'l-new', locale: 'de-DE', name: 'X', description: null });
    const repo = stubRepo({ createLocalization: vi.fn().mockResolvedValue(created) });
    const sub = new Subscription(subInit({ affordances: { createLocalization: '/x' } }), repo);

    const result = await sub.addLocalization({ locale: 'de-DE', name: 'X' });

    expect(result).toBe(created);
    expect(sub.localizations).toContain(created);
    expect(repo.createLocalization).toHaveBeenCalledWith(sub, { locale: 'de-DE', name: 'X' });
  });

  it('removeLocalization delegates to loc.delete and prunes the list', async () => {
    const a = new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'X', description: null, affordances: { delete: '/x' } });
    const b = new SubscriptionLocalization({ id: 'l-2', locale: 'fr-FR', name: 'X', description: null, affordances: { delete: '/y' } });
    const repo = stubRepo({ localizations: vi.fn().mockResolvedValue([a, b]) });
    const sub = new Subscription(subInit({ affordances: { listLocalizations: '/x' } }), repo);
    await sub.loadLocalizations();

    await sub.removeLocalization(a);

    expect(repo.deleteLocalization).toHaveBeenCalledWith(a);
    expect(sub.localizations).toEqual([b]);
  });

  it('completeLocalizationCount counts non-empty names', async () => {
    const a = new SubscriptionLocalization({ id: 'l-1', locale: 'en-US', name: 'Premium', description: null });
    const b = new SubscriptionLocalization({ id: 'l-2', locale: 'fr-FR', name: '', description: null });
    const repo = stubRepo({ localizations: vi.fn().mockResolvedValue([a, b]) });
    const sub = new Subscription(subInit({ affordances: { listLocalizations: '/x' } }), repo);
    await sub.loadLocalizations();

    expect(sub.completeLocalizationCount).toBe(1);
    expect(sub.hasAnyCompleteLocalization).toBe(true);
  });

  // ── Pricing ──

  it('canViewPricing maps to the getPriceSchedule affordance', () => {
    expect(new Subscription(subInit({ affordances: { getPriceSchedule: '/x' } })).canViewPricing).toBe(true);
    expect(new Subscription(subInit({ affordances: {} })).canViewPricing).toBe(false);
  });

  it('loadPriceSchedule short-circuits to null when the affordance is missing', async () => {
    const repo = stubRepo();
    const sub = new Subscription(subInit({ affordances: {} }), repo);

    const result = await sub.loadPriceSchedule();

    expect(result).toBeNull();
    expect(sub.isPriceScheduleLoaded).toBe(true);
    expect(repo.priceSchedule).not.toHaveBeenCalled();
  });

  it('loadPriceSchedule populates priceSchedule from the repo', async () => {
    const sched = SubscriptionPriceSchedule.fromJSON({
      territoryPrices: [
        { territory: { id: 'USA', displayName: 'United States', currency: 'USD' }, customerPrice: '$9.99', pricePoint: { id: 'pp-1' } },
      ],
    });
    const repo = stubRepo({ priceSchedule: vi.fn().mockResolvedValue(sched) });
    const sub = new Subscription(subInit({ affordances: { getPriceSchedule: '/x' } }), repo);

    await sub.loadPriceSchedule();

    expect(sub.priceSchedule).toBe(sched);
    expect(sub.isPriceScheduleLoaded).toBe(true);
    expect(repo.priceSchedule).toHaveBeenCalledWith(sub);
  });

  it('suggestedProductId derives a com.bundle.<slug> shape', () => {
    expect(Subscription.suggestedProductId('com.example.app', 'Premium Monthly'))
      .toBe('com.example.premium_monthly');
    expect(Subscription.suggestedProductId('com.example.app', '')).toBe('com.example.app');
  });

  it('fromJSON tolerates `referenceName`/`subscriptionGroupId` aliases', () => {
    const sub = Subscription.fromJSON({
      id: 'sub-9',
      subscriptionGroupId: 'sg-2',
      referenceName: 'Pro',
      productId: 'com.example.pro',
      subscriptionPeriod: 'ONE_YEAR',
      isFamilySharable: true,
      state: 'APPROVED',
    });

    expect(sub.id).toBe('sub-9');
    expect(sub.groupId).toBe('sg-2');
    expect(sub.name).toBe('Pro');
    expect(sub.subscriptionPeriod).toBe('ONE_YEAR');
    expect(sub.isFamilySharable).toBe(true);
  });
});
