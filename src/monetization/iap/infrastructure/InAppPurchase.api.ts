import { InAppPurchase } from '../InAppPurchase.ts';
import { InAppPurchaseLocalization } from '../InAppPurchaseLocalization.ts';
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
}

/** Resolve the concrete IAP repository for the current data mode. */
export async function repositoryFor(mode: DataMode): Promise<InAppPurchaseRepository> {
  if (mode === 'mock') {
    const { MockInAppPurchaseRepository } = await import('./InAppPurchase.mock.ts');
    return new MockInAppPurchaseRepository();
  }
  return new RestInAppPurchaseRepository();
}
