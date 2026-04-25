import type { InstalledPlugin } from './InstalledPlugin.ts';

/**
 * Port for the asc CLI's plugin endpoints.
 *
 *   • `installed()`               → `GET    /api/v1/plugins`
 *   • `market(query?)`            → `GET    /api/v1/plugins/market[?q=…]`
 *   • `install(plugin)`           → `POST   /api/v1/plugins`           (or affordance)
 *   • `uninstall(plugin)`         → `DELETE /api/v1/plugins/:name`     (or affordance)
 *
 * Install/uninstall take the entity rather than a bare id so the REST
 * adapter can follow `plugin.affordances.install` / `.uninstall` when the
 * backend ships them, with the canonical URLs as the fallback.
 */
export interface InstalledPluginRepository {
  installed(): Promise<InstalledPlugin[]>;
  market(query?: string): Promise<InstalledPlugin[]>;
  install(plugin: InstalledPlugin): Promise<void>;
  uninstall(plugin: InstalledPlugin): Promise<void>;
}
