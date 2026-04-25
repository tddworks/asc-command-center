import type { InstalledPlugin } from './InstalledPlugin.ts';
import type { PluginUpdate } from './PluginUpdate.ts';

/**
 * Port for the asc CLI's plugin endpoints.
 *
 *   • `installed()`               → `GET    /api/v1/plugins`
 *   • `market(query?)`            → `GET    /api/v1/plugins/market[?q=…]`
 *   • `updates()`                 → `GET    /api/v1/plugins/updates`
 *   • `install(plugin)`           → `POST   /api/v1/plugins`
 *   • `uninstall(plugin)`         → `DELETE /api/v1/plugins/:name`
 *   • `applyUpdate(name)`         → `POST   /api/v1/plugins/:name/update`
 *
 * Install/uninstall take the entity rather than a bare id so the REST
 * adapter can follow `plugin.affordances.install` / `.uninstall` when the
 * backend ships them, with the canonical URLs as the fallback.
 */
export interface InstalledPluginRepository {
  installed(): Promise<InstalledPlugin[]>;
  market(query?: string): Promise<InstalledPlugin[]>;
  updates(): Promise<PluginUpdate[]>;
  install(plugin: InstalledPlugin): Promise<void>;
  uninstall(plugin: InstalledPlugin): Promise<void>;
  applyUpdate(update: PluginUpdate): Promise<void>;
}
