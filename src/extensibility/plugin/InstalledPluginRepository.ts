import type { InstalledPlugin } from './InstalledPlugin.ts';

/**
 * Port for the asc CLI's plugin endpoints.
 *
 * Three operations the legacy `plugins.js` page exercises and we mirror:
 *
 *   • `installed()` → `GET /api/v1/plugins`         — what's installed locally.
 *   • `market()`    → `GET /api/v1/plugins/market`  — what's available to install.
 *   • `install(id)` / `uninstall(slug)` — invoke the asc CLI via `/api/run`.
 *
 * Install/uninstall are CLI-bridge calls (not REST resources) because the
 * asc backend implements them as plugin commands; the result is reflected
 * in the next `installed()` refresh.
 */
export interface InstalledPluginRepository {
  installed(): Promise<InstalledPlugin[]>;
  market(): Promise<InstalledPlugin[]>;
  install(id: string): Promise<void>;
  uninstall(slug: string): Promise<void>;
}
