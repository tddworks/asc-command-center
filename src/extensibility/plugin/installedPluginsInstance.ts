import { InstalledPlugins } from './InstalledPlugins.ts';
import { MockInstalledPluginRepository } from './infrastructure/InstalledPlugin.mock.ts';

/**
 * Module-level singleton for the plugin manifest. Same pattern as
 * `workspace`, `accounts`: built once with the mock repo, rebound to the
 * REST repo via `installedPlugins.switchRepository(repo)` from the
 * App-level mode bridge. The Plugins page wraps in `observer()` and reads
 * the singleton directly — no React context, no hook.
 */
export const installedPlugins = new InstalledPlugins(new MockInstalledPluginRepository());

installedPlugins.refreshAll().catch((err: unknown) => {
  console.warn('[installed-plugins] initial refresh failed:', err);
});
