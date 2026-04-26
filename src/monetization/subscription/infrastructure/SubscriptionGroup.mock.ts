import { Subscription, SubscriptionPeriod, SubscriptionState } from '../Subscription.ts';
import { SubscriptionGroup } from '../SubscriptionGroup.ts';
import { SubscriptionLocalization } from '../SubscriptionLocalization.ts';
import type {
  CreateSubscriptionInput,
  CreateSubscriptionLocalizationInput,
  SubscriptionRepository,
} from '../SubscriptionRepository.ts';
import type { SubscriptionGroupRepository } from '../SubscriptionGroupRepository.ts';

/** Deterministic in-memory repo seeding two groups + tier fixtures so the
 *  page exercises both the count badges and the per-tier action buttons. */
export class MockSubscriptionGroupRepository implements SubscriptionGroupRepository, SubscriptionRepository {
  private groupsByApp = new Map<string, SubscriptionGroup[]>();
  private tiersByGroup = new Map<string, Subscription[]>();
  private localizationsByTier = new Map<string, SubscriptionLocalization[]>();
  private nextLocId = 500;

  async list(appId: string): Promise<SubscriptionGroup[]> {
    if (!this.groupsByApp.has(appId)) {
      this.seed(appId);
    }
    return [...this.groupsByApp.get(appId)!];
  }

  async get(id: string): Promise<SubscriptionGroup> {
    for (const list of this.groupsByApp.values()) {
      const found = list.find((g) => g.id === id);
      if (found) return found;
    }
    throw new Error(`SubscriptionGroup ${id} not found`);
  }

  async create(input: { appId: string; referenceName: string }): Promise<SubscriptionGroup> {
    if (!this.groupsByApp.has(input.appId)) this.seed(input.appId);
    const id = `sg-mock-${Date.now()}`;
    const group = new SubscriptionGroup(
      { id, appId: input.appId, referenceName: input.referenceName, affordances: this.groupAffordances(id) },
      this,
    );
    this.groupsByApp.get(input.appId)!.push(group);
    this.tiersByGroup.set(id, []);
    return group;
  }

  async subscriptions(group: SubscriptionGroup): Promise<Subscription[]> {
    return [...(this.tiersByGroup.get(group.id) ?? [])];
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    const id = `sub-mock-${Date.now()}`;
    const sub = new Subscription(
      {
        id,
        groupId: input.groupId,
        name: input.name,
        productId: input.productId,
        subscriptionPeriod: input.subscriptionPeriod,
        isFamilySharable: input.isFamilySharable,
        state: SubscriptionState.MissingMetadata,
        affordances: this.tierAffordances(id),
      },
      this,
    );
    const list = this.tiersByGroup.get(input.groupId) ?? [];
    list.push(sub);
    this.tiersByGroup.set(input.groupId, list);
    return sub;
  }

  async removeSubscription(sub: Subscription): Promise<void> {
    return this.remove(sub);
  }

  update(group: SubscriptionGroup, patch: { referenceName?: string }): Promise<void>;
  update(sub: Subscription, patch: Record<string, unknown>): Promise<void>;
  async update(_target: SubscriptionGroup | Subscription, _patch: Record<string, unknown>): Promise<void> {
    // Domain mutates `this` after the awaited call returns.
  }

  remove(group: SubscriptionGroup): Promise<void>;
  remove(sub: Subscription): Promise<void>;
  async remove(target: SubscriptionGroup | Subscription): Promise<void> {
    if ((target as SubscriptionGroup).appId !== undefined) {
      const group = target as SubscriptionGroup;
      const list = this.groupsByApp.get(group.appId);
      if (list) this.groupsByApp.set(group.appId, list.filter((g) => g.id !== group.id));
      this.tiersByGroup.delete(group.id);
      return;
    }
    const sub = target as Subscription;
    const list = this.tiersByGroup.get(sub.groupId);
    if (list) this.tiersByGroup.set(sub.groupId, list.filter((s) => s.id !== sub.id));
  }

  async submit(_sub: Subscription): Promise<void> {}
  async unsubmit(_sub: Subscription): Promise<void> {}

  // ── Localizations ──

  async localizations(sub: Subscription): Promise<SubscriptionLocalization[]> {
    const cached = this.localizationsByTier.get(sub.id);
    if (cached) return cached.map((l) => l);
    const seeded = this.seedLocalizationsFor(sub);
    this.localizationsByTier.set(sub.id, seeded);
    return seeded.map((l) => l);
  }

