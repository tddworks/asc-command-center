import type { InstalledPlugin } from './InstalledPlugin.ts';

/**
 * Port for the plugin manifest endpoint on the asc CLI host
 * (`GET /api/plugins`). Read-only — install/uninstall happens via the
 * `asc` CLI itself, not this REST surface.
 */
export interface InstalledPluginRepository {
  list(): Promise<InstalledPlugin[]>;
}
