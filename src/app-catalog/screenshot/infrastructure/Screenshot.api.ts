import type { ScreenshotRepository } from '../ScreenshotRepository.ts';
import { ScreenshotSet } from '../ScreenshotSet.ts';
import { Screenshot } from '../Screenshot.ts';
import { SCREENSHOT_DISPLAY_TYPES, type DisplayTypeMeta } from '../ScreenshotDisplayType.ts';
import { MockScreenshotRepository } from './Screenshot.mock.ts';
import { apiClient, type DataMode } from '../../../shared/api-client.tsx';

/**
 * REST adapter for screenshot sets.
 *
 * Follows a 3-step chain that the backend exposes today:
 *
 *   1. `GET /api/v1/versions/{versionId}/localizations`       → pick by locale
 *   2. `GET /api/v1/version-localizations/{locId}/screenshot-sets`
 *   3. `GET /api/v1/screenshot-sets/{setId}/screenshots`      → per-set in parallel
 *
 * Step 3 follows the `listScreenshots` affordance on each set when present;
 * otherwise falls back to the well-known URL. The localization itself has
 * `_links: {}` today (backend doesn't advertise the screenshot-sets link),
 * so step 2 uses the URL convention — switch to affordance-following when
 * the backend surfaces it.
 *
 * Missing required display types get empty scaffold entries so the UI
 * always shows an `+ Add` slot for required types. Sets sort by canonical
 * display order.
 *
 * No DTO types here — each list is a `Record<string, unknown>[]`, and the
 * domain classes own the mapping via `fromJSON`.
 */
export class RestScreenshotRepository implements ScreenshotRepository {
  async listSets(versionId: string, locale: string): Promise<ScreenshotSet[]> {
    // Step 1 — find the matching version localization.
    const locs = await apiClient.get<{ data: Record<string, unknown>[] }>(
      `/api/v1/versions/${versionId}/localizations`,
    );
    const loc = (locs.data ?? []).find((l) => (l.locale as string | undefined) === locale);

    // No localization → the user needs to add one in App Info first.
    // Still render an empty scaffold so they see the required device grid.
    if (!loc) return emptyScaffold();

    // Step 2 — list screenshot sets by URL convention (backend doesn't
    // expose the affordance on localizations yet).
    const sets = await apiClient.get<{ data: Record<string, unknown>[] }>(
      `/api/v1/version-localizations/${loc.id}/screenshot-sets`,
    );

    // Step 3 — fetch screenshots per set in parallel, then hydrate.
    const hydrated = await Promise.all(
      (sets.data ?? []).map((row) => this.hydrateSet(row)),
    );

    return mergeWithScaffold(hydrated);
  }

  private async hydrateSet(row: Record<string, unknown>): Promise<ScreenshotSet> {
    const affordances = (row.affordances as Record<string, string> | undefined) ?? {};
    const href =
      affordances.listScreenshots
      ?? `/api/v1/screenshot-sets/${row.id as string}/screenshots`;

    let screenshots: Screenshot[] = [];
    try {
      const resp = await apiClient.get<{ data: Record<string, unknown>[] }>(href);
      screenshots = (resp.data ?? []).map((s, i) => Screenshot.fromJSON(s, i + 1));
    } catch (err) {
      console.warn(`[Screenshots] failed to load set ${row.id}:`, err);
    }
    return ScreenshotSet.fromJSON(row, screenshots);
  }
}

/** Returns empty sets for every required iPhone + iPad display type. */
function emptyScaffold(): ScreenshotSet[] {
  return SCREENSHOT_DISPLAY_TYPES
    .filter((t) => t.required && (t.platform === 'IOS' || t.platform === 'IPAD_OS'))
    .map(buildEmptySet)
    .sort(byDisplayOrder);
}

/** Adds empty scaffolds for required display types the backend didn't return,
 *  then sorts everything by display order. Keeps non-required types the
 *  backend DID return (e.g. iPhone 6.1" if the user uploaded screenshots). */
function mergeWithScaffold(fetched: ScreenshotSet[]): ScreenshotSet[] {
  const byType = new Map(fetched.map((s) => [s.displayTypeId, s]));
  for (const t of SCREENSHOT_DISPLAY_TYPES) {
    if (t.required && (t.platform === 'IOS' || t.platform === 'IPAD_OS') && !byType.has(t.apiId)) {
      byType.set(t.apiId, buildEmptySet(t));
    }
  }
  return Array.from(byType.values()).sort(byDisplayOrder);
}

function buildEmptySet(t: DisplayTypeMeta): ScreenshotSet {
  return new ScreenshotSet({
    id: `empty-${t.apiId}`,
    displayTypeId: t.apiId,
    screenshots: [],
  });
}

function byDisplayOrder(a: ScreenshotSet, b: ScreenshotSet): number {
  return (a.meta?.displayOrder ?? 9999) - (b.meta?.displayOrder ?? 9999);
}

export async function screenshotRepositoryFor(mode: DataMode): Promise<ScreenshotRepository> {
  if (mode === 'mock') return new MockScreenshotRepository();
  return new RestScreenshotRepository();
}
