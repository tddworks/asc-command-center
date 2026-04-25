import { makeAutoObservable, runInAction } from 'mobx';
import { InstalledPlugin } from './InstalledPlugin.ts';
import type { InstalledPluginRepository } from './InstalledPluginRepository.ts';

/** Build a plugin clone with `isInstalled: false` — used by the optimistic
 *  uninstall path so the marketplace card flips to "Install" instantly. */
function markNotInstalled(p: InstalledPlugin): InstalledPlugin {
  return new InstalledPlugin({
    slug: p.slug,
    id: p.id,
    name: p.name,
    apiVersion: p.apiVersion ?? undefined,
    ui: p.ui,
    version: p.version,
    description: p.description,
    author: p.author,
    categories: p.categories,
    repositoryURL: p.repositoryURL,
    isInstalled: false,
    affordances: p.affordances,
  });
}

/**
 * Root aggregate for the Plugins page. Tracks two parallel lists —
 * Installed and Marketplace — plus a single-source-of-truth busy slug
 * the UI uses to spinner the right Install/Uninstall button, and the
 * current marketplace search query so re-renders don't lose it.
 *
 * Mutators always end with a refresh so both stat counts and both grids
 * reflect the post-mutation state, mirroring the legacy
 * `plugins.js → refreshAll()` behavior.
 */
export class InstalledPlugins {
  repository: InstalledPluginRepository;

  installed: InstalledPlugin[] = [];
  marketplace: InstalledPlugin[] = [];
  marketQuery = '';

  isLoading = false;
  error: Error | null = null;
  loaded = false;

  /** When set, that plugin's row should render its Install/Uninstall
   *  button in the spinner state. Single field rather than per-row to
   *  match the legacy "one mutation at a time" UX. */
  busy: string | null = null;

  constructor(repository: InstalledPluginRepository) {
    this.repository = repository;
    makeAutoObservable(this, { repository: false });
  }

  // ── Display helpers ──

  get installedCount(): number { return this.installed.length; }
  get marketplaceCount(): number { return this.marketplace.length; }

  // ── Mutators ──

  switchRepository(repo: InstalledPluginRepository): void {
    this.repository = repo;
    this.installed = [];
    this.marketplace = [];
    this.marketQuery = '';
    this.error = null;
    this.loaded = false;
    void this.refreshAll();
  }

  /** Load both lists in parallel. Called on mount and after every
   *  install/uninstall so the marketplace shows the new isInstalled
   *  state and the installed list reflects the just-added plugin.
   *  Reuses the current `marketQuery` so a refresh doesn't drop the
   *  user's filter. */
  async refreshAll(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      const [installed, marketplace] = await Promise.all([
        this.repository.installed(),
        this.repository.market(this.marketQuery || undefined).catch((err) => {
          // Marketplace can fail (offline registry, older asc) without
          // breaking the installed list. Log and continue with empty.
          console.warn('[plugins] marketplace fetch failed:', err);
          return [];
        }),
      ]);
      runInAction(() => {
        this.installed = installed;
        this.marketplace = marketplace;
        this.loaded = true;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err as Error;
        this.loaded = true;
      });
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  /** Update the marketplace search query and re-fetch. The page debounces
   *  user input and calls this; the aggregate just owns the query state. */
  async searchMarket(query: string): Promise<void> {
    this.marketQuery = query;
    try {
      const market = await this.repository.market(query || undefined);
      runInAction(() => { this.marketplace = market; });
    } catch (err) {
      console.warn('[plugins] marketplace search failed:', err);
      runInAction(() => { this.marketplace = []; });
    }
  }

  async install(plugin: InstalledPlugin): Promise<void> {
    this.busy = plugin.slug || plugin.id;
    try {
      await this.repository.install(plugin);
      await this.refreshAll();
    } finally {
      runInAction(() => { this.busy = null; });
    }
  }

  async uninstall(plugin: InstalledPlugin): Promise<void> {
    // Marketplace entries can ship a different slug than the installed
    // counterpart (the asc backend uses kebab-case for marketplace ids
    // and PascalCase for installed slugs). Resolve to the installed
    // entity so the DELETE hits the canonical URL — otherwise the
    // backend silently 204s without removing anything.
    const target =
      this.installed.find((p) =>
        p.slug === plugin.slug ||
        p.id === plugin.id ||
        p.name === plugin.name,
      ) ?? plugin;

    this.busy = target.slug || target.id;
    // Optimistic remove: the user has clicked Uninstall and confirmed —
    // hide the row immediately so the page feels responsive, then let
    // the refresh confirm the backend state. If the DELETE fails the
    // refresh will restore the entry.
    const removedSlug = target.slug;
    runInAction(() => {
      this.installed = this.installed.filter((p) => p.slug !== removedSlug);
      this.marketplace = this.marketplace.map((p) => p.slug === removedSlug ? markNotInstalled(p) : p);
    });
    try {
      await this.repository.uninstall(target);
      await this.refreshAll();
    } finally {
      runInAction(() => { this.busy = null; });
    }
  }

  // ── Lookups ──

  installedBySlug(slug: string): InstalledPlugin | undefined {
    return this.installed.find((p) => p.slug === slug);
  }
}
