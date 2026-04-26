import type { Subscription, SubscriptionPeriod } from './Subscription.ts';

export interface CreateSubscriptionInput {
  groupId: string;
  name: string;
  productId: string;
  subscriptionPeriod: SubscriptionPeriod | string;
  isFamilySharable: boolean;
}

/** Port for individual subscription tier mutations. The group-level
 *  CRUD lives on `SubscriptionGroupRepository`. Tier `get` is intentionally
 *  not on this port — single-tier reload would collide with the group's
 *  `get(id)` when one REST handle implements both interfaces. */
export interface SubscriptionRepository {
  update(
    sub: Subscription,
    patch: {
      name?: string;
      subscriptionPeriod?: SubscriptionPeriod | string;
      isFamilySharable?: boolean;
      groupLevel?: number | null;
      reviewNote?: string | null;
    },
  ): Promise<void>;
  remove(sub: Subscription): Promise<void>;
  submit(sub: Subscription): Promise<void>;
  unsubmit(sub: Subscription): Promise<void>;
}
