import { InstalledPlugin } from '../InstalledPlugin.ts';
import { PluginUpdate } from '../PluginUpdate.ts';
import type { InstalledPluginRepository } from '../InstalledPluginRepository.ts';

/**
 * MockInstalledPluginRepository — fixtures mirror the real shape `/api/v1/plugins`
 * and `/api/v1/plugins/market` ship. Two installed (ASC Pro + Blitz) and three
 * marketplace entries so mock-mode looks realistic and exercises both code paths.
 *
 * Install/uninstall mutate the in-memory state so the page can be smoke-tested
 * end-to-end without a backend.
 */
/** Single source-of-truth registry for every mock plugin's repository URL.
 *  In real life each plugin has its own repo; for mock-mode the entire
 *  catalogue is curated under tddworks/asc-registry. Keeping it as one
 *  constant makes the intent obvious in code review. */
const ASC_REGISTRY_URL = 'https://github.com/tddworks/asc-registry';

export class MockInstalledPluginRepository implements InstalledPluginRepository {
  private installedSlugs = new Set<string>(['ASCPro']);

  /** What's installed locally (kept separate from the marketplace's
   *  always-latest version so the mock can simulate "update available"). */
  private installedVersions = new Map<string, string>([
    ['ASCPro', '0.9.0'],          // marketplace ships 1.0.0 → outdated
    ['BlitzScreenshots', '1.5.0'],
    ['discord-notify', '1.2.0'],
    ['slack-alerts', '2.1.0'],
    ['analytics-pro', '1.5.0'],
  ]);

  private allPlugins: InstalledPlugin[] = [
    new InstalledPlugin({
      id: 'ASCPro',
      slug: 'ASCPro',
      name: 'ASC Pro',
      version: '1.0.0',
      author: 'tddworks',
      description: 'AI screenshot generation, simulator streaming, and more.',
      categories: ['AI', 'Screenshots'],
      apiVersion: '1.0.0',
      ui: ['ui/ai.bundle.js', 'ui/simulator.bundle.js', 'frames/iPhone 17.png'],
      repositoryURL: ASC_REGISTRY_URL,
    }),
    new InstalledPlugin({
      id: 'discord-notify',
      slug: 'discord-notify',
      name: 'Discord Notify',
      version: '1.2.0',
      author: 'community',
      description: 'Send build and review notifications to Discord channels.',
      categories: ['Notifications'],
      repositoryURL: ASC_REGISTRY_URL,
    }),
    new InstalledPlugin({
      id: 'slack-alerts',
      slug: 'slack-alerts',
      name: 'Slack Alerts',
      version: '2.1.0',
      author: 'community',
      description: 'Slack integration for review and build alerts.',
      categories: ['Notifications'],
      repositoryURL: ASC_REGISTRY_URL,
    }),
    new InstalledPlugin({
      id: 'analytics-pro',
      slug: 'analytics-pro',
      name: 'Analytics Pro',
      version: '1.5.0',
      author: 'community',
      description: 'Advanced analytics dashboards.',
      categories: ['Analytics'],
      repositoryURL: ASC_REGISTRY_URL,
    }),
  ];

  async installed(): Promise<InstalledPlugin[]> {
    return this.allPlugins
      .filter((p) => this.installedSlugs.has(p.slug))
      .map((p) => this.withInstalled(p, true));
  }

  async updates(): Promise<PluginUpdate[]> {
    // An update is available when the installed version differs from
    // the marketplace catalogue's version for that plugin.
    return this.allPlugins
      .filter((p) => this.installedSlugs.has(p.slug))
      .map((p) => {
        const installedVersion = this.installedVersions.get(p.slug) ?? p.version ?? '0.0.0';
        const latest = p.version ?? '0.0.0';
        return { plugin: p, installedVersion, latest };
      })
      .filter(({ installedVersion, latest }) => installedVersion !== latest)
      .map(({ plugin, installedVersion, latest }) =>
        new PluginUpdate({
          name: plugin.name,
          installedVersion,
          latestVersion: latest,
          affordances: { update: `/api/v1/plugins/${plugin.slug}/update` },
        }),
      );
  }

  async applyUpdate(update: PluginUpdate): Promise<void> {
    const found = this.allPlugins.find((p) => p.name === update.name || p.slug === update.name);
    if (!found) throw new Error(`Plugin '${update.name}' not found`);
    // Bump the installed version up to the marketplace version.
    this.installedVersions.set(found.slug, update.latestVersion);
  }

  async market(query?: string): Promise<InstalledPlugin[]> {
    const all = this.allPlugins.map((p) =>
      this.withInstalled(p, this.installedSlugs.has(p.slug)),
    );
    const needle = query?.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((p) => {
      const haystack = [
        p.name, p.slug, p.id, p.description, p.author, ...p.categories,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }

  async install(plugin: InstalledPlugin): Promise<void> {
    const id = plugin.id || plugin.slug;
    const found = this.allPlugins.find((p) => p.id === id || p.slug === id);
    if (!found) throw new Error(`Plugin '${id}' not found in marketplace`);
    this.installedSlugs.add(found.slug);
  }

  async uninstall(plugin: InstalledPlugin): Promise<void> {
    const slug = plugin.slug || plugin.id;
    if (!this.installedSlugs.has(slug)) {
      throw new Error(`Plugin '${slug}' is not installed`);
    }
    this.installedSlugs.delete(slug);
  }

  private withInstalled(p: InstalledPlugin, isInstalled: boolean): InstalledPlugin {
    // Mirror the REST shape: installed rows ship an `uninstall` affordance,
    // marketplace rows ship `install`. Lets the page-level UI exercise the
    // "follow affordance" REST path in mock mode without a real backend.
    const affordances: Record<string, string> = isInstalled
      ? { uninstall: `/api/v1/plugins/${p.slug}` }
      : { install: '/api/v1/plugins' };
    // Installed rows report the *installed* version (which may lag behind
    // the marketplace's). Marketplace rows always report the latest.
    const version = isInstalled
      ? (this.installedVersions.get(p.slug) ?? p.version ?? null)
      : p.version;
    return new InstalledPlugin({
      id: p.id,
      slug: p.slug,
      name: p.name,
      version,
      author: p.author,
      description: p.description,
      categories: p.categories,
      apiVersion: p.apiVersion ?? undefined,
      ui: p.ui,
      repositoryURL: p.repositoryURL,
      isInstalled,
      affordances,
    });
  }
}
