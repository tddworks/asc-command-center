import { describe, it, expect, vi } from 'vitest';
import {
  Subscription,
  SubscriptionPeriod,
  SubscriptionState,
  type SubscriptionInit,
} from '../../../src/monetization/subscription/Subscription.ts';
import type { SubscriptionRepository } from '../../../src/monetization/subscription/SubscriptionRepository.ts';

function stubRepo(overrides: Partial<SubscriptionRepository> = {}): SubscriptionRepository {
  return {
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    submit: vi.fn().mockResolvedValue(undefined),
    unsubmit: vi.fn().mockResolvedValue(undefined),
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
