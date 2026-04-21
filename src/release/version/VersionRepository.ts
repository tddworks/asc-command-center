import type { Version } from './Version.ts';
import type { VersionLocalization } from './VersionLocalization.ts';

/**
 * Port for version-level operations beyond list (which currently lives on
 * the App aggregate). Repository is attached to each Version instance so it
 * can load its own localizations and save.
 */
export interface VersionRepository {
  listLocalizations(version: Version): Promise<VersionLocalization[]>;
  save(version: Version): Promise<void>;
}
