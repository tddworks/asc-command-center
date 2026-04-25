import { AppInfo } from '../AppInfo.ts';
import { AppInfoLocalization } from '../AppInfoLocalization.ts';
import type { AppInfoListHints, AppInfoRepository } from '../AppInfoRepository.ts';
import { AgeRatingDeclaration } from '../../age-rating/AgeRatingDeclaration.ts';
import { RestAgeRatingDeclarationRepository } from '../../age-rating/infrastructure/AgeRatingDeclaration.api.ts';
import { apiClient, normalizeLinks, type DataMode } from '../../../shared/api-client.tsx';
import type { Affordances } from '../../../shared/types.ts';
import { MockAppInfoRepository } from './AppInfo.mock.ts';

/**
 * REST adapter for App Info.
 *
 * LIST — fetch all AppInfo rows for the app (one per version state). For each
 * row we follow `listLocalizations` in parallel and feed the raw JSON into
 * `AppInfo.fromJSON`, which owns the domain's hydration contract.
 *
 * SAVE — the aggregate orchestrates, this adapter just owns the HTTP calls:
 *   • `saveCategories`     → PATCH `appInfo.affordances.updateCategories`
 *   • `saveLocalization`   → PATCH `loc.updateUrl` (update / updateLocalization / updateAppInfoLocalization)
 *   • `createLocalization` → POST  `appInfo.affordances.createLocalization`
 *   • `deleteLocalization` → DELETE `loc.deleteUrl`
 *
 * When an affordance is missing we throw an explicit error that names the
 * keys we looked for AND the keys the backend actually shipped. No silent
 * fallback — a save that didn't persist anything is worse than a save that
 * fails visibly, because the user walks away thinking their changes landed.
 */
export class RestAppInfoRepository implements AppInfoRepository {
  async list(appId: string, hints?: AppInfoListHints): Promise<AppInfo[]> {
    const resp = await apiClient.get<{ data: Record<string, unknown>[] }>(
      `/api/v1/apps/${appId}/app-infos`,
    );
    return Promise.all((resp.data ?? []).map((json) => this.hydrate(json, appId, hints?.primaryLocale)));
  }

  async saveCategories(appInfo: AppInfo): Promise<void> {
    const url = appInfo.affordances.updateCategories;
    if (!url) {
      throw missingAffordance('saveCategories', ['updateCategories'], appInfo.affordances);
    }
    // Categories only — content-rights is a different resource (App, not
    // AppInfo). The asc backend's `PATCH /app-infos/:id` ignores any other
    // keys in the body, so we keep it tight.
    await this.sendJSON('PATCH', url, {
      primaryCategoryId: appInfo.primaryCategoryId,
      secondaryCategoryId: appInfo.secondaryCategoryId,
    });
  }

  async saveLocalization(loc: AppInfoLocalization): Promise<void> {
    const url = loc.updateUrl;
    if (!url) {
      throw missingAffordance(
        `saveLocalization(${loc.locale})`,
        ['update', 'updateLocalization', 'updateAppInfoLocalization'],
        loc.affordances,
      );
    }
    await this.sendJSON('PATCH', url, {
      name: loc.name,
      subtitle: loc.subtitle,
      privacyPolicyUrl: loc.privacyPolicyUrl,
      privacyChoicesUrl: loc.privacyChoicesUrl,
    });
  }

