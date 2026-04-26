import { describe, it, expect, vi } from 'vitest';
import {
  InAppPurchaseLocalization,
  IAP_LOCALIZATION_NAME_LIMIT,
  IAP_LOCALIZATION_DESCRIPTION_LIMIT,
} from '../../../src/monetization/iap/InAppPurchaseLocalization.ts';
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
    createOfferCode: vi.fn(),
    setPrice: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('InAppPurchaseLocalization', () => {

  // ── Identity ──

  it('isNew is true when id is empty (locally added, not yet saved)', () => {
    const fresh = new InAppPurchaseLocalization({ id: '', locale: 'en-US', name: '', description: null });
    const persisted = new InAppPurchaseLocalization({ id: 'loc-1', locale: 'en-US', name: 'X', description: null });
    expect(fresh.isNew).toBe(true);
    expect(persisted.isNew).toBe(false);
  });

  // ── Completion ──

  it('isComplete requires a non-empty trimmed name', () => {
    expect(new InAppPurchaseLocalization({ id: 'l-1', locale: 'en-US', name: '', description: null }).isComplete).toBe(false);
    expect(new InAppPurchaseLocalization({ id: 'l-1', locale: 'en-US', name: '   ', description: null }).isComplete).toBe(false);
    expect(new InAppPurchaseLocalization({ id: 'l-1', locale: 'en-US', name: 'Premium', description: null }).isComplete).toBe(true);
  });

  // ── Char limit getters ──

  it('nameRemaining and descriptionRemaining track remaining chars', () => {
    const loc = new InAppPurchaseLocalization({ id: 'l-1', locale: 'en-US', name: 'Hello', description: 'World' });
    expect(loc.nameRemaining).toBe(IAP_LOCALIZATION_NAME_LIMIT - 5);
    expect(loc.descriptionRemaining).toBe(IAP_LOCALIZATION_DESCRIPTION_LIMIT - 5);
  });

  // ── Capability checks ──

  it('canUpdate / canDelete accept short and long affordance keys', () => {
    const shortAffordances = new InAppPurchaseLocalization({
      id: 'l-1', locale: 'en-US', name: 'X', description: null,
      affordances: { update: '/x', delete: '/y' },
    });
    expect(shortAffordances.canUpdate).toBe(true);
    expect(shortAffordances.canDelete).toBe(true);

    const longAffordances = new InAppPurchaseLocalization({
      id: 'l-1', locale: 'en-US', name: 'X', description: null,
      affordances: { updateLocalization: '/x', deleteLocalization: '/y' },
    });
    expect(longAffordances.canUpdate).toBe(true);
    expect(longAffordances.canDelete).toBe(true);

    const none = new InAppPurchaseLocalization({ id: 'l-1', locale: 'en-US', name: 'X', description: null });
    expect(none.canUpdate).toBe(false);
    expect(none.canDelete).toBe(false);
  });

  // ── Setters + dirty tracking ──

  it('starts not-dirty and becomes dirty after a setter is called', () => {
    const loc = new InAppPurchaseLocalization({ id: 'l-1', locale: 'en-US', name: 'Premium', description: 'Unlock all' });
    expect(loc.hasUnsavedChanges).toBe(false);

    loc.setName('Premium Plus');
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('discard restores the last saved values', () => {
    const loc = new InAppPurchaseLocalization({ id: 'l-1', locale: 'en-US', name: 'Premium', description: 'Unlock' });

    loc.setName('Modified');
    loc.setDescription('New desc');
    loc.discard();

    expect(loc.name).toBe('Premium');
    expect(loc.description).toBe('Unlock');
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  it('markSaved snapshots current state and optionally backfills the id', () => {
    const loc = new InAppPurchaseLocalization({ id: '', locale: 'en-US', name: 'New', description: null });
    loc.markSaved('loc-99');

    expect(loc.id).toBe('loc-99');
    expect(loc.hasUnsavedChanges).toBe(false);
    expect(loc.isNew).toBe(false);
  });

  // ── Self-persistence ──

  it('save calls repo.saveLocalization and clears dirty', async () => {
    const repo = stubRepo();
    const loc = new InAppPurchaseLocalization({ id: 'l-1', locale: 'en-US', name: 'Premium', description: 'Unlock' });
    loc.setRepository(repo);

    loc.setName('Premium Plus');
    expect(loc.hasUnsavedChanges).toBe(true);

    await loc.save();

    expect(repo.saveLocalization).toHaveBeenCalledWith(loc);
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  it('save throws when no repository is attached', async () => {
    const loc = new InAppPurchaseLocalization({ id: 'l-1', locale: 'en-US', name: 'X', description: null });
    await expect(loc.save()).rejects.toThrow(/no repository/);
  });

  it('delete calls repo.deleteLocalization', async () => {
    const repo = stubRepo();
    const loc = new InAppPurchaseLocalization({ id: 'l-1', locale: 'en-US', name: 'X', description: null });
    loc.setRepository(repo);

    await loc.delete();

    expect(repo.deleteLocalization).toHaveBeenCalledWith(loc);
  });

  // ── fromJSON ──

  it('fromJSON hydrates the standard backend shape', () => {
    const loc = InAppPurchaseLocalization.fromJSON({
      id: 'loc-1',
      locale: 'fr-FR',
      name: 'Premium',
      description: 'Débloquer',
      affordances: { update: '/x' },
    });

    expect(loc.id).toBe('loc-1');
    expect(loc.locale).toBe('fr-FR');
    expect(loc.name).toBe('Premium');
    expect(loc.description).toBe('Débloquer');
    expect(loc.affordances.update).toBe('/x');
  });

  it('fromJSON tolerates missing description', () => {
    const loc = InAppPurchaseLocalization.fromJSON({ id: 'loc-2', locale: 'en-US', name: 'X' });
    expect(loc.description).toBeNull();
  });
});
