import { Version } from '../Version.ts';
import { apiClient } from '../../../shared/api-client.tsx';
import type { DataMode } from '../../../shared/api-client.tsx';
import { versionRepositoryFor } from './VersionRepository.api.ts';

export async function fetchVersions(appId: string, mode: DataMode): Promise<Version[]> {
  const versionRepo = await versionRepositoryFor(mode);
  if (mode === 'mock') {
    const { mockVersions } = await import('./Version.mock.ts');
    return mockVersions(appId).map((v) => {
      v.setRepository(versionRepo);
      return v;
    });
  }
  const json = await apiClient.get<{ data: Record<string, unknown>[] }>(
    `/api/v1/apps/${appId}/versions`,
  );
  return json.data.map((row) => {
    const v = Version.fromJSON(row);
    v.setRepository(versionRepo);
    return v;
  });
}
