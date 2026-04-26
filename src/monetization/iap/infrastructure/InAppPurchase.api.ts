import { InAppPurchase } from '../InAppPurchase.ts';
import { InAppPurchaseLocalization } from '../InAppPurchaseLocalization.ts';
import { IAPAvailability } from '../IAPAvailability.ts';
import { IAPPriceSchedule } from '../IAPPriceSchedule.ts';
import { IAPPricePoint, type IAPPricePointPage } from '../IAPPricePoint.ts';
import { InAppPurchaseOfferCode } from '../InAppPurchaseOfferCode.ts';
import { IAPOneTimeUseCodeBatch, type CodeEnvironment } from '../OneTimeUseCodeBatch.ts';
import { ReviewScreenshot } from '../ReviewScreenshot.ts';
import { apiClient, type DataMode } from '../../../shared/api-client.tsx';
import type {
  CreateInAppPurchaseInput,
  CreateInAppPurchaseLocalizationInput,
  InAppPurchaseRepository,
} from '../InAppPurchaseRepository.ts';

/**
 * REST implementation of the IAP repository. Methods follow affordance
 * URLs published on each IAP resource — only `list`/`create` use the
 * static `/api/v1/apps/:appId/iap` collection endpoint.
 */
export class RestInAppPurchaseRepository implements InAppPurchaseRepository {
  async list(appId: string): Promise<InAppPurchase[]> {
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(`/api/v1/apps/${appId}/iap`);
    return json.data.map((row) => InAppPurchase.fromJSON(row, this));
  }

  async get(id: string): Promise<InAppPurchase> {
    const json = await apiClient.get<{ data: Record<string, unknown> }>(`/api/v1/iap/${id}`);
    const row = Array.isArray(json.data) ? (json.data as Record<string, unknown>[])[0] : json.data;
    return InAppPurchase.fromJSON(row ?? {}, this);
  }

