import type { AppInfo } from './AppInfo.ts';

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
 */
export interface AppInfoRepository {
  list(appId: string, hints?: AppInfoListHints): Promise<AppInfo[]>;
  save(appInfo: AppInfo): Promise<void>;
}
