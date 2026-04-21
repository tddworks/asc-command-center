import type { AppInfo } from './AppInfo.ts';

/**
 * Port for the AppInfo aggregate. Infrastructure provides a REST adapter and
 * a mock; the domain depends only on this protocol.
 *
 * `save` receives the whole aggregate and is expected to mutate it in place:
 *   - backfill backend ids on any locally-added localizations
 *   - call `AppInfoLocalization.markSaved()` on each (clean + dirty) localization
 *   - call `AppInfo.markSaved()` at the end
 *
 * The aggregate's `save()` method wraps this call and does not itself flip
 * dirty state — that's the repository's job, because only the repository
 * knows whether the write actually succeeded end-to-end.
 */
export interface AppInfoRepository {
  get(appId: string): Promise<AppInfo>;
  save(appInfo: AppInfo): Promise<void>;
}
