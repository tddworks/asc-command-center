import { makeAutoObservable, runInAction } from 'mobx';
import type { InstalledPlugin } from './InstalledPlugin.ts';
import type { InstalledPluginRepository } from './InstalledPluginRepository.ts';

/**
 * Root aggregate for the plugin manifest. Mirrors the shape of `Apps`,
 * `Accounts`, etc. — load on demand, expose isLoading / error / loaded
 * for the page to render the right state.
 */
export class InstalledPlugins {
  repository: InstalledPluginRepository;

  plugins: InstalledPlugin[] = [];
  isLoading = false;
  error: Error | null = null;
  loaded = false;

  constructor(repository: InstalledPluginRepository) {
    this.repository = repository;
    makeAutoObservable(this, { repository: false });
  }

  // ── Display helpers ──

  get count(): number { return this.plugins.length; }
  get hasPlugins(): boolean { return this.plugins.length > 0; }

  // ── Mutators ──

  switchRepository(repo: InstalledPluginRepository): void {
    this.repository = repo;
    this.plugins = [];
    this.error = null;
    this.loaded = false;
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      const list = await this.repository.list();
      runInAction(() => {
        this.plugins = list;
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

  bySlug(slug: string): InstalledPlugin | undefined {
    return this.plugins.find((p) => p.slug === slug);
  }
}
