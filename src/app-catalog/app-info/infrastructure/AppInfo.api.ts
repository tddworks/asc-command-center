import { AppInfo } from '../AppInfo.ts';
import type { AppInfoRepository } from '../AppInfoRepository.ts';
import type { DataMode } from '../../../shared/api-client.tsx';
import { MockAppInfoRepository } from './AppInfo.mock.ts';

/**
 * REST adapter for App Info — falls back to the mock until the backend
 * implements `GET /api/v1/apps/{id}/app-infos` (currently 404s).
 *
 * TODO: once the backend ships `/app-infos` + `/app-info-localizations`,
 * replace the mock delegation below with real `apiClient.get` / PATCH / POST
 * calls. Keep the same method shape; the aggregate doesn't need to change.
 */
export class RestAppInfoRepository implements AppInfoRepository {
  private readonly fallback = new MockAppInfoRepository();
  private warned = false;

  async get(appId: string): Promise<AppInfo> {
    this.warnOnce();
    return this.fallback.get(appId);
  }

  async save(appInfo: AppInfo): Promise<void> {
    this.warnOnce();
    return this.fallback.save(appInfo);
  }

  private warnOnce(): void {
    if (this.warned) return;
    this.warned = true;
    console.warn(
      '[AppInfo] backend /api/v1/apps/{id}/app-infos not implemented yet — using in-memory fallback',
    );
  }
}

export async function repositoryFor(mode: DataMode): Promise<AppInfoRepository> {
  if (mode === 'mock') return new MockAppInfoRepository();
  return new RestAppInfoRepository();
}
