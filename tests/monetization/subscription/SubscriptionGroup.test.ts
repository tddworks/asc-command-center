import { describe, it, expect, vi } from 'vitest';
import {
  Subscription,
  SubscriptionPeriod,
  SubscriptionState,
} from '../../../src/monetization/subscription/Subscription.ts';
import {
  SubscriptionGroup,
  type SubscriptionGroupInit,
} from '../../../src/monetization/subscription/SubscriptionGroup.ts';
import { SubscriptionGroupLocalization } from '../../../src/monetization/subscription/SubscriptionGroupLocalization.ts';
import type { SubscriptionGroupRepository } from '../../../src/monetization/subscription/SubscriptionGroupRepository.ts';

function stubRepo(overrides: Partial<SubscriptionGroupRepository> = {}): SubscriptionGroupRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    subscriptions: vi.fn().mockResolvedValue([]),
    createSubscription: vi.fn(),
    removeSubscription: vi.fn().mockResolvedValue(undefined),
    groupLocalizations: vi.fn().mockResolvedValue([]),
    createGroupLocalization: vi.fn(),
    saveGroupLocalization: vi.fn().mockResolvedValue(undefined),
    deleteGroupLocalization: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as SubscriptionGroupRepository;
}

function groupInit(overrides: Partial<SubscriptionGroupInit> = {}): SubscriptionGroupInit {
  return {
    id: 'sg-1',
    appId: 'app-1',
    referenceName: 'Premium Plans',
    affordances: {},
    ...overrides,
  };
}

function mkTier(id: string, state: string = SubscriptionState.Approved): Subscription {
  return new Subscription({
    id,
    groupId: 'sg-1',
    name: id,
    productId: `com.example.${id}`,
    subscriptionPeriod: SubscriptionPeriod.OneMonth,
    isFamilySharable: false,
    state,
    affordances: { delete: `/api/v1/subscriptions/${id}` },
  });
}

