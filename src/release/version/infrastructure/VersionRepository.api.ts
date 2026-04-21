import { Version } from '../Version.ts';
import { VersionLocalization } from '../VersionLocalization.ts';
import type { VersionRepository } from '../VersionRepository.ts';
import { apiClient, type DataMode } from '../../../shared/api-client.tsx';
import type { Affordances } from '../../../shared/types.ts';
import { MockVersionRepository } from './VersionRepository.mock.ts';

interface VersionLocalizationDTO {
  id?: string;
  locale?: string;
  description?: string | null;
  keywords?: string | null;
  whatsNew?: string | null;
  promotionalText?: string | null;
  supportUrl?: string | null;
  marketingUrl?: string | null;
  affordances?: Affordances;
}

/**
 * REST adapter for version-level operations.
 *
 * Follows the per-version `listLocalizations` / `updateLocalization` /
 * `updateVersion` affordances when present; falls back to mock for paths
 * the backend hasn't implemented yet.
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
      const resp = await apiClient.get<{ data: VersionLocalizationDTO[] }>(href);
      return (resp.data ?? []).map((dto) =>
        new VersionLocalization({
          id: dto.id ?? '',
          locale: dto.locale ?? '',
          description: dto.description ?? '',
          keywords: dto.keywords ?? '',
          whatsNew: dto.whatsNew ?? '',
          promotionalText: dto.promotionalText ?? '',
          supportUrl: dto.supportUrl ?? null,
          marketingUrl: dto.marketingUrl ?? null,
          affordances: dto.affordances ?? {},
        }),
      );
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
