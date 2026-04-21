import { AppInfo } from '../AppInfo.ts';
import { AppInfoLocalization } from '../AppInfoLocalization.ts';
import type { AppInfoLocalization as AppInfoLocalizationType } from '../AppInfoLocalization.ts';
import type { AppInfoListHints, AppInfoRepository } from '../AppInfoRepository.ts';
import { apiClient, type DataMode } from '../../../shared/api-client.tsx';
import type { Affordances } from '../../../shared/types.ts';
import { MockAppInfoRepository } from './AppInfo.mock.ts';

/**
 * REST adapter for App Info.
 *
 * LIST flow — fetch ALL AppInfo rows for the app. The backend returns one
 * row per version state (e.g. a READY_FOR_DISTRIBUTION row pinned to the
 * live version and a PREPARE_FOR_SUBMISSION row for the next one). For each
 * row we follow `listLocalizations` in parallel.
 *
 * SAVE flow — top-level category fields go through the `updateCategories`
 * PATCH affordance that the backend ships today. Per-localization patches
 * and locale add/remove aren't wired yet — the backend doesn't surface
 * affordances for them — so those parts delegate to the in-memory mock.
 * The per-localization PATCH is intentionally deferred; when the backend
 * adds affordances we follow them using the exact same pattern below.
 */

interface AppInfoDTO {
  id: string;
  appId?: string;
  state?: string;
  appStoreState?: string;
  appStoreAgeRating?: string;
  affordances?: Affordances;
  // Backend today sends flat `primaryCategoryId: "FINANCE"` — older
  // Apple-shaped payloads nest as `primaryCategory: { id }`. Accept both.
  primaryCategoryId?: string | null;
  secondaryCategoryId?: string | null;
  primaryCategory?: { id?: string } | string | null;
  secondaryCategory?: { id?: string } | string | null;
}

interface LocalizationDTO {
  id?: string;
  locale?: string;
  name?: string;
  subtitle?: string | null;
  privacyPolicyUrl?: string | null;
  privacyChoicesUrl?: string | null;
  affordances?: Affordances;
}

function categoryId(
  flat: string | null | undefined,
  nested: AppInfoDTO['primaryCategory'],
): string | null {
  // Prefer the flat field the backend actually sends; fall back to nested
  // Apple-shaped values so older fixtures still work.
  if (flat) return flat;
  if (!nested) return null;
  if (typeof nested === 'string') return nested;
  return nested.id ?? null;
}

export class RestAppInfoRepository implements AppInfoRepository {
  private readonly mockFallback = new MockAppInfoRepository();
  private locWarned = false;

  async list(appId: string, hints?: AppInfoListHints): Promise<AppInfo[]> {
    const resp = await apiClient.get<{ data: AppInfoDTO[] }>(`/api/v1/apps/${appId}/app-infos`);
    const dtos = resp.data ?? [];
    return Promise.all(dtos.map((dto) => this.hydrate(dto, appId, hints?.primaryLocale)));
  }

  async save(appInfo: AppInfo): Promise<void> {
    // 1. Top-level fields (categories, content rights) → PATCH via the
    //    `updateCategories` affordance when the values are dirty.
    await this.saveTopLevel(appInfo);

    // 2. Per-localization changes → not yet wired via REST. Persist in the
    //    in-memory mock store so the UI behaves consistently end-to-end.
    if (this.hasLocalizationChanges(appInfo)) {
      if (!this.locWarned) {
        console.warn(
          '[AppInfo] localization PATCH via REST is not implemented yet — ' +
          'persisting locale changes in the in-memory store until the backend ships affordances.',
        );
        this.locWarned = true;
      }
      await this.mockFallback.save(appInfo);
    }
  }

  // ── internals ──────────────────────────────────────────────────

