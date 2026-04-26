import { Subscription } from '../Subscription.ts';
import { SubscriptionGroup } from '../SubscriptionGroup.ts';
import { apiClient, type DataMode } from '../../../shared/api-client.tsx';
import type { CreateSubscriptionInput, SubscriptionRepository } from '../SubscriptionRepository.ts';
import type { SubscriptionGroupRepository } from '../SubscriptionGroupRepository.ts';

/** True for SubscriptionGroup (has appId) — used by the shared REST handle
 *  to pick the right URL when implementing both ports' `update`/`remove`. */
function isGroup(target: SubscriptionGroup | Subscription): target is SubscriptionGroup {
  return (target as SubscriptionGroup).appId !== undefined;
}

/**
 * REST implementation of both the SubscriptionGroup and per-tier
 * Subscription ports. Sharing one class so a Subscription hydrated under a
 * group reuses the same handle — `update`/`remove` are overloaded so each
 * interface's method shape is preserved.
 */
export class RestSubscriptionGroupRepository implements SubscriptionGroupRepository, SubscriptionRepository {
  async list(appId: string): Promise<SubscriptionGroup[]> {
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(
      `/api/v1/apps/${appId}/subscription-groups`,
    );
    return json.data.map((row) => SubscriptionGroup.fromJSON(row, this));
  }

  async get(id: string): Promise<SubscriptionGroup> {
    const json = await apiClient.get<{ data: Record<string, unknown> }>(`/api/v1/subscription-groups/${id}`);
    const row = Array.isArray(json.data) ? (json.data as Record<string, unknown>[])[0] : json.data;
    return SubscriptionGroup.fromJSON(row ?? {}, this);
  }

  async create(input: { appId: string; referenceName: string }): Promise<SubscriptionGroup> {
    const url = `/api/v1/apps/${input.appId}/subscription-groups`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenceName: input.referenceName }),
    });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    const body = await res.json().catch(() => ({}));
    const data = (body.data ?? body) as Record<string, unknown>;
    return SubscriptionGroup.fromJSON({ ...data, appId: input.appId }, this);
  }

  async subscriptions(group: SubscriptionGroup): Promise<Subscription[]> {
    const url = group.affordances.listSubscriptions ?? `/api/v1/subscription-groups/${group.id}/subscriptions`;
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(url);
    return json.data.map((row) => Subscription.fromJSON({ ...row, groupId: group.id }, this));
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    const url = `/api/v1/subscription-groups/${input.groupId}/subscriptions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        productId: input.productId,
        subscriptionPeriod: input.subscriptionPeriod,
        isFamilySharable: input.isFamilySharable,
      }),
    });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    const body = await res.json().catch(() => ({}));
    const data = (body.data ?? body) as Record<string, unknown>;
    return Subscription.fromJSON({ ...data, groupId: input.groupId }, this);
  }

  async removeSubscription(sub: Subscription): Promise<void> {
    return this.remove(sub);
  }

  // Overloads satisfy both SubscriptionGroupRepository.update / remove
  // and SubscriptionRepository.update / remove from a single REST handle.

  update(group: SubscriptionGroup, patch: { referenceName?: string }): Promise<void>;
  update(
    sub: Subscription,
    patch: {
      name?: string;
      subscriptionPeriod?: string;
      isFamilySharable?: boolean;
      groupLevel?: number | null;
      reviewNote?: string | null;
    },
  ): Promise<void>;
  async update(target: SubscriptionGroup | Subscription, patch: Record<string, unknown>): Promise<void> {
    const fallback = isGroup(target)
      ? `/api/v1/subscription-groups/${target.id}`
      : `/api/v1/subscriptions/${target.id}`;
    const url = target.affordances.update ?? fallback;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`PATCH ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  remove(group: SubscriptionGroup): Promise<void>;
  remove(sub: Subscription): Promise<void>;
  async remove(target: SubscriptionGroup | Subscription): Promise<void> {
    const fallback = isGroup(target)
      ? `/api/v1/subscription-groups/${target.id}`
      : `/api/v1/subscriptions/${target.id}`;
    const url = target.affordances.delete ?? fallback;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  async submit(sub: Subscription): Promise<void> {
    const url = sub.affordances.submit;
    if (!url) throw new Error(`Subscription ${sub.id} has no submit affordance`);
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  async unsubmit(sub: Subscription): Promise<void> {
    const url = sub.affordances.unsubmit;
    if (!url) throw new Error(`Subscription ${sub.id} has no unsubmit affordance`);
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
}

export async function repositoryFor(mode: DataMode): Promise<SubscriptionGroupRepository & SubscriptionRepository> {
  if (mode === 'mock') {
    const { MockSubscriptionGroupRepository } = await import('./SubscriptionGroup.mock.ts');
    return new MockSubscriptionGroupRepository();
  }
  return new RestSubscriptionGroupRepository();
}
