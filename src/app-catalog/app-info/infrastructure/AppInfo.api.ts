import { AppInfo } from '../AppInfo.ts';
import { AppInfoLocalization } from '../AppInfoLocalization.ts';
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
 * SAVE flow — not yet implemented; falls back to the in-memory mock until
 * the backend confirms the localization PATCH shape. The affordances the
 * backend ships (`updateCategories`, per-localization patch/delete) are
 * already carried on the aggregate so the switch-over is mechanical.
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
  private readonly saveFallback = new MockAppInfoRepository();
  private saveWarned = false;

  async list(appId: string, hints?: AppInfoListHints): Promise<AppInfo[]> {
    const resp = await apiClient.get<{ data: AppInfoDTO[] }>(`/api/v1/apps/${appId}/app-infos`);
    const dtos = resp.data ?? [];
    return Promise.all(dtos.map((dto) => this.hydrate(dto, appId, hints?.primaryLocale)));
  }

  async save(appInfo: AppInfo): Promise<void> {
    if (!this.saveWarned) {
      console.warn(
        '[AppInfo] save via REST not implemented yet — falling back to in-memory store. ' +
        'Wire PATCH using affordances.updateCategories and per-localization affordances once confirmed.',
      );
      this.saveWarned = true;
    }
    return this.saveFallback.save(appInfo);
  }

  // ── internals ──────────────────────────────────────────────────

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

    return new AppInfo({
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
