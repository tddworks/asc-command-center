import { Version } from '../Version.ts';
import { VersionLocalization } from '../VersionLocalization.ts';
import type { VersionRepository } from '../VersionRepository.ts';
import { apiClient, type DataMode } from '../../../shared/api-client.tsx';
import { MockVersionRepository } from './VersionRepository.mock.ts';

/**
 * REST adapter for version-level operations.
 *
 * Follows the per-version `listLocalizations` / `getLocalizations` affordance
 * for loading text, and `updateVersion` for saving the aggregate's top-level
 * fields (versionString, copyright, releaseType, earliestReleaseDate). No DTO
 * types — raw JSON flows directly into `VersionLocalization.fromJSON`.
 *
 * Localization-level PATCH and locale add/remove are not wired here yet; they
 * delegate to the in-memory mock fallback so the UI behaves consistently
 * end-to-end while the backend catches up.
 */
export class RestVersionRepository implements VersionRepository {
  private readonly saveFallback = new MockVersionRepository();
  private warnedLocalizations = false;

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
    await this.saveTopLevel(version);
    if (this.hasLocalizationChanges(version)) {
      if (!this.warnedLocalizations) {
        console.warn(
          '[Version] per-localization PATCH via REST is not implemented yet — ' +
          'persisting locale changes in the in-memory store until the backend ' +
          'ships affordances.',
        );
        this.warnedLocalizations = true;
      }
      await this.saveFallback.save(version);
    }
  }

  // ── internals ──

  private async saveTopLevel(version: Version): Promise<void> {
    const url = version.affordances.updateVersion;
    if (!url) return; // No affordance → nothing to persist at the top level.
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      // Always send every editable field — null is how the caller clears an
      // optional one (copyright, earliestReleaseDate). Skipping the key would
      // leave the server's previous value in place.
      body: JSON.stringify({
        versionString: version.versionString,
        copyright: version.copyright,
        releaseType: version.releaseType,
        earliestReleaseDate: version.earliestReleaseDate,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PATCH ${url} failed: ${res.status} ${text}`);
    }
  }

  private hasLocalizationChanges(version: Version): boolean {
    return version.localizations.some((l) => l.hasUnsavedChanges || l.id === '');
  }
}

export async function versionRepositoryFor(mode: DataMode): Promise<VersionRepository> {
  if (mode === 'mock') return new MockVersionRepository();
  return new RestVersionRepository();
}
