import type { ScreenshotSet } from './ScreenshotSet.ts';

/**
 * Port for loading screenshot sets for a given (version, locale) scope.
 * Upload / delete / reorder are intentionally NOT on the port yet — the
 * backend hasn't confirmed endpoints; those will land once affordances
 * appear on the localization payload.
 */
export interface ScreenshotRepository {
  listSets(versionId: string, locale: string): Promise<ScreenshotSet[]>;
}
