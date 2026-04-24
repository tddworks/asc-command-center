import { AppInfo } from '../AppInfo.ts';
import { AppInfoLocalization } from '../AppInfoLocalization.ts';
import type { AppInfoListHints, AppInfoRepository } from '../AppInfoRepository.ts';
import { apiClient, type DataMode } from '../../../shared/api-client.tsx';
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
 *   • `saveLocalization`   → PATCH `loc.affordances.update`
 *   • `createLocalization` → POST  `appInfo.affordances.createLocalization`
 *   • `deleteLocalization` → DELETE `loc.affordances.delete`
 *
 * When an affordance is missing (backend hasn't shipped it yet) we fall back
 * to the in-memory mock store for that specific operation and warn once. This
 * keeps the UI working while the backend catches up.
 */
export class RestAppInfoRepository implements AppInfoRepository {
  private readonly mockFallback = new MockAppInfoRepository();
  private warned: Partial<Record<'saveCategories' | 'saveLocalization' | 'createLocalization' | 'deleteLocalization', boolean>> = {};

  async list(appId: string, hints?: AppInfoListHints): Promise<AppInfo[]> {
    const resp = await apiClient.get<{ data: Record<string, unknown>[] }>(
      `/api/v1/apps/${appId}/app-infos`,
    );
    return Promise.all((resp.data ?? []).map((json) => this.hydrate(json, appId, hints?.primaryLocale)));
  }

  async saveCategories(appInfo: AppInfo): Promise<void> {
    const url = appInfo.affordances.updateCategories;
    if (!url) {
      this.warnOnce('saveCategories', 'updateCategories');
      return;
    }
    // Always include contentRightsDeclaration — sending `null` is the only
    // way to clear it, which the previous conditional body was blocking.
    await this.sendJSON('PATCH', url, {
      primaryCategoryId: appInfo.primaryCategoryId,
      secondaryCategoryId: appInfo.secondaryCategoryId,
      contentRightsDeclaration: appInfo.contentRightsDeclaration,
    });
  }

  async saveLocalization(loc: AppInfoLocalization): Promise<void> {
    const url = loc.updateUrl;
    if (!url) {
      this.warnMissingAffordance('saveLocalization', loc.affordances, [
        'update', 'updateLocalization', 'updateAppInfoLocalization',
      ]);
      return this.mockFallback.saveLocalization(loc);
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
  ): Promise<{ id: string }> {
    const url = appInfo.affordances.createLocalization;
    if (!url) {
      this.warnOnce('createLocalization', 'createLocalization');
      return this.mockFallback.createLocalization(appInfo, loc);
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
    const json = (await res.json().catch(() => null)) as { id?: string; data?: { id?: string } } | null;
    const id = json?.id ?? json?.data?.id;
    if (!id) throw new Error(`POST ${url} did not return an id`);
    return { id };
  }

  async deleteLocalization(loc: AppInfoLocalization): Promise<void> {
    const url = loc.deleteUrl;
    if (!url) {
      this.warnMissingAffordance('deleteLocalization', loc.affordances, [
        'delete', 'deleteLocalization', 'deleteAppInfoLocalization',
      ]);
      return this.mockFallback.deleteLocalization(loc);
    }
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`DELETE ${url} failed: ${res.status} ${text}`);
    }
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

  private warnOnce(
    key: 'saveCategories' | 'saveLocalization' | 'createLocalization' | 'deleteLocalization',
    affordance: string,
  ): void {
    if (this.warned[key]) return;
    this.warned[key] = true;
    console.warn(
      `[AppInfo] ${key}: backend did not expose \`${affordance}\` affordance — ` +
      'falling back to the in-memory mock for this operation.',
    );
  }

  private warnMissingAffordance(
    key: 'saveCategories' | 'saveLocalization' | 'createLocalization' | 'deleteLocalization',
    actualAffordances: Affordances,
    triedKeys: readonly string[],
  ): void {
    if (this.warned[key]) return;
    this.warned[key] = true;
    console.warn(
      `[AppInfo] ${key}: none of the expected affordances ` +
      `[${triedKeys.join(', ')}] were exposed by the backend — ` +
      'falling back to the in-memory mock for this operation. ' +
      `Affordances actually present: [${Object.keys(actualAffordances).join(', ') || '(none)'}]`,
    );
  }
}

export async function repositoryFor(mode: DataMode): Promise<AppInfoRepository> {
  if (mode === 'mock') return new MockAppInfoRepository();
  return new RestAppInfoRepository();
}
