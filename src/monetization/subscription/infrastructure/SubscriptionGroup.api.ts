import { Subscription } from '../Subscription.ts';
import { SubscriptionGroup } from '../SubscriptionGroup.ts';
import { SubscriptionLocalization } from '../SubscriptionLocalization.ts';
import { SubscriptionGroupLocalization } from '../SubscriptionGroupLocalization.ts';
import { SubscriptionAvailability } from '../SubscriptionAvailability.ts';
import { SubscriptionPriceSchedule } from '../SubscriptionPriceSchedule.ts';
import { SubscriptionPricePoint, type SubscriptionPricePointPage } from '../SubscriptionPricePoint.ts';
import { SubscriptionReviewScreenshot } from '../SubscriptionReviewScreenshot.ts';
import {
  SubscriptionIntroductoryOffer,
  SubscriptionOfferCode,
  SubscriptionPromotionalOffer,
} from '../SubscriptionOffers.ts';
import { WinBackOffer } from '../WinBackOffer.ts';
import { apiClient, normalizeLinks, type DataMode } from '../../../shared/api-client.tsx';
import type {
  CreateIntroductoryOfferInput,
  CreatePromotionalOfferInput,
  CreateSubscriptionInput,
  CreateSubscriptionLocalizationInput,
  CreateSubscriptionOfferCodeInput,
  SubscriptionRepository,
} from '../SubscriptionRepository.ts';
import type {
  CreateSubscriptionGroupLocalizationInput,
  SubscriptionGroupRepository,
} from '../SubscriptionGroupRepository.ts';

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

  async reorderSubscriptions(group: SubscriptionGroup, orderedIds: string[]): Promise<void> {
    const url = group.affordances.reorderSubscriptions
      ?? `/api/v1/subscription-groups/${group.id}/subscriptions/reorder`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
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

  // ── Group localizations ──

  async groupLocalizations(group: SubscriptionGroup): Promise<SubscriptionGroupLocalization[]> {
    const url = group.affordances.listLocalizations ?? `/api/v1/subscription-groups/${group.id}/localizations`;
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(url);
    return json.data.map(SubscriptionGroupLocalization.fromJSON);
  }

  async createGroupLocalization(
    group: SubscriptionGroup,
    input: CreateSubscriptionGroupLocalizationInput,
  ): Promise<SubscriptionGroupLocalization> {
    const url = group.affordances.createLocalization ?? `/api/v1/subscription-groups/${group.id}/localizations`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale: input.locale,
        name: input.name,
        customAppName: input.customAppName ?? null,
      }),
    });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    // asc-cli wraps create responses in `data: [{…}]`, same envelope as
    // list. Tolerate both shapes. Run normalizeLinks so the response's
    // `_links` become flat `affordances` (POST skips apiClient.get's
    // normalization).
    const body = normalizeLinks(await res.json().catch(() => ({}))) as { data?: unknown };
    const raw = body.data ?? body;
    const row = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
    return SubscriptionGroupLocalization.fromJSON(row);
  }

  async saveGroupLocalization(loc: SubscriptionGroupLocalization): Promise<void> {
    const url = loc.affordances.update ?? loc.affordances.updateLocalization
      ?? `/api/v1/subscription-group-localizations/${loc.id}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: loc.name, customAppName: loc.customAppName }),
    });
    if (!res.ok) throw new Error(`PATCH ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  async deleteGroupLocalization(loc: SubscriptionGroupLocalization): Promise<void> {
    const url = loc.affordances.delete ?? loc.affordances.deleteLocalization
      ?? `/api/v1/subscription-group-localizations/${loc.id}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  // ── Localizations (subscription tier) ──

  async localizations(sub: Subscription): Promise<SubscriptionLocalization[]> {
    const url = sub.affordances.listLocalizations ?? `/api/v1/subscriptions/${sub.id}/localizations`;
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(url);
    return json.data.map(SubscriptionLocalization.fromJSON);
  }

  async createLocalization(
    sub: Subscription,
    input: CreateSubscriptionLocalizationInput,
  ): Promise<SubscriptionLocalization> {
    const url = sub.affordances.createLocalization ?? `/api/v1/subscriptions/${sub.id}/localizations`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale: input.locale,
        name: input.name,
        description: input.description ?? null,
      }),
    });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    const body = normalizeLinks(await res.json().catch(() => ({}))) as { data?: unknown };
    const raw = body.data ?? body;
    const row = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
    return SubscriptionLocalization.fromJSON(row);
  }

  async saveLocalization(loc: SubscriptionLocalization): Promise<void> {
    const url = loc.updateUrl ?? `/api/v1/subscription-localizations/${loc.id}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: loc.name, description: loc.description }),
    });
    if (!res.ok) throw new Error(`PATCH ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  async deleteLocalization(loc: SubscriptionLocalization): Promise<void> {
    const url = loc.deleteUrl ?? `/api/v1/subscription-localizations/${loc.id}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  // ── Review screenshot ──

  async reviewScreenshot(sub: Subscription): Promise<SubscriptionReviewScreenshot | null> {
    const url = sub.affordances.getReviewScreenshot ?? `/api/v1/subscriptions/${sub.id}/review-screenshot`;
    try {
      const json = await apiClient.get<{ data: Record<string, unknown> | null }>(url);
      const row = Array.isArray(json.data) ? (json.data as Record<string, unknown>[])[0] : json.data;
      return row ? SubscriptionReviewScreenshot.fromJSON(row) : null;
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('404')) return null;
      throw err;
    }
  }

  async uploadReviewScreenshot(sub: Subscription, file: File): Promise<SubscriptionReviewScreenshot> {
    const url = sub.affordances.uploadReviewScreenshot ?? `/api/v1/subscriptions/${sub.id}/review-screenshot`;
    const body = new FormData();
    body.append('file', file, file.name);
    const res = await fetch(url, { method: 'POST', body });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    const json = await res.json().catch(() => ({}));
    const data = (json.data ?? json) as Record<string, unknown>;
    return SubscriptionReviewScreenshot.fromJSON(data);
  }

  async deleteReviewScreenshot(sub: Subscription, screenshot: SubscriptionReviewScreenshot): Promise<void> {
    const url = screenshot.deleteUrl ?? `/api/v1/subscriptions/${sub.id}/review-screenshot`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  // ── Availability ──

  async availability(sub: Subscription): Promise<SubscriptionAvailability | null> {
    const url = sub.affordances.getAvailability ?? `/api/v1/subscriptions/${sub.id}/availability`;
    try {
      const json = await apiClient.get<{ data: Record<string, unknown> | null }>(url);
      const row = Array.isArray(json.data) ? (json.data as Record<string, unknown>[])[0] : json.data;
      return row ? SubscriptionAvailability.fromJSON(row) : null;
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('404')) return null;
      throw err;
    }
  }

  async setAvailability(
    sub: Subscription,
    input: { territoryIds: string[]; availableInNewTerritories: boolean },
  ): Promise<void> {
    const url = sub.affordances.setAvailability ?? `/api/v1/subscriptions/${sub.id}/availability`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`PATCH ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  // ── Pricing ──

  async priceSchedule(sub: Subscription): Promise<SubscriptionPriceSchedule | null> {
    const url = sub.affordances.getPriceSchedule ?? `/api/v1/subscriptions/${sub.id}/price-schedule`;
    try {
      const json = await apiClient.get<{ data: Record<string, unknown> | null }>(url);
      const row = Array.isArray(json.data) ? (json.data as Record<string, unknown>[])[0] : json.data;
      return row ? SubscriptionPriceSchedule.fromJSON(row) : null;
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('404')) return null;
      throw err;
    }
  }

  async pricePoints(
    sub: Subscription,
    input: { territoryId: string; cursor: string | null; limit?: number },
  ): Promise<SubscriptionPricePointPage> {
    const params = new URLSearchParams();
    params.set('territory', input.territoryId);
    if (input.cursor) params.set('cursor', input.cursor);
    if (input.limit) params.set('limit', String(input.limit));
    const url = `/api/v1/subscriptions/${sub.id}/price-points?${params.toString()}`;
    const json = await apiClient.get<{ data: Record<string, unknown>[]; links?: { next?: string } }>(url);
    return {
      items: json.data.map(SubscriptionPricePoint.fromJSON),
      nextCursor: json.links?.next ?? null,
    };
  }

  async equalizations(
    sub: Subscription,
    input: { pricePointId: string; cursor: string | null; limit?: number },
  ): Promise<SubscriptionPricePointPage> {
    const params = new URLSearchParams();
    params.set('pricePointId', input.pricePointId);
    if (input.cursor) params.set('cursor', input.cursor);
    if (input.limit) params.set('limit', String(input.limit));
    const url = `/api/v1/subscriptions/${sub.id}/price-points/equalizations?${params.toString()}`;
    const json = await apiClient.get<{ data: Record<string, unknown>[]; links?: { next?: string } }>(url);
    return {
      items: json.data.map(SubscriptionPricePoint.fromJSON),
      nextCursor: json.links?.next ?? null,
    };
  }

  async setPrices(
    sub: Subscription,
    input: Array<{ territoryId: string; pricePointId: string }>,
  ): Promise<void> {
    const url = sub.affordances.setPrices ?? `/api/v1/subscriptions/${sub.id}/prices/set-batch`;
    // Backend expects each entry as `{ territory, pricePointId }` — remap
    // the domain's `territoryId` to the wire field name.
    const prices = input.map(({ territoryId, pricePointId }) => ({
      territory: territoryId,
      pricePointId,
    }));
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prices }),
    });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  // ── Offers ──

  async introductoryOffers(sub: Subscription): Promise<SubscriptionIntroductoryOffer[]> {
    const url = sub.affordances.listIntroductoryOffers ?? `/api/v1/subscriptions/${sub.id}/introductory-offers`;
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(url);
    return json.data.map(SubscriptionIntroductoryOffer.fromJSON);
  }

  async createIntroductoryOffer(
    sub: Subscription,
    input: CreateIntroductoryOfferInput,
  ): Promise<SubscriptionIntroductoryOffer> {
    const url = sub.affordances.createIntroductoryOffer ?? `/api/v1/subscriptions/${sub.id}/introductory-offers`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    const body = await res.json().catch(() => ({}));
    return SubscriptionIntroductoryOffer.fromJSON((body.data ?? body) as Record<string, unknown>);
  }

  async deleteIntroductoryOffer(offer: SubscriptionIntroductoryOffer): Promise<void> {
    const url = `/api/v1/subscription-introductory-offers/${offer.id}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  async promotionalOffers(sub: Subscription): Promise<SubscriptionPromotionalOffer[]> {
    const url = sub.affordances.listPromotionalOffers ?? `/api/v1/subscriptions/${sub.id}/promotional-offers`;
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(url);
    return json.data.map(SubscriptionPromotionalOffer.fromJSON);
  }

  async createPromotionalOffer(
    sub: Subscription,
    input: CreatePromotionalOfferInput,
  ): Promise<SubscriptionPromotionalOffer> {
    const url = sub.affordances.createPromotionalOffer ?? `/api/v1/subscriptions/${sub.id}/promotional-offers`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    const body = await res.json().catch(() => ({}));
    return SubscriptionPromotionalOffer.fromJSON((body.data ?? body) as Record<string, unknown>);
  }

  async deletePromotionalOffer(offer: SubscriptionPromotionalOffer): Promise<void> {
    const url = offer.affordances.delete ?? `/api/v1/subscription-promotional-offers/${offer.id}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  async offerCodes(sub: Subscription): Promise<SubscriptionOfferCode[]> {
    const url = sub.affordances.listOfferCodes ?? `/api/v1/subscriptions/${sub.id}/offer-codes`;
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(url);
    return json.data.map(SubscriptionOfferCode.fromJSON);
  }

  async winBackOffers(sub: Subscription): Promise<WinBackOffer[]> {
    const url = sub.affordances.listWinBackOffers ?? `/api/v1/subscriptions/${sub.id}/win-back-offers`;
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(url);
    return json.data.map(WinBackOffer.fromJSON);
  }

  async createOfferCode(
    sub: Subscription,
    input: CreateSubscriptionOfferCodeInput,
  ): Promise<SubscriptionOfferCode> {
    const url = sub.affordances.createOfferCode ?? `/api/v1/subscriptions/${sub.id}/offer-codes`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    const body = await res.json().catch(() => ({}));
    const data = (body.data ?? body) as Record<string, unknown>;
    return SubscriptionOfferCode.fromJSON(data);
  }
}

export async function repositoryFor(mode: DataMode): Promise<SubscriptionGroupRepository & SubscriptionRepository> {
  if (mode === 'mock') {
    const { MockSubscriptionGroupRepository } = await import('./SubscriptionGroup.mock.ts');
    return new MockSubscriptionGroupRepository();
  }
  return new RestSubscriptionGroupRepository();
}