describe('SubscriptionGroup', () => {

  it('canViewSubscriptions and canCreateSubscription map to affordances', () => {
    const open = new SubscriptionGroup(groupInit({
      affordances: {
        listSubscriptions: '/x',
        createSubscription: '/y',
        update: '/z',
        delete: '/d',
      },
    }));
    expect(open.canViewSubscriptions).toBe(true);
    expect(open.canCreateSubscription).toBe(true);
    expect(open.canUpdate).toBe(true);
    expect(open.canDelete).toBe(true);

    const closed = new SubscriptionGroup(groupInit({ affordances: {} }));
    expect(closed.canViewSubscriptions).toBe(false);
    expect(closed.canCreateSubscription).toBe(false);
    expect(closed.canUpdate).toBe(false);
    expect(closed.canDelete).toBe(false);
  });

  it('loadSubscriptions populates subscriptions from the repo', async () => {
    const tiers = [mkTier('sub-1'), mkTier('sub-2')];
    const repo = stubRepo({ subscriptions: vi.fn().mockResolvedValue(tiers) });
    const group = new SubscriptionGroup(
      groupInit({ affordances: { listSubscriptions: '/x' } }),
      repo,
    );

    const result = await group.loadSubscriptions();

    expect(result).toBe(tiers);
    expect(group.subscriptions).toEqual(tiers);
    expect(group.tierCount).toBe(2);
    expect(repo.subscriptions).toHaveBeenCalledWith(group);
  });

  it('loadSubscriptions short-circuits to [] when the affordance is missing', async () => {
    const repo = stubRepo();
    const group = new SubscriptionGroup(groupInit({ affordances: {} }), repo);

    const result = await group.loadSubscriptions();

    expect(result).toEqual([]);
    expect(repo.subscriptions).not.toHaveBeenCalled();
  });

  it('hasApprovedTier reflects child tiers', async () => {
    const repo = stubRepo({
      subscriptions: vi.fn().mockResolvedValue([
        mkTier('sub-1', SubscriptionState.MissingMetadata),
        mkTier('sub-2', SubscriptionState.Approved),
      ]),
    });
    const group = new SubscriptionGroup(groupInit({ affordances: { listSubscriptions: '/x' } }), repo);
    await group.loadSubscriptions();

    expect(group.hasApprovedTier).toBe(true);
  });

  it('createSubscription gates on affordance and appends to subscriptions', async () => {
    const created = mkTier('sub-new', SubscriptionState.MissingMetadata);
    const repo = stubRepo({ createSubscription: vi.fn().mockResolvedValue(created) });
    const group = new SubscriptionGroup(
      groupInit({ affordances: { createSubscription: '/x' } }),
      repo,
    );

    const result = await group.createSubscription({
      name: 'sub-new',
      productId: 'com.example.sub-new',
      subscriptionPeriod: SubscriptionPeriod.OneMonth,
      isFamilySharable: false,
    });

    expect(result).toBe(created);
    expect(group.subscriptions).toContain(created);
    expect(repo.createSubscription).toHaveBeenCalledWith({
      groupId: 'sg-1',
      name: 'sub-new',
      productId: 'com.example.sub-new',
      subscriptionPeriod: SubscriptionPeriod.OneMonth,
      isFamilySharable: false,
    });
  });

  it('createSubscription throws when no createSubscription affordance is exposed', async () => {
    const repo = stubRepo();
    const group = new SubscriptionGroup(groupInit({ affordances: {} }), repo);

    await expect(group.createSubscription({
      name: 'x', productId: 'y', subscriptionPeriod: SubscriptionPeriod.OneMonth, isFamilySharable: false,
    })).rejects.toThrow(/cannot create a subscription/);
    expect(repo.createSubscription).not.toHaveBeenCalled();
  });

  it('removeSubscription delegates to the repo and prunes the tier list', async () => {
    const a = mkTier('sub-1');
    const b = mkTier('sub-2');
    const repo = stubRepo({
      subscriptions: vi.fn().mockResolvedValue([a, b]),
    });
    const group = new SubscriptionGroup(
      groupInit({ affordances: { listSubscriptions: '/x' } }),
      repo,
    );
    await group.loadSubscriptions();

    await group.removeSubscription(a);

    expect(repo.removeSubscription).toHaveBeenCalledWith(a);
    expect(group.subscriptions).toEqual([b]);
  });

  // ── Group localizations ──

  it('canViewGroupLocalizations / canCreateGroupLocalization map to affordances', () => {
    const open = new SubscriptionGroup(groupInit({
      affordances: { listLocalizations: '/x', createLocalization: '/y' },
    }));
    expect(open.canViewGroupLocalizations).toBe(true);
    expect(open.canCreateGroupLocalization).toBe(true);

    const closed = new SubscriptionGroup(groupInit({ affordances: {} }));
    expect(closed.canViewGroupLocalizations).toBe(false);
    expect(closed.canCreateGroupLocalization).toBe(false);
  });

  it('loadGroupLocalizations populates and attaches the repo', async () => {
    const en = new SubscriptionGroupLocalization({ id: 'l-1', locale: 'en-US', name: 'Premium', customAppName: null });
    const repo = stubRepo({ groupLocalizations: vi.fn().mockResolvedValue([en]) });
    const group = new SubscriptionGroup(groupInit({ affordances: { listLocalizations: '/x' } }), repo);

    await group.loadGroupLocalizations();

    expect(group.groupLocalizations).toEqual([en]);
    expect(group.isGroupLocalizationsLoaded).toBe(true);
    expect(en.repository).toBe(repo);
  });

  it('addGroupLocalization gates on affordance and appends', async () => {
    const created = new SubscriptionGroupLocalization({ id: 'l-new', locale: 'de-DE', name: 'X', customAppName: null });
    const repo = stubRepo({ createGroupLocalization: vi.fn().mockResolvedValue(created) });
    const group = new SubscriptionGroup(
      groupInit({ affordances: { createLocalization: '/x' } }),
      repo,
    );

    const result = await group.addGroupLocalization({ locale: 'de-DE', name: 'X' });

    expect(result).toBe(created);
    expect(group.groupLocalizations).toContain(created);
    expect(repo.createGroupLocalization).toHaveBeenCalledWith(group, { locale: 'de-DE', name: 'X' });
  });

  it('addGroupLocalization throws when affordance missing', async () => {
    const repo = stubRepo();
    const group = new SubscriptionGroup(groupInit({ affordances: {} }), repo);

    await expect(group.addGroupLocalization({ locale: 'de-DE', name: 'X' })).rejects.toThrow(/cannot create a localization/);
    expect(repo.createGroupLocalization).not.toHaveBeenCalled();
  });

  it('removeGroupLocalization delegates to loc.delete and prunes the list', async () => {
    const a = new SubscriptionGroupLocalization({ id: 'l-1', locale: 'en-US', name: 'X', customAppName: null, affordances: { delete: '/x' } });
    const b = new SubscriptionGroupLocalization({ id: 'l-2', locale: 'fr-FR', name: 'Y', customAppName: null, affordances: { delete: '/y' } });
    const repo = stubRepo({ groupLocalizations: vi.fn().mockResolvedValue([a, b]) });
    const group = new SubscriptionGroup(groupInit({ affordances: { listLocalizations: '/x' } }), repo);
    await group.loadGroupLocalizations();

    await group.removeGroupLocalization(a);

    expect(repo.deleteGroupLocalization).toHaveBeenCalledWith(a);
    expect(group.groupLocalizations).toEqual([b]);
  });

  it('update calls the repo and applies the patch only on success', async () => {
    const repo = stubRepo();
    const group = new SubscriptionGroup(groupInit({ affordances: { update: '/x' } }), repo);

    await group.update({ referenceName: 'Renamed' });

    expect(repo.update).toHaveBeenCalledWith(group, { referenceName: 'Renamed' });
    expect(group.referenceName).toBe('Renamed');
  });
});
