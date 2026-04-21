import type { AppInfo } from './AppInfo.ts';
import type { AppInfoListHints, AppInfoRepository } from './AppInfoRepository.ts';

/**
 * Root aggregate for the App Info slice. Thin wrapper over the repository.
 * Returns a list (one AppInfo per version state) — the caller picks the one
 * matching the currently-selected version.
 */
export class AppInfos {
  constructor(private readonly repo: AppInfoRepository) {}

  list(appId: string, hints?: AppInfoListHints): Promise<AppInfo[]> {
    return this.repo.list(appId, hints);
  }
}
