import { Version } from '../Version.ts';
import { VersionLocalization } from '../VersionLocalization.ts';
import type { VersionRepository } from '../VersionRepository.ts';
import { apiClient, type DataMode } from '../../../shared/api-client.tsx';
import { MockVersionRepository } from './VersionRepository.mock.ts';

/**
 * REST adapter for version-level operations.
 *
 * Follows the per-version `listLocalizations` / `getLocalizations` affordance.
 * No DTO types — raw JSON flows directly into `VersionLocalization.fromJSON`,
 * which owns the hydration contract. `save` still falls back to the in-memory
 * mock until the backend ships `updateVersion` / `updateLocalization`.
 */
export class RestVersionRepository implements VersionRepository {
  private readonly saveFallback = new MockVersionRepository();
  private saveWarned = false;

  async listLocalizations(version: Version): Promise<VersionLocalization[]> {
    const href =
      version.affordances.listLocalizations ??
      version.affordances.getLocalizations;
    if (!href) return [];

    try {
      const resp = await apiClient.get<{ data: Record<string, unknown>[] }>(href);
      return (resp.data ?? []).map(VersionLocalization.fromJSON);
    } catch (err) {
      console.warn('[Version] failed to load localizations:', err);
      return [];
    }
  }

  async save(version: Version): Promise<void> {
    if (!this.saveWarned) {
      console.warn(
        '[Version] save via REST not implemented yet — falling back to in-memory store. ' +
        'Wire PATCH using affordances.updateVersion and per-localization affordances once confirmed.',
      );
      this.saveWarned = true;
    }
    return this.saveFallback.save(version);
  }
}

export async function versionRepositoryFor(mode: DataMode): Promise<VersionRepository> {
  if (mode === 'mock') return new MockVersionRepository();
  return new RestVersionRepository();
}