  async create(input: CreateInAppPurchaseInput): Promise<InAppPurchase> {
    const url = `/api/v1/apps/${input.appId}/iap`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceName: input.referenceName,
        productId: input.productId,
        inAppPurchaseType: input.inAppPurchaseType,
      }),
    });
    if (!res.ok) {
      throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
    const body = await res.json().catch(() => ({}));
    const data = (body.data ?? body) as Record<string, unknown>;
    return InAppPurchase.fromJSON({ ...data, appId: input.appId }, this);
  }

  async update(
    iap: InAppPurchase,
    patch: { referenceName?: string; reviewNote?: string | null },
  ): Promise<void> {
    const url = iap.affordances.update ?? `/api/v1/iap/${iap.id}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      throw new Error(`PATCH ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
  }

  async remove(iap: InAppPurchase): Promise<void> {
    const url = iap.affordances.delete ?? `/api/v1/iap/${iap.id}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error(`DELETE ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
  }

  async submit(iap: InAppPurchase): Promise<void> {
    const url = iap.affordances.submit;
    if (!url) throw new Error(`IAP ${iap.id} has no submit affordance`);
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) {
      throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
  }

  async unsubmit(iap: InAppPurchase): Promise<void> {
    const url = iap.affordances.unsubmit;
    if (!url) throw new Error(`IAP ${iap.id} has no unsubmit affordance`);
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error(`DELETE ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
  }

  // ── Localizations ──

  async localizations(iap: InAppPurchase): Promise<InAppPurchaseLocalization[]> {
    const url = iap.affordances.listLocalizations ?? `/api/v1/iap/${iap.id}/localizations`;
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(url);
    return json.data.map(InAppPurchaseLocalization.fromJSON);
  }

  async createLocalization(
    iap: InAppPurchase,
    input: CreateInAppPurchaseLocalizationInput,
  ): Promise<InAppPurchaseLocalization> {
    const url = iap.affordances.createLocalization ?? `/api/v1/iap/${iap.id}/localizations`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale: input.locale,
        name: input.name,
        description: input.description ?? null,
      }),
    });
    if (!res.ok) {
      throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
    const body = await res.json().catch(() => ({}));
    const data = (body.data ?? body) as Record<string, unknown>;
    return InAppPurchaseLocalization.fromJSON(data);
  }

  async saveLocalization(loc: InAppPurchaseLocalization): Promise<void> {
    const url = loc.updateUrl ?? `/api/v1/iap-localizations/${loc.id}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: loc.name, description: loc.description }),
    });
    if (!res.ok) {
      throw new Error(`PATCH ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
  }

  async deleteLocalization(loc: InAppPurchaseLocalization): Promise<void> {
    const url = loc.deleteUrl ?? `/api/v1/iap-localizations/${loc.id}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error(`DELETE ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
  }

  // ── Availability ──

  async availability(iap: InAppPurchase): Promise<IAPAvailability | null> {
    const url = iap.affordances.getAvailability ?? `/api/v1/iap/${iap.id}/availability`;
    try {
      const json = await apiClient.get<{ data: Record<string, unknown> | null }>(url);
      const row = Array.isArray(json.data) ? (json.data as Record<string, unknown>[])[0] : json.data;
      return row ? IAPAvailability.fromJSON(row) : null;
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('404')) return null;
      throw err;
    }
  }

  async setAvailability(
    iap: InAppPurchase,
    input: { territoryIds: string[]; availableInNewTerritories: boolean },
  ): Promise<void> {
    const url = iap.affordances.setAvailability ?? `/api/v1/iap/${iap.id}/availability`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`PATCH ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  // ── Pricing ──

  async pricePoints(
    iap: InAppPurchase,
    input: { territoryId: string; cursor: string | null; limit?: number },
  ): Promise<IAPPricePointPage> {
    const params = new URLSearchParams();
    params.set('territory', input.territoryId);
    if (input.cursor) params.set('cursor', input.cursor);
    if (input.limit) params.set('limit', String(input.limit));
    const url = `/api/v1/iap/${iap.id}/price-points?${params.toString()}`;
    const json = await apiClient.get<{ data: Record<string, unknown>[]; links?: { next?: string } }>(url);
    return {
      items: json.data.map(IAPPricePoint.fromJSON),
      nextCursor: json.links?.next ?? null,
    };
  }

  async equalizations(
    iap: InAppPurchase,
    input: { pricePointId: string; cursor: string | null; limit?: number },
  ): Promise<IAPPricePointPage> {
    const params = new URLSearchParams();
    params.set('pricePointId', input.pricePointId);
    if (input.cursor) params.set('cursor', input.cursor);
    if (input.limit) params.set('limit', String(input.limit));
    const url = `/api/v1/iap/${iap.id}/price-points/equalizations?${params.toString()}`;
    const json = await apiClient.get<{ data: Record<string, unknown>[]; links?: { next?: string } }>(url);
    return {
      items: json.data.map(IAPPricePoint.fromJSON),
      nextCursor: json.links?.next ?? null,
    };
  }

  async setPrice(iap: InAppPurchase, input: { territoryId: string; pricePointId: string }): Promise<void> {
    const url = iap.affordances.setPrice ?? `/api/v1/iap/${iap.id}/price-schedule`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseTerritory: input.territoryId,
        pricePointId: input.pricePointId,
      }),
    });
    if (!res.ok) {
      throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
  }

  async priceSchedule(iap: InAppPurchase): Promise<IAPPriceSchedule | null> {
    const url = iap.affordances.getPriceSchedule ?? `/api/v1/iap/${iap.id}/price-schedule`;
    try {
      const json = await apiClient.get<{ data: Record<string, unknown> | null }>(url);
      const row = Array.isArray(json.data) ? (json.data as Record<string, unknown>[])[0] : json.data;
      return row ? IAPPriceSchedule.fromJSON(row) : null;
    } catch (err) {
      // 404 = no schedule set yet — common for fresh IAPs.
      const msg = (err as Error).message ?? '';
      if (msg.includes('404')) return null;
      throw err;
    }
  }

  // ── Review screenshot ──

  async reviewScreenshot(iap: InAppPurchase): Promise<ReviewScreenshot | null> {
    const url = iap.affordances.getReviewScreenshot ?? `/api/v1/iap/${iap.id}/review-screenshot`;
    try {
      const json = await apiClient.get<{ data: Record<string, unknown> | null }>(url);
      const row = Array.isArray(json.data) ? (json.data as Record<string, unknown>[])[0] : json.data;
      return row ? ReviewScreenshot.fromJSON(row) : null;
    } catch (err) {
      // Treat 404 as "no screenshot uploaded yet" — that's the common
      // first-time state, not an error worth surfacing.
      const msg = (err as Error).message ?? '';
      if (msg.includes('404')) return null;
      throw err;
    }
  }

  async uploadReviewScreenshot(iap: InAppPurchase, file: File): Promise<ReviewScreenshot> {
    const url = iap.affordances.uploadReviewScreenshot ?? `/api/v1/iap/${iap.id}/review-screenshot`;
    const body = new FormData();
    body.append('file', file, file.name);
    const res = await fetch(url, { method: 'POST', body });
    if (!res.ok) {
      throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
    const json = await res.json().catch(() => ({}));
    const data = (json.data ?? json) as Record<string, unknown>;
    return ReviewScreenshot.fromJSON(data);
  }

  async deleteReviewScreenshot(iap: InAppPurchase, screenshot: ReviewScreenshot): Promise<void> {
    const url = screenshot.deleteUrl ?? `/api/v1/iap/${iap.id}/review-screenshot`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error(`DELETE ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
  }

  // ── Offer codes ──

  async offerCodes(iap: InAppPurchase): Promise<InAppPurchaseOfferCode[]> {
    const url = iap.affordances.listOfferCodes ?? `/api/v1/iap/${iap.id}/offer-codes`;
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(url);
    return json.data.map((row) => InAppPurchaseOfferCode.fromJSON({ ...row, iapId: iap.id }));
  }

  async oneTimeUseCodes(code: InAppPurchaseOfferCode): Promise<IAPOneTimeUseCodeBatch[]> {
    const url = `/api/v1/iap-offer-codes/${code.id}/one-time-use-codes`;
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(url);
    return json.data.map(IAPOneTimeUseCodeBatch.fromJSON);
  }

  async generateOneTimeUseCodes(
    code: InAppPurchaseOfferCode,
    input: { count: number; environment: CodeEnvironment | string },
  ): Promise<IAPOneTimeUseCodeBatch> {
    const url = `/api/v1/iap-offer-codes/${code.id}/one-time-use-codes`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numberOfCodes: input.count, environment: input.environment }),
    });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    const body = await res.json().catch(() => ({}));
    return IAPOneTimeUseCodeBatch.fromJSON((body.data ?? body) as Record<string, unknown>);
  }

  async createOfferCode(
    iap: InAppPurchase,
    input: { name: string; customerEligibilities: string[] },
  ): Promise<InAppPurchaseOfferCode> {
    const url = iap.affordances.createOfferCode ?? `/api/v1/iap/${iap.id}/offer-codes`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        customerEligibilities: input.customerEligibilities,
      }),
    });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    const body = await res.json().catch(() => ({}));
    const data = (body.data ?? body) as Record<string, unknown>;
    return InAppPurchaseOfferCode.fromJSON({ ...data, iapId: iap.id });
  }

  async deactivateOfferCode(code: InAppPurchaseOfferCode): Promise<void> {
    const url = code.affordances.deactivate ?? `/api/v1/iap-offer-codes/${code.id}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    if (!res.ok) {
      throw new Error(`PATCH ${url} failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
  }
}

/** Resolve the concrete IAP repository for the current data mode. */
export async function repositoryFor(mode: DataMode): Promise<InAppPurchaseRepository> {
  if (mode === 'mock') {
    const { MockInAppPurchaseRepository } = await import('./InAppPurchase.mock.ts');
    return new MockInAppPurchaseRepository();
  }
  return new RestInAppPurchaseRepository();
}
