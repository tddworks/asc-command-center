import { describe, it, expect, vi } from 'vitest';
import {
  SubscriptionGroupLocalization,
  SUBSCRIPTION_GROUP_NAME_LIMIT,
  SUBSCRIPTION_GROUP_CUSTOM_APP_NAME_LIMIT,
} from '../../../src/monetization/subscription/SubscriptionGroupLocalization.ts';
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

describe('SubscriptionGroupLocalization', () => {

  it('isNew is true when id is empty', () => {
    expect(new SubscriptionGroupLocalization({ id: '', locale: 'en-US', name: '', customAppName: null }).isNew).toBe(true);
    expect(new SubscriptionGroupLocalization({ id: 'l-1', locale: 'en-US', name: 'X', customAppName: null }).isNew).toBe(false);
  });

  it('isComplete requires non-empty trimmed name', () => {
    expect(new SubscriptionGroupLocalization({ id: 'l-1', locale: 'en-US', name: '   ', customAppName: null }).isComplete).toBe(false);
    expect(new SubscriptionGroupLocalization({ id: 'l-1', locale: 'en-US', name: 'Premium Plans', customAppName: null }).isComplete).toBe(true);
  });

  it('nameRemaining and customAppNameRemaining track remaining chars', () => {
    const loc = new SubscriptionGroupLocalization({ id: 'l-1', locale: 'en-US', name: 'Hello', customAppName: 'WorldApp' });
    expect(loc.nameRemaining).toBe(SUBSCRIPTION_GROUP_NAME_LIMIT - 5);
    expect(loc.customAppNameRemaining).toBe(SUBSCRIPTION_GROUP_CUSTOM_APP_NAME_LIMIT - 8);
  });

  it('canUpdate / canDelete accept short and long affordance keys', () => {
    expect(new SubscriptionGroupLocalization({ id: 'l-1', locale: 'en-US', name: 'X', customAppName: null, affordances: { update: '/x' } }).canUpdate).toBe(true);
    expect(new SubscriptionGroupLocalization({ id: 'l-1', locale: 'en-US', name: 'X', customAppName: null, affordances: { updateLocalization: '/x' } }).canUpdate).toBe(true);
    expect(new SubscriptionGroupLocalization({ id: 'l-1', locale: 'en-US', name: 'X', customAppName: null, affordances: { delete: '/x' } }).canDelete).toBe(true);
  });

  it('hasUnsavedChanges flips after a setter and reverts via discard', () => {
    const loc = new SubscriptionGroupLocalization({ id: 'l-1', locale: 'en-US', name: 'Premium', customAppName: 'PremiumApp' });
    expect(loc.hasUnsavedChanges).toBe(false);
    loc.setName('Modified');
    expect(loc.hasUnsavedChanges).toBe(true);
    loc.setCustomAppName('Other');
    loc.discard();
    expect(loc.name).toBe('Premium');
    expect(loc.customAppName).toBe('PremiumApp');
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  it('save calls repo.saveGroupLocalization and clears dirty', async () => {
    const repo = stubRepo();
    const loc = new SubscriptionGroupLocalization({ id: 'l-1', locale: 'en-US', name: 'X', customAppName: null });
    loc.setRepository(repo);
    loc.setName('Y');

    await loc.save();

    expect(repo.saveGroupLocalization).toHaveBeenCalledWith(loc);
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  it('delete calls repo.deleteGroupLocalization', async () => {
    const repo = stubRepo();
    const loc = new SubscriptionGroupLocalization({ id: 'l-1', locale: 'en-US', name: 'X', customAppName: null });
    loc.setRepository(repo);

    await loc.delete();

    expect(repo.deleteGroupLocalization).toHaveBeenCalledWith(loc);
  });

  it('fromJSON tolerates missing customAppName', () => {
    const loc = SubscriptionGroupLocalization.fromJSON({ id: 'l-2', locale: 'fr-FR', name: 'X' });
    expect(loc.customAppName).toBeNull();
  });

  // ── LocalizationLike adapter (lets shared LocalizationsTab render groups) ──

  it('description aliases customAppName', () => {
    const loc = new SubscriptionGroupLocalization({ id: 'l-1', locale: 'en-US', name: 'X', customAppName: 'Bundle Override' });
    expect(loc.description).toBe('Bundle Override');
    loc.setDescription('Different Override');
    expect(loc.customAppName).toBe('Different Override');
    loc.setDescription(null);
    expect(loc.customAppName).toBeNull();
  });

  it('descriptionRemaining matches customAppNameRemaining', () => {
    const loc = new SubscriptionGroupLocalization({ id: 'l-1', locale: 'en-US', name: 'X', customAppName: 'WorldApp' });
    expect(loc.descriptionRemaining).toBe(loc.customAppNameRemaining);
  });
});
