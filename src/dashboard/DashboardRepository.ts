import type { Dashboard } from './Dashboard.ts';

/**
 * Port for the fleet-wide dashboard briefing.
 *
 * `currentAppId` is the pinned/selected app — used to scope queries that
 * Apple requires per-app (review-submissions). Pass `null` when nothing is
 * selected; the implementation will return zero counts for those tiles.
 */
export interface DashboardRepository {
  load(currentAppId: string | null): Promise<Dashboard>;
}
