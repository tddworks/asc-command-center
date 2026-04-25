import { makeAutoObservable } from 'mobx';

export interface InstalledPluginInit {
  /** Stable identifier, used in URLs (`/api/plugins/:slug/...`). */
  slug: string;
  /** Human-readable name shown in the UI. */
  name: string;
  /** Plugin-API version the bundle was compiled against. Optional —
   *  older asc revisions don't ship it and the host falls back to "any". */
  apiVersion?: string;
  /** Files the plugin ships under its `ui/` and `frames/` directories.
   *  Only `*.bundle.js` files are dynamic-imported by the host; the rest
   *  are static assets the plugin itself loads at runtime. */
  ui: string[];
}

/**
 * InstalledPlugin — one entry from `GET /api/plugins`.
 *
 * Represents a plugin *package* installed on the asc CLI host (whether
 * or not it has successfully activated). Distinct from the runtime
 * `PluginRegistration` in `Plugin.ts`, which represents an *activated*
 * contribution after `bootstrapPlugins → activate(api)`.
 *
 * Read-only by design — installation/uninstallation goes through the asc
 * CLI directly, not this REST surface.
 */
export class InstalledPlugin {
  readonly slug: string;
  readonly name: string;
  readonly apiVersion: string | null;
  readonly ui: string[];

  constructor(init: InstalledPluginInit) {
    this.slug = init.slug;
    this.name = init.name;
    this.apiVersion = init.apiVersion ?? null;
    this.ui = [...init.ui];
    makeAutoObservable(this, {
      slug: false, name: false, apiVersion: false, ui: false,
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

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): InstalledPlugin {
    return new InstalledPlugin({
      slug: (json.slug as string) ?? '',
      name: (json.name as string) ?? (json.slug as string) ?? '',
      apiVersion: (json.apiVersion as string | undefined) ?? undefined,
      ui: Array.isArray(json.ui) ? (json.ui as string[]) : [],
    });
  }
}
