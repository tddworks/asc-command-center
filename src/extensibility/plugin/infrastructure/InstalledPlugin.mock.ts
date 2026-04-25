import { InstalledPlugin } from '../InstalledPlugin.ts';
import type { InstalledPluginRepository } from '../InstalledPluginRepository.ts';

/**
 * MockInstalledPluginRepository — fixtures mirror the real shape `/api/v1/plugins`
 * and `/api/v1/plugins/market` ship. Two installed (ASC Pro + Screenshot Studio) and three
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
    return new InstalledPlugin({
      id: p.id,
      slug: p.slug,
      name: p.name,
      version: p.version,
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
