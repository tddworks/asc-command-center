import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
import { Subscription } from './Subscription.ts';
import type { CreateSubscriptionInput } from './SubscriptionRepository.ts';
import type { SubscriptionGroupRepository } from './SubscriptionGroupRepository.ts';

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
