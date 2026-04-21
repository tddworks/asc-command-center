import { App } from '../App.ts';
import { Build } from '../../../release/build/Build.ts';
import { Version } from '../../../release/version/Version.ts';
import { RestVersionRepository } from '../../../release/version/infrastructure/VersionRepository.api.ts';
import { apiClient, type DataMode } from '../../../shared/api-client.tsx';
import type { AppRepository } from '../AppRepository.ts';

export class RestAppRepository implements AppRepository {
  async list(): Promise<App[]> {
    // ?include=icon enriches each row with `iconAsset: { templateUrl, ... }`
    // so AppIcon renders real Apple CDN icons without a second request.
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>('/api/v1/apps?include=icon');
    return json.data.map((row) => App.fromJSON(row, this));
  }

  async get(id: string): Promise<App> {
    const json = await apiClient.get<{ data: Record<string, unknown> }>(`/api/v1/apps/${id}?include=icon`);
    // Single-resource endpoints return `data` as an object OR a one-item array.
    const row = Array.isArray(json.data) ? (json.data as Record<string, unknown>[])[0] : json.data;
    return App.fromJSON(row ?? {}, this);
  }

  async builds(app: App): Promise<Build[]> {
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(
      `/api/v1/apps/${app.id}/builds`,
    );
    return json.data.map(Build.fromJSON);
  }

  async versions(app: App): Promise<Version[]> {
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(
      `/api/v1/apps/${app.id}/versions`,
    );
    const versionRepo = new RestVersionRepository();
    return json.data.map((row) => {
      const v = Version.fromJSON(row);
      v.setRepository(versionRepo);
      return v;
    });
  }
}

/** Resolve the AppRepository implementation for the current data mode. */
export async function repositoryFor(mode: DataMode): Promise<AppRepository> {
  if (mode === 'mock') {
    const { MockAppRepository } = await import('./App.mock.ts');
    return new MockAppRepository();
  }
  return new RestAppRepository();
}