  private async saveTopLevel(appInfo: AppInfo): Promise<void> {
    const patchUrl = appInfo.affordances.updateCategories;
    if (!patchUrl) {
      // No affordance — nothing to do. Top-level fields won't persist but
      // markSaved() will still be called by AppInfo.save() to clear dirty.
      return;
    }

    const body: Record<string, unknown> = {};
    // Only include changed fields to minimize the surface. The backend
    // accepts flat keys that mirror the GET response shape.
    // (We don't know precisely which keys the backend accepts for
    // contentRightsDeclaration yet — include it optimistically; the PATCH
    // will ignore unknown keys per our convention.)
    body.primaryCategoryId = appInfo.primaryCategoryId;
    body.secondaryCategoryId = appInfo.secondaryCategoryId;
    if (appInfo.contentRightsDeclaration !== null) {
      body.contentRightsDeclaration = appInfo.contentRightsDeclaration;
    }

    const res = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PATCH ${patchUrl} failed: ${res.status} ${text}`);
    }
  }

  private hasLocalizationChanges(appInfo: AppInfo): boolean {
    // Any locally-added (empty-id) row, or any row with its own dirty flag,
    // counts as "localization changed". Removed-locale handling lives in
    // `AppInfo.removedBuffer` but is opaque to us — the dirty getter on
    // AppInfo covers it, so we fall back through whenever the aggregate is
    // dirty beyond pure top-level changes.
    const anyDirty = appInfo.localizations.some(
      (l: AppInfoLocalizationType) => l.hasUnsavedChanges || l.id === '',
    );
    return anyDirty;
  }

  private async hydrate(
    dto: AppInfoDTO,
    appId: string,
    hintedPrimary?: string,
  ): Promise<AppInfo> {
    const localizations = await this.loadLocalizations(dto.affordances);

    // Prefer the hint from the workspace (the App's actual primaryLocale),
    // otherwise fall back to the first existing localization or en-US.
    const primaryLocale =
      hintedPrimary ??
      localizations.find((l) => l.locale === 'en-US')?.locale ??
      localizations[0]?.locale ??
      'en-US';

    // Seed an empty primary-locale row if the backend didn't return one —
    // so the form always has a target to bind to. Added BEFORE `new AppInfo`
    // so it's part of the pristine snapshot (no false "unsaved changes").
    if (!localizations.some((l) => l.locale === primaryLocale)) {
      localizations.unshift(new AppInfoLocalization({
        id: '',
        locale: primaryLocale,
        name: '',
        subtitle: null,
      }));
    }

    const primaryRow = localizations.find((l) => l.locale === primaryLocale);
    const primaryRaw = primaryRow as unknown as { privacyPolicyUrl?: string | null } | undefined;

    const info = new AppInfo({
      id: dto.id,
      appId: dto.appId ?? appId,
      primaryCategoryId: categoryId(dto.primaryCategoryId, dto.primaryCategory),
      secondaryCategoryId: categoryId(dto.secondaryCategoryId, dto.secondaryCategory),
      privacyPolicyUrl: primaryRaw?.privacyPolicyUrl ?? null,
      supportUrl: null,    // Lives on AppStoreVersionLocalization, not here
      marketingUrl: null,  // Same
      primaryLocale,
      localizations,
      affordances: dto.affordances ?? {},
      state: dto.state,
      appStoreState: dto.appStoreState,
      appStoreAgeRating: dto.appStoreAgeRating,
    });

    // Attach ourselves so `appInfo.save()` can actually reach the network.
    // Previously missing — every REST-loaded AppInfo was un-save-able.
    info.setRepository(this);
    return info;
  }

  private async loadLocalizations(
    affordances: Affordances | undefined,
  ): Promise<AppInfoLocalization[]> {
    const href = affordances?.listLocalizations;
    if (!href) return [];

    try {
      const resp = await apiClient.get<{ data: LocalizationDTO[] }>(href);
      return (resp.data ?? []).map((dto) =>
        new AppInfoLocalization({
          id: dto.id ?? '',
          locale: dto.locale ?? '',
          name: dto.name ?? '',
          subtitle: dto.subtitle ?? null,
          affordances: dto.affordances ?? {},
        }),
      );
    } catch (err) {
      console.warn('[AppInfo] failed to load localizations:', err);
      return [];
    }
  }
}

export async function repositoryFor(mode: DataMode): Promise<AppInfoRepository> {
  if (mode === 'mock') return new MockAppInfoRepository();
  return new RestAppInfoRepository();
}
