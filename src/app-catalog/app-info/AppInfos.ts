import type { AppInfo } from './AppInfo.ts';
import type { AppInfoRepository } from './AppInfoRepository.ts';

/**
 * Root aggregate for the App Info slice. Thin wrapper over the repository —
 * mirrors `Apps` / `Apps.get(id)` so the hook layer has a single entry point.
 */
export class AppInfos {
  constructor(private readonly repo: AppInfoRepository) {}

  get(appId: string): Promise<AppInfo> {
    return this.repo.get(appId);
  }
}
