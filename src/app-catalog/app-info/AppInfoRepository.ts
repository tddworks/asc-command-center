import type { AppInfo } from './AppInfo.ts';
import type { AppInfoLocalization } from './AppInfoLocalization.ts';
import type { Affordances } from '../../shared/types.ts';

export interface AppInfoListHints {
  /**
   * The owning app's primary locale. The AppInfo payload doesn't include it
   * directly, and when the backend returns zero localizations we still need
   * a seat for the primary-locale row so the form has something to bind to.
   */
  primaryLocale?: string;
}

/**
 * Port for the App Info aggregate.
 *
 * The backend returns multiple AppInfo rows per app — one per version state
 * (e.g. `READY_FOR_DISTRIBUTION` for the live version, `PREPARE_FOR_SUBMISSION`
 * for the next version being edited). The hook picks the right one based on
 * the currently-selected version's state.
 *
 * The save surface is intentionally split to mirror Apple's endpoints:
 *   • `saveCategories` PATCHes AppInfo itself (primary/secondary categories +
 *     the content-rights declaration).
 *   • `saveLocalization` PATCHes a single AppInfoLocalization (name, subtitle,
 *     privacy URLs).
 *   • `createLocalization` / `deleteLocalization` manage the locale set.
 *
 * `AppInfo.save()` orchestrates these calls based on its own dirty state, so
 * repositories don't have to duplicate the diffing logic.
 */
export interface AppInfoRepository {
  list(appId: string, hints?: AppInfoListHints): Promise<AppInfo[]>;
  saveCategories(appInfo: AppInfo): Promise<void>;
  saveLocalization(localization: AppInfoLocalization): Promise<void>;
  /** Returns the fresh id AND affordances assigned by the backend so the
   *  aggregate can promote the placeholder locale to a fully-capable entity
   *  in one go — a user who adds a locale should be able to PATCH or DELETE
   *  it immediately, without waiting for a list refresh. */
  createLocalization(
    appInfo: AppInfo,
    localization: AppInfoLocalization,
  ): Promise<{ id: string; affordances: Affordances }>;
  deleteLocalization(localization: AppInfoLocalization): Promise<void>;
}
