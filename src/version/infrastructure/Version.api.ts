import { Version } from '../Version.ts';
import { apiClient } from '../../shared/api-client.ts';
import type { DataMode } from '../../shared/api-client.ts';

export async function fetchVersions(appId: string, mode: DataMode): Promise<Version[]> {
  if (mode === 'mock') {
    const { mockVersions } = await import('./Version.mock.ts');
    return mockVersions(appId);
  }
  const json = await apiClient.get<{ data: Record<string, unknown>[] }>(
    `/api/v1/apps/${appId}/versions`,
  );
  return json.data.map(Version.fromJSON);
}
