import { makeAutoObservable } from 'mobx';
import type { Affordances } from '../../shared/types.ts';

export interface InstalledPluginInit {
  /** Stable identifier, used in URLs (`/api/plugins/:slug/...`). */
  slug: string;
  /** Human-readable name shown in the UI. */
  name: string;
  /** Marketplace registry id. Defaults to `slug` when absent — for
   *  installed plugins these are the same; for some marketplace entries
   *  the id is the npm/registry name and slug is local. */
  id?: string;
  /** Plugin-API version the bundle was compiled against. Optional —
   *  older asc revisions don't ship it and the host falls back to "any". */
  apiVersion?: string;
  /** Files the plugin ships under its `ui/` and `frames/` directories.
   *  Only `*.bundle.js` files are dynamic-imported by the host; the rest
   *  are static assets the plugin itself loads at runtime. */
  ui?: string[];
  /** Display-only metadata returned by `/api/v1/plugins` and
   *  `/api/v1/plugins/market`. All optional — the manifest endpoint
   *  (`/api/plugins`) doesn't ship them. */
  version?: string | null;
  description?: string | null;
  author?: string | null;
  categories?: string[];
  repositoryURL?: string | null;
  /** True for entries returned by the installed list, false (or missing)
   *  for marketplace entries. The aggregate uses this to render the right
   *  Install / Uninstall button. */
  isInstalled?: boolean;
  /** HATEOAS affordances on this plugin row — typically `install` (on
   *  marketplace entries) or `uninstall` (on installed entries). The REST
   *  adapter follows these when present and falls back to the canonical
   *  `/api/v1/plugins[/<slug>]` URLs otherwise. */
  affordances?: Affordances;
}

/**
 * Plugin descriptor — one entry from `GET /api/v1/plugins` (installed),
 * `GET /api/v1/plugins/market` (marketplace), or `GET /api/plugins`
 * (the runtime manifest used by the bootstrap loader).
 *
 * Distinct from `PluginRegistration` in `Plugin.ts`, which represents
 * an *activated* contribution after `bootstrapPlugins → activate(api)`.
 *
 * The class name is historical: it covers marketplace entries too.
 */
export class InstalledPlugin {
  readonly slug: string;
  readonly id: string;
  readonly name: string;
  readonly apiVersion: string | null;
  readonly ui: string[];
  readonly version: string | null;
  readonly description: string | null;
  readonly author: string | null;
  readonly categories: string[];
  readonly repositoryURL: string | null;
  readonly isInstalled: boolean;
  readonly affordances: Affordances;

  constructor(init: InstalledPluginInit) {
    this.slug = init.slug;
    this.id = init.id ?? init.slug;
    this.name = init.name;
    this.apiVersion = init.apiVersion ?? null;
    this.ui = init.ui ? [...init.ui] : [];
    this.version = init.version ?? null;
    this.description = init.description ?? null;
    this.author = init.author ?? null;
    this.categories = init.categories ? [...init.categories] : [];
    this.repositoryURL = init.repositoryURL ?? null;
    this.isInstalled = init.isInstalled ?? false;
    this.affordances = init.affordances ?? {};
    makeAutoObservable(this, {
      slug: false, id: false, name: false, apiVersion: false, ui: false,
      version: false, description: false, author: false, categories: false,
      repositoryURL: false, isInstalled: false, affordances: false,
    });
  }

  // ── Display ──

  get displayName(): string { return this.name; }

  /** First-letter glyph for the icon tile, falling back to `?` if the
   *  name is empty. Mirrors how `AppIcon` falls back when no asset is
   *  available. */
  get iconLetter(): string {
    const trimmed = this.name.trim();
    return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : '?';
  }

  /** UI bundles the host will dynamic-import. The rest of `ui` is
   *  asset-only (HTML pages, PNG frames, etc.) — we never evaluate them. */
  get bundles(): string[] {
    return this.ui.filter((f) => f.endsWith('.bundle.js'));
  }

  /** Other UI assets shipped by the plugin (frames, stylesheets, HTML).
   *  Useful for "what does this plugin contain?" detail views. */
  get assets(): string[] {
    return this.ui.filter((f) => !f.endsWith('.bundle.js'));
  }

  get bundleCount(): number { return this.bundles.length; }
  get assetCount(): number { return this.assets.length; }

  // ── Capability ──

  /** True when the plugin declared an apiVersion compatible with the host.
   *  Matching policy: same major (semver). Plugins without a declared
   *  apiVersion are treated as compatible — they predate the field. */
  isCompatible(hostApiVersion: string): boolean {
    if (!this.apiVersion) return true;
    const [pluginMajor] = this.apiVersion.split('.');
    const [hostMajor] = hostApiVersion.split('.');
    return pluginMajor === hostMajor;
  }

  /** URL the backend exposes for installing this plugin. Marketplace rows
   *  ship it; installed rows usually don't. */
  get installUrl(): string | null {
    return this.affordances.install ?? null;
  }

  /** URL the backend exposes for uninstalling this plugin. Installed rows
   *  ship it; marketplace rows don't. */
  get uninstallUrl(): string | null {
    return this.affordances.uninstall ?? null;
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): InstalledPlugin {
    return new InstalledPlugin({
      slug: (json.slug as string) ?? (json.id as string) ?? '',
      id: (json.id as string) ?? (json.slug as string) ?? '',
      name: (json.name as string) ?? (json.slug as string) ?? (json.id as string) ?? '',
      apiVersion: (json.apiVersion as string | undefined) ?? undefined,
      ui: Array.isArray(json.ui) ? (json.ui as string[]) : [],
      version: (json.version as string | null | undefined) ?? null,
      description: (json.description as string | null | undefined) ?? null,
      author: (json.author as string | null | undefined) ?? null,
      categories: Array.isArray(json.categories) ? (json.categories as string[]) : [],
      repositoryURL: (json.repositoryURL as string | null | undefined) ?? null,
      isInstalled: (json.isInstalled as boolean | undefined) ?? false,
      // `apiClient.get` flattens `_links → affordances` upstream, so the
      // row we receive here already has the flat shape.
      affordances: (json.affordances as Affordances | undefined) ?? {},
    });
  }
}
