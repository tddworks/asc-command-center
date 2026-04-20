import type { Dashboard } from './Dashboard.ts';

/**
 * Port for the fleet-wide dashboard briefing. One call, four fan-outs behind it.
 */
export interface DashboardRepository {
  load(): Promise<Dashboard>;
}
