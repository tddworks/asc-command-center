import { makeAutoObservable, runInAction } from 'mobx';
import { SubscriptionGroup } from './SubscriptionGroup.ts';
import type { SubscriptionGroupRepository } from './SubscriptionGroupRepository.ts';

/**
 * Root aggregate for the Subscriptions page. Mirrors `InAppPurchases` —
 * holds the loaded list, exposes display getters, owns `refreshFor`,
 * `create`, `remove`. Tiers are loaded lazily via
 * `group.loadSubscriptions()`.
 */
export class SubscriptionGroups {
  repository: SubscriptionGroupRepository;

  list: SubscriptionGroup[] = [];
  appId: string | null = null;

  isLoading = false;
  loaded = false;
  error: Error | null = null;

  constructor(repository: SubscriptionGroupRepository) {
    this.repository = repository;
    makeAutoObservable(this, { repository: false });
  }

  // ── Display ──

  get count(): number { return this.list.length; }

  get totalTierCount(): number {
    return this.list.reduce((sum, g) => sum + g.tierCount, 0);
  }

  // ── Mutators ──

  switchRepository(repo: SubscriptionGroupRepository): void {
    this.repository = repo;
    this.list = [];
    this.appId = null;
    this.loaded = false;
    this.error = null;
  }

  async refreshFor(appId: string): Promise<void> {
    this.appId = appId;
    this.isLoading = true;
    this.error = null;
    try {
      const fetched = await this.repository.list(appId);
      runInAction(() => {
        if (this.appId !== appId) return;
        this.list = fetched;
        this.loaded = true;
      });
      // Hydrate child tiers in parallel so the page stats reflect the full
      // tree on first paint. Per-group failures degrade silently — the
      // group still appears, just without tiers.
      await Promise.all(
        fetched.map((g) => g.loadSubscriptions().catch((err) => {
          console.warn(`[subscription-groups] loadSubscriptions ${g.id} failed:`, err);
          return [];
        })),
      );
    } catch (err) {
      runInAction(() => {
        this.error = err as Error;
        this.loaded = true;
      });
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async create(input: { appId: string; referenceName: string }): Promise<SubscriptionGroup> {
    const created = await this.repository.create(input);
    runInAction(() => { this.list = [...this.list, created]; });
    return created;
  }

  async remove(group: SubscriptionGroup): Promise<void> {
    if (!group.canDelete) {
      throw new Error(`SubscriptionGroup ${group.id} cannot be deleted (no delete affordance)`);
    }
    await this.repository.remove(group);
    runInAction(() => { this.list = this.list.filter((g) => g.id !== group.id); });
  }

  byId(id: string): SubscriptionGroup | undefined {
    return this.list.find((g) => g.id === id);
  }
}
