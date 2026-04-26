import type { Subscription, SubscriptionPeriod } from './Subscription.ts';

export interface CreateSubscriptionInput {
  groupId: string;
  name: string;
  productId: string;
  subscriptionPeriod: SubscriptionPeriod | string;
  isFamilySharable: boolean;
}

/** Port for individual subscription tier mutations. The group-level
 *  CRUD lives on `SubscriptionGroupRepository`. */
export interface SubscriptionRepository {
  get(id: string): Promise<Subscription>;
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