  async createLocalization(
    appInfo: AppInfo,
    loc: AppInfoLocalization,
  ): Promise<{ id: string; affordances: Affordances }> {
    const url = appInfo.affordances.createLocalization;
    if (!url) {
      throw missingAffordance(
        `createLocalization(${loc.locale})`,
        ['createLocalization'],
        appInfo.affordances,
      );
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale: loc.locale,
        name: loc.name,
        subtitle: loc.subtitle,
        privacyPolicyUrl: loc.privacyPolicyUrl,
        privacyChoicesUrl: loc.privacyChoicesUrl,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`POST ${url} failed: ${res.status} ${text}`);
    }
    // Normalize once so `_links` → `affordances` flattening is the same as
    // the list/hydrate path. Then peel the row out of whatever wrapper the
    // backend used: bare, `{data}`, or `{data: [...]}`.
    const raw = await res.json().catch(() => null);
    const row = pickResource(raw);
    if (!row || typeof row.id !== 'string') {
      throw new Error(`POST ${url} did not return a resource with an id`);
    }
    return {
      id: row.id,
      affordances: (row.affordances as Affordances | undefined) ?? {},
    };
  }

  async deleteLocalization(loc: AppInfoLocalization): Promise<void> {
    const url = loc.deleteUrl;
    if (!url) {
      throw missingAffordance(
        `deleteLocalization(${loc.locale})`,
        ['delete', 'deleteLocalization', 'deleteAppInfoLocalization'],
        loc.affordances,
      );
    }
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`DELETE ${url} failed: ${res.status} ${text}`);
    }
  }

  async ageRating(appInfo: AppInfo): Promise<AgeRatingDeclaration | null> {
    const href =
      appInfo.affordances.getAgeRatingDeclaration ??
      appInfo.affordances.ageRatingDeclaration ??
      appInfo.affordances.getAgeRating;
    if (!href) return null;
    const resp = await apiClient.get<{ data?: unknown } | Record<string, unknown>>(href);
    const row = pickResource(resp) ?? {};
    const decl = AgeRatingDeclaration.fromJSON(row);
    decl.setRepository(new RestAgeRatingDeclarationRepository());
    return decl;
  }

  // ── internals ──

  private async hydrate(
    json: Record<string, unknown>,
    appId: string,
    primaryLocaleHint: string | undefined,
  ): Promise<AppInfo> {
    const localizationsJson = await this.fetchLocalizations(json.affordances);

    // Pick a primary locale: caller's hint wins, then en-US, then the first
    // row the backend returned, then en-US as a last-ditch default.
    const primaryLocale =
      primaryLocaleHint ??
      (localizationsJson.find((l) => l.locale === 'en-US')?.locale as string | undefined) ??
      (localizationsJson[0]?.locale as string | undefined) ??
      'en-US';

    // Seed an empty primary-locale row BEFORE handing off to fromJSON so the
    // pristine snapshot contains it (no false "unsaved changes" on load).
    if (!localizationsJson.some((l) => l.locale === primaryLocale)) {
      localizationsJson.unshift({ id: '', locale: primaryLocale, name: '', subtitle: null });
    }

    const info = AppInfo.fromJSON({
      ...json,
      appId: (json.appId as string | undefined) ?? appId,
      primaryLocale,
      localizations: localizationsJson,
    });
    info.setRepository(this);
    return info;
  }

  private async fetchLocalizations(
    affordances: unknown,
  ): Promise<Record<string, unknown>[]> {
    const href = (affordances as Affordances | undefined)?.listLocalizations;
    if (!href) return [];
    try {
      const resp = await apiClient.get<{ data: Record<string, unknown>[] }>(href);
      return resp.data ?? [];
    } catch (err) {
      console.warn('[AppInfo] failed to load localizations:', err);
      return [];
    }
  }

  private async sendJSON(method: 'PATCH' | 'POST', url: string, body: unknown): Promise<void> {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${method} ${url} failed: ${res.status} ${text}`);
    }
  }
}

/** Builds an error that names exactly what's wrong: which operation, the
 *  affordance keys the client looked for, and the keys the backend actually
 *  shipped. Surfacing both sides in one message makes the mismatch trivial
 *  to resolve — either the client learns the backend's key or the backend
 *  ships the missing one. */
function missingAffordance(
  operation: string,
  triedKeys: readonly string[],
  actual: Affordances,
): Error {
  const present = Object.keys(actual);
  return new Error(
    `[AppInfo] ${operation}: none of [${triedKeys.join(', ')}] affordances were ` +
    `exposed by the backend. Present affordances: [${present.join(', ') || '(none)'}]. ` +
    'Either the backend needs to ship the affordance, or add the actual key name ' +
    'to the accepted variants in AppInfoLocalization / AppInfo.',
  );
}

/**
 * Pull a single resource row out of whatever wrapper the backend used, and
 * run `normalizeLinks` so `_links` shows up as flat `affordances`. Handles:
 *   - bare:    `{ id, ... }`
 *   - wrapped: `{ data: { id, ... } }`
 *   - array:   `{ data: [ { id, ... } ] }` (create endpoints sometimes wrap
 *              the created row in a single-element list).
 */
function pickResource(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const normalized = normalizeLinks(raw) as Record<string, unknown>;
  if (typeof normalized.id === 'string') return normalized;
  const data = normalized.data;
  if (data && typeof data === 'object') {
    const row = Array.isArray(data) ? (data[0] as Record<string, unknown>) : (data as Record<string, unknown>);
    if (row && typeof row.id === 'string') return row;
  }
  return null;
}

export async function repositoryFor(mode: DataMode): Promise<AppInfoRepository> {
  if (mode === 'mock') return new MockAppInfoRepository();
  return new RestAppInfoRepository();
}
