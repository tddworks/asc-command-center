import { App } from '../App.ts';
import { Build } from '../../../release/build/Build.ts';
import { Version } from '../../../release/version/Version.ts';
import { apiClient, type DataMode } from '../../../shared/api-client.tsx';
import type { AppRepository } from '../AppRepository.ts';

export class RestAppRepository implements AppRepository {
  async list(): Promise<App[]> {
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>('/api/v1/apps');
    return json.data.map((row) => App.fromJSON(row, this));
  }

  async get(id: string): Promise<App> {
    const json = await apiClient.get<{ data: Record<string, unknown> }>(`/api/v1/apps/${id}`);
    return App.fromJSON(json.data, this);
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
    return json.data.map(Version.fromJSON);
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
