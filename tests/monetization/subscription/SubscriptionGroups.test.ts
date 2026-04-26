import { describe, it, expect, vi } from 'vitest';
import {
  Subscription,
  SubscriptionPeriod,
  SubscriptionState,
} from '../../../src/monetization/subscription/Subscription.ts';
import { SubscriptionGroup } from '../../../src/monetization/subscription/SubscriptionGroup.ts';
import { SubscriptionGroups } from '../../../src/monetization/subscription/SubscriptionGroups.ts';
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

function mkGroup(id: string, repo: SubscriptionGroupRepository, opts: { affordances?: Record<string, string> } = {}): SubscriptionGroup {
  return new SubscriptionGroup(
    {
      id,
      appId: 'app-1',
      referenceName: id,
      affordances: opts.affordances ?? { listSubscriptions: `/api/v1/subscription-groups/${id}/subscriptions` },
    },
    repo,
  );
}

function mkTier(id: string, groupId: string): Subscription {
  return new Subscription({
    id, groupId,
    name: id,
    productId: `com.example.${id}`,
    subscriptionPeriod: SubscriptionPeriod.OneMonth,
    isFamilySharable: false,
    state: SubscriptionState.Approved,
    affordances: {},
  });
}

describe('SubscriptionGroups (root aggregate)', () => {

  it('refreshFor populates the list and hydrates each group with its tiers', async () => {
    const repo = stubRepo();
    const a = mkGroup('sg-1', repo);
    const b = mkGroup('sg-2', repo);
    repo.list = vi.fn().mockResolvedValue([a, b]);
    repo.subscriptions = vi.fn().mockImplementation((g: SubscriptionGroup) =>
      Promise.resolve(g.id === 'sg-1' ? [mkTier('sub-1', 'sg-1'), mkTier('sub-2', 'sg-1')] : [mkTier('sub-3', 'sg-2')]),
    );

    const groups = new SubscriptionGroups(repo);
    await groups.refreshFor('app-1');

    expect(groups.list).toEqual([a, b]);
    expect(groups.loaded).toBe(true);
    expect(groups.count).toBe(2);
    expect(groups.totalTierCount).toBe(3);
    expect(repo.subscriptions).toHaveBeenCalledTimes(2);
  });

  it('refreshFor records the error when list rejects', async () => {
    const repo = stubRepo({ list: vi.fn().mockRejectedValue(new Error('boom')) });
    const groups = new SubscriptionGroups(repo);

    await groups.refreshFor('app-1');

    expect(groups.error?.message).toBe('boom');
    expect(groups.loaded).toBe(true);
    expect(groups.list).toEqual([]);
  });

  it('create appends the new group to the list', async () => {
    const repo = stubRepo();
    const created = mkGroup('sg-new', repo);
    repo.create = vi.fn().mockResolvedValue(created);
    const groups = new SubscriptionGroups(repo);

    const result = await groups.create({ appId: 'app-1', referenceName: 'sg-new' });

    expect(result).toBe(created);
    expect(groups.list).toContain(created);
  });

  it('remove calls the repo and prunes the list when canDelete', async () => {
    const repo = stubRepo();
    const deletable = mkGroup('sg-1', repo, { affordances: { delete: '/x' } });
    repo.list = vi.fn().mockResolvedValue([deletable]);
    const groups = new SubscriptionGroups(repo);
    await groups.refreshFor('app-1');

    await groups.remove(deletable);

    expect(repo.remove).toHaveBeenCalledWith(deletable);
    expect(groups.list).not.toContain(deletable);
  });

  it('remove throws when canDelete is false and skips the repo call', async () => {
    const repo = stubRepo();
    const noDelete = mkGroup('sg-1', repo, { affordances: {} });
    repo.list = vi.fn().mockResolvedValue([noDelete]);
    const groups = new SubscriptionGroups(repo);
    await groups.refreshFor('app-1');

    await expect(groups.remove(noDelete)).rejects.toThrow(/cannot be deleted/);
    expect(repo.remove).not.toHaveBeenCalled();
    expect(groups.list).toContain(noDelete);
  });

  it('switchRepository resets state including selectedTier', async () => {
    const repo1 = stubRepo();
    const initial = mkGroup('sg-1', repo1);
    const tier = mkTier('sub-1', 'sg-1');
    repo1.list = vi.fn().mockResolvedValue([initial]);
    repo1.subscriptions = vi.fn().mockResolvedValue([tier]);
    const groups = new SubscriptionGroups(repo1);
    await groups.refreshFor('app-1');
    groups.selectTier(tier);
    expect(groups.selectedTier).toBe(tier);

    const repo2 = stubRepo();
    groups.switchRepository(repo2);

    expect(groups.repository).toBe(repo2);
    expect(groups.list).toEqual([]);
    expect(groups.loaded).toBe(false);
    expect(groups.appId).toBeNull();
    expect(groups.selectedTier).toBeNull();
  });

  // ── Selection ──

  it('selectTier focuses a loaded tier and clearSelection resets', async () => {
    const repo = stubRepo();
    const group = mkGroup('sg-1', repo);
    const tier = mkTier('sub-1', 'sg-1');
    repo.list = vi.fn().mockResolvedValue([group]);
    repo.subscriptions = vi.fn().mockResolvedValue([tier]);
    const groups = new SubscriptionGroups(repo);
    await groups.refreshFor('app-1');

    groups.selectTier(tier);
    expect(groups.selectedTier).toBe(tier);

    groups.clearSelection();
    expect(groups.selectedTier).toBeNull();
  });

  it('selectTier throws when the tier is not in any loaded group', async () => {
    const repo = stubRepo();
    const group = mkGroup('sg-1', repo);
    const owned = mkTier('sub-1', 'sg-1');
    const stranger = mkTier('sub-X', 'sg-X');
    repo.list = vi.fn().mockResolvedValue([group]);
    repo.subscriptions = vi.fn().mockResolvedValue([owned]);
    const groups = new SubscriptionGroups(repo);
    await groups.refreshFor('app-1');

    expect(() => groups.selectTier(stranger)).toThrow(/not in any loaded group/);
  });

  it('refreshFor clears selection when switching apps', async () => {
    const repo = stubRepo();
    const group = mkGroup('sg-1', repo);
    const tier = mkTier('sub-1', 'sg-1');
    repo.list = vi.fn().mockResolvedValue([group]);
    repo.subscriptions = vi.fn().mockResolvedValue([tier]);
    const groups = new SubscriptionGroups(repo);
    await groups.refreshFor('app-1');
    groups.selectTier(tier);

    await groups.refreshFor('app-2');

    expect(groups.selectedTier).toBeNull();
  });
});
