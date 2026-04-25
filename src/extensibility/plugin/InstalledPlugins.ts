import { makeAutoObservable, runInAction } from 'mobx';
import { InstalledPlugin } from './InstalledPlugin.ts';
import type { PluginUpdate } from './PluginUpdate.ts';
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
  /** Outdated installed plugins paired with their marketplace version.
   *  Loaded by `refreshAll`; the page joins on `name` to show the per-card
   *  Update CTA. */
  updates: PluginUpdate[] = [];
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
  get updatesCount(): number { return this.updates.length; }
  get hasUpdates(): boolean { return this.updates.length > 0; }

  /** Lookup an outdated entry by plugin name. The page calls this on
   *  every Installed card to decide whether to render the Update badge. */
  updateFor(plugin: InstalledPlugin): PluginUpdate | undefined {
    return this.updates.find((u) =>
      u.name === plugin.name || u.name === plugin.slug || u.name === plugin.id,
    );
  }

  // ── Mutators ──

  switchRepository(repo: InstalledPluginRepository): void {
    this.repository = repo;
    this.installed = [];
    this.marketplace = [];
    this.updates = [];
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
      // Fetch installed + marketplace + updates in parallel. Marketplace
      // and updates are best-effort: an offline registry shouldn't break
      // the installed list. Errors there log and degrade to empty arrays.
      const [installed, marketplace, updates] = await Promise.all([
        this.repository.installed(),
        this.repository.market(this.marketQuery || undefined).catch((err) => {
          console.warn('[plugins] marketplace fetch failed:', err);
          return [];
        }),
        this.repository.updates().catch((err) => {
          console.warn('[plugins] updates fetch failed:', err);
          return [];
        }),
      ]);
      runInAction(() => {
        this.installed = installed;
        this.marketplace = marketplace;
        // Only surface entries where the marketplace version is strictly
        // newer than the installed one — the asc backend ships every
        // mismatch, including local-is-newer (which we don't want to
        // present as "Update available · 1.0.1 → 1.0").
        this.updates = updates.filter((u) => u.isUpgrade);
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

  /** Apply a marketplace update — POSTs to the update endpoint, then
   *  refreshes both lists so the version bump and isInstalled state are
   *  reflected in one render. The installed counterpart's slug is passed
   *  to the repo so URL routing uses the canonical (URL-safe) identifier
   *  instead of the human-readable name (which can contain spaces). */
  async applyUpdate(update: PluginUpdate): Promise<void> {
    const installed = this.installed.find((p) =>
      p.name === update.name || p.slug === update.name || p.id === update.name,
    );
    this.busy = update.name;
    try {
      await this.repository.applyUpdate(update, { slug: installed?.slug });
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
