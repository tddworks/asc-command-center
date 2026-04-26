import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
import { Subscription } from './Subscription.ts';
import type { CreateSubscriptionInput } from './SubscriptionRepository.ts';
import type { SubscriptionGroupRepository } from './SubscriptionGroupRepository.ts';
import { SubscriptionGroupLocalization } from './SubscriptionGroupLocalization.ts';

export interface SubscriptionGroupInit {
  id: string;
  appId: string;
  referenceName: string;
  affordances: Affordances;
}

/**
 * SubscriptionGroup — aggregate root of the Subscriptions slice.
 * Owns its child Subscription tiers (loaded lazily via `loadSubscriptions`)
 * and the subscription-creation entry point (`createSubscription`).
 */
export class SubscriptionGroup {
  readonly id: string;
  readonly appId: string;
  referenceName: string;
  affordances: Affordances;

  /** Tiers loaded for this group. Populated by `loadSubscriptions`. */
  subscriptions: Subscription[] = [];

  /** Group-level localizations (display name + custom app name per locale). */
  groupLocalizations: SubscriptionGroupLocalization[] = [];
  isGroupLocalizationsLoaded = false;

  repository: SubscriptionGroupRepository | null;

  constructor(init: SubscriptionGroupInit, repository: SubscriptionGroupRepository | null = null) {
    this.id = init.id;
    this.appId = init.appId;
    this.referenceName = init.referenceName;
    this.affordances = init.affordances;
    this.repository = repository;

    makeAutoObservable(this, { id: false, appId: false, repository: false });
  }

  // ── Capability Checks ──

  get canDelete(): boolean { return 'delete' in this.affordances; }
  get canUpdate(): boolean { return 'update' in this.affordances; }
  get canViewSubscriptions(): boolean { return 'listSubscriptions' in this.affordances; }
  get canCreateSubscription(): boolean { return 'createSubscription' in this.affordances; }
  get canViewLocalizations(): boolean { return 'listLocalizations' in this.affordances; }
  get canViewGroupLocalizations(): boolean { return 'listLocalizations' in this.affordances; }
  get canCreateGroupLocalization(): boolean { return 'createLocalization' in this.affordances; }
  get canReorderSubscriptions(): boolean { return 'reorderSubscriptions' in this.affordances; }

  // ── Display ──

  get tierCount(): number { return this.subscriptions.length; }
  get hasApprovedTier(): boolean { return this.subscriptions.some((s) => s.isApproved); }

  // ── Mutators ──

  async loadSubscriptions(): Promise<Subscription[]> {
    if (!this.canViewSubscriptions) {
      runInAction(() => { this.subscriptions = []; });
      return [];
    }
    const list = await this.requireRepo().subscriptions(this);
    runInAction(() => { this.subscriptions = list; });
    return list;
  }

  async update(patch: { referenceName?: string }): Promise<void> {
    if (!this.canUpdate) {
      throw new Error(`SubscriptionGroup ${this.id} cannot be updated (no update affordance)`);
    }
    await this.requireRepo().update(this, patch);
    runInAction(() => {
      if (patch.referenceName !== undefined) this.referenceName = patch.referenceName;
    });
  }

  async createSubscription(input: Omit<CreateSubscriptionInput, 'groupId'>): Promise<Subscription> {
    if (!this.canCreateSubscription) {
      throw new Error(`SubscriptionGroup ${this.id} cannot create a subscription (no createSubscription affordance)`);
    }
    const created = await this.requireRepo().createSubscription({ ...input, groupId: this.id });
    runInAction(() => { this.subscriptions = [...this.subscriptions, created]; });
    return created;
  }

  // ── Group localization navigation (mutating) ──

  async loadGroupLocalizations(): Promise<SubscriptionGroupLocalization[]> {
    if (!this.canViewGroupLocalizations) {
      runInAction(() => {
        this.groupLocalizations = [];
        this.isGroupLocalizationsLoaded = true;
      });
      return [];
    }
    const repo = this.requireRepo();
    const list = await repo.groupLocalizations(this);
    runInAction(() => {
      list.forEach((l) => l.setRepository(repo));
      this.groupLocalizations = list;
      this.isGroupLocalizationsLoaded = true;
    });
    return list;
  }

  async addGroupLocalization(input: { locale: string; name: string; customAppName?: string | null }): Promise<SubscriptionGroupLocalization> {
    if (!this.canCreateGroupLocalization) {
      throw new Error(`SubscriptionGroup ${this.id} cannot create a localization (no createLocalization affordance)`);
    }
    const repo = this.requireRepo();
    const created = await repo.createGroupLocalization(this, input);
    runInAction(() => {
      created.setRepository(repo);
      this.groupLocalizations = [...this.groupLocalizations, created];
    });
    return created;
  }

  async removeGroupLocalization(loc: SubscriptionGroupLocalization): Promise<void> {
    if (!loc.canDelete) {
      throw new Error(`Group localization ${loc.locale} cannot be deleted (no delete affordance)`);
    }
    await loc.delete();
    runInAction(() => {
      this.groupLocalizations = this.groupLocalizations.filter((l) => l !== loc);
    });
  }

  /** Reorder the group's tiers. Pass the ids in the desired order — Apple
   *  assigns the level (1-indexed) by position. We mutate `subscriptions`
   *  in place to reflect the new order + new groupLevel on each tier so
   *  the page re-renders without a refetch. */
  async reorderSubscriptions(orderedIds: string[]): Promise<void> {
    if (!this.canReorderSubscriptions) {
      throw new Error(`SubscriptionGroup ${this.id} cannot reorder subscriptions (no reorderSubscriptions affordance)`);
    }
    await this.requireRepo().reorderSubscriptions(this, orderedIds);
    runInAction(() => {
      const byId = new Map(this.subscriptions.map((s) => [s.id, s]));
      const next: Subscription[] = [];
      orderedIds.forEach((id, idx) => {
        const tier = byId.get(id);
        if (!tier) return;
        tier.groupLevel = idx + 1;
        next.push(tier);
      });
      this.subscriptions = next;
    });
  }

  async removeSubscription(sub: Subscription): Promise<void> {
    if (!sub.canDelete) {
      throw new Error(`Subscription ${sub.id} cannot be deleted (no delete affordance)`);
    }
    await this.requireRepo().removeSubscription(sub);
    runInAction(() => { this.subscriptions = this.subscriptions.filter((s) => s.id !== sub.id); });
  }

  setRepository(repo: SubscriptionGroupRepository): void {
    this.repository = repo;
  }

  private requireRepo(): SubscriptionGroupRepository {
    if (!this.repository) {
      throw new Error(`SubscriptionGroup ${this.id} has no repository attached`);
    }
    return this.repository;
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>, repo?: SubscriptionGroupRepository): SubscriptionGroup {
    return new SubscriptionGroup(
      {
        id: (json.id as string) ?? '',
        appId: (json.appId as string) ?? '',
        referenceName: (json.referenceName as string) ?? '',
        affordances: (json.affordances as Affordances) ?? {},
      },
      repo ?? null,
    );
  }
}