  async createLocalization(
    sub: Subscription,
    input: CreateSubscriptionLocalizationInput,
  ): Promise<SubscriptionLocalization> {
    const id = `sub-loc-${this.nextLocId++}`;
    const created = new SubscriptionLocalization({
      id,
      locale: input.locale,
      name: input.name,
      description: input.description ?? null,
      affordances: this.localizationAffordances(id),
    });
    const list = this.localizationsByTier.get(sub.id) ?? [];
    list.push(created);
    this.localizationsByTier.set(sub.id, list);
    return created;
  }

  async saveLocalization(_loc: SubscriptionLocalization): Promise<void> {
    // Mutated in place by the domain after save resolves.
  }

  async deleteLocalization(loc: SubscriptionLocalization): Promise<void> {
    for (const [tierId, list] of this.localizationsByTier.entries()) {
      const next = list.filter((l) => l !== loc);
      if (next.length !== list.length) {
        this.localizationsByTier.set(tierId, next);
        return;
      }
    }
  }

  private localizationAffordances(id: string): Record<string, string> {
    return {
      update: `/api/v1/subscription-localizations/${id}`,
      delete: `/api/v1/subscription-localizations/${id}`,
    };
  }

  private seedLocalizationsFor(sub: Subscription): SubscriptionLocalization[] {
    const id = `sub-loc-en-${sub.id}`;
    return [
      new SubscriptionLocalization({
        id,
        locale: 'en-US',
        name: sub.name,
        description: `${sub.periodLabel} ${sub.name} subscription.`,
        affordances: this.localizationAffordances(id),
      }),
    ];
  }

  private groupAffordances(id: string): Record<string, string> {
    return {
      get: `/api/v1/subscription-groups/${id}`,
      update: `/api/v1/subscription-groups/${id}`,
      delete: `/api/v1/subscription-groups/${id}`,
      listSubscriptions: `/api/v1/subscription-groups/${id}/subscriptions`,
      createSubscription: `/api/v1/subscription-groups/${id}/subscriptions`,
      listLocalizations: `/api/v1/subscription-groups/${id}/localizations`,
    };
  }

  private tierAffordances(id: string): Record<string, string> {
    return {
      get: `/api/v1/subscriptions/${id}`,
      update: `/api/v1/subscriptions/${id}`,
      delete: `/api/v1/subscriptions/${id}`,
      submit: `/api/v1/subscriptions/${id}/submit`,
      unsubmit: `/api/v1/subscriptions/${id}/submit`,
      listLocalizations: `/api/v1/subscriptions/${id}/localizations`,
      createLocalization: `/api/v1/subscriptions/${id}/localizations`,
      getPriceSchedule: `/api/v1/subscriptions/${id}/price-schedule`,
      getAvailability: `/api/v1/subscriptions/${id}/availability`,
      listOfferCodes: `/api/v1/subscriptions/${id}/offer-codes`,
      listIntroOffers: `/api/v1/subscriptions/${id}/intro-offers`,
      listPromoOffers: `/api/v1/subscriptions/${id}/promo-offers`,
    };
  }

  private seed(appId: string): void {
    const premium = new SubscriptionGroup(
      { id: 'sg-1', appId, referenceName: 'Premium Plans', affordances: this.groupAffordances('sg-1') },
      this,
    );
    const addon = new SubscriptionGroup(
      { id: 'sg-2', appId, referenceName: 'Add-on Features', affordances: this.groupAffordances('sg-2') },
      this,
    );
    this.groupsByApp.set(appId, [premium, addon]);

    const mkTier = (
      id: string,
      groupId: string,
      name: string,
      productId: string,
      period: string,
      state: string,
      family = false,
      level: number | null = null,
      hasSubmission = false,
    ): Subscription =>
      new Subscription(
        {
          id, groupId, name, productId,
          subscriptionPeriod: period,
          isFamilySharable: family,
          state,
          groupLevel: level,
          hasSubmission,
          affordances: this.tierAffordances(id),
        },
        this,
      );

    this.tiersByGroup.set('sg-1', [
      mkTier('sub-1', 'sg-1', 'Premium Monthly', 'com.example.premium.monthly', SubscriptionPeriod.OneMonth, SubscriptionState.Approved, true, 1),
      mkTier('sub-2', 'sg-1', 'Premium Yearly', 'com.example.premium.yearly', SubscriptionPeriod.OneYear, SubscriptionState.Approved, true, 2),
      mkTier('sub-3', 'sg-1', 'Premium Plus', 'com.example.premium.plus', SubscriptionPeriod.OneMonth, SubscriptionState.ReadyToSubmit, false, 3),
    ]);
    this.tiersByGroup.set('sg-2', [
      mkTier('sub-4', 'sg-2', 'Cloud Backup', 'com.example.addon.cloud', SubscriptionPeriod.OneMonth, SubscriptionState.WaitingForReview, false, 1, true),
    ]);
  }
}
