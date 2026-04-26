import type { Subscription } from './Subscription.ts';
import type { CreateSubscriptionInput } from './SubscriptionRepository.ts';
import type { SubscriptionGroup } from './SubscriptionGroup.ts';

/** Port for the SubscriptionGroups slice. Group-level CRUD plus the
 *  navigation methods child Subscriptions need (`subscriptions`,
 *  `createSubscription`, `removeSubscription`, `update`). Per-tier
 *  mutations also delegate here so one repository serves the whole tree. */
export interface SubscriptionGroupRepository {
  list(appId: string): Promise<SubscriptionGroup[]>;
  get(id: string): Promise<SubscriptionGroup>;
  create(input: { appId: string; referenceName: string }): Promise<SubscriptionGroup>;
  update(group: SubscriptionGroup, patch: { referenceName?: string }): Promise<void>;
  remove(group: SubscriptionGroup): Promise<void>;

  subscriptions(group: SubscriptionGroup): Promise<Subscription[]>;
  createSubscription(input: CreateSubscriptionInput): Promise<Subscription>;
  removeSubscription(sub: Subscription): Promise<void>;
}
