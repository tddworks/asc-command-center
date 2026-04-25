import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PluginAPI } from './PluginAPI.ts';
import type { PluginHandle, PluginModule } from './Plugin.ts';
import { pluginRegistry } from './PluginRegistry.ts';
import { resolveApiUrl } from '../../shared/api-client.tsx';

interface ManifestResponse {
  plugins: Array<{
    name: string;
    slug: string;
    ui: string[];
    apiVersion?: string;
  }>;
}

export interface BootstrapOptions {
  api: PluginAPI;
  /** Injection hook so tests can stub dynamic import. Defaults to native
   *  `import()` at the resolved URL. */
  resolveModule?: (url: string) => Promise<PluginModule>;
  /** Override for the manifest endpoint — defaults to `/api/plugins`. */
  manifestUrl?: string;
  /** Force the apiVersion gate on or off. When `undefined` we auto-detect:
   *  permissive on `localhost` / `127.0.0.1` (developers iterate on the
   *  host and the plugin in lockstep — strict gating just gets in the
   *  way), strict on every other origin. */
  strictApiVersion?: boolean;
}

/**
 * Load every installed plugin's UI scripts, call `activate(api)` on each
 * module's default export, and track the returned handles so we can call
 * `deactivate()` on unmount (dev HMR, tests).
 *
 * Errors are isolated per plugin: a failed fetch, import, or activate
 * call logs to console and skips that plugin — the rest of the host
 * continues booting. This is by design: one bad plugin must not
 * white-screen the app.
 */
export async function bootstrapPlugins({
  api,
  // Dynamic `import()` doesn't go through the fetch interceptor, so we
  // route the URL through `resolveApiUrl` here. In dev / localhost-served
  // builds this is a no-op; in the public-origin build (cc.asccli.app) it
  // rewrites `/api/plugins/...` to `https://localhost:8421/api/plugins/...`.
  resolveModule = (url) => import(/* @vite-ignore */ resolveApiUrl(url)),
  manifestUrl = '/api/plugins',
  strictApiVersion,
}: BootstrapOptions): Promise<PluginHandle[]> {
  const handles: PluginHandle[] = [];
  const strict = strictApiVersion ?? !isLocalhost();

  let manifest: ManifestResponse;
  try {
    const res = await fetch(manifestUrl);
    if (!res.ok) throw new Error(`GET ${manifestUrl} ${res.status}`);
    manifest = (await res.json()) as ManifestResponse;
  } catch (err) {
    // Manifest unreachable — running without a CLI backend (e.g. mock mode
    // in a browser with no server). Not a failure, just skip plugins.
    console.info('[plugin-bootstrap] no manifest — skipping plugin load:', err);
    return handles;
  }

  for (const plugin of manifest.plugins ?? []) {
    // apiVersion mismatch: warn once and skip — but only when the strict
    // gate is on. On localhost (developer iteration) we let everything
    // through; mismatches surface as runtime errors from `activate(api)`
    // if the plugin actually breaks.
    if (strict && plugin.apiVersion && !isCompatible(plugin.apiVersion, api.version)) {
      console.warn(
        `[plugin-bootstrap] ${plugin.name}: incompatible apiVersion ` +
        `${plugin.apiVersion} (host: ${api.version}) — skipping.`,
      );
      continue;
    }
    if (!strict && plugin.apiVersion && !isCompatible(plugin.apiVersion, api.version)) {
      console.info(
        `[plugin-bootstrap] ${plugin.name}: apiVersion ${plugin.apiVersion} ` +
        `differs from host ${api.version} — loading anyway (localhost dev).`,
      );
    }

    for (const file of plugin.ui ?? []) {
      // Only `*.bundle.js` files are dynamic-imported as ES modules — the
      // naming convention plugins use for their activate entry point.
      // Other `.js` assets (legacy IIFEs, scripts loaded by plugin HTML
      // pages served separately) stay available at their public URL but
      // are never evaluated by the host. This keeps a plugin from
      // accidentally mutating `document.body` at SPA boot time.
      if (!file.endsWith('.bundle.js')) continue;
      const url = `/api/plugins/${plugin.slug}/${file}`;
      try {
        const mod = await resolveModule(url);
        if (typeof mod.activate !== 'function') {
          const msg = `${url}: no default.activate export`;
          console.warn(`[plugin-bootstrap] ${msg}`);
          pluginRegistry.recordError(plugin.slug, msg);
          continue;
        }
        const handle = await mod.activate(api);
        if (handle) handles.push(handle);
        pluginRegistry.clearError(plugin.slug);
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        console.warn(`[plugin-bootstrap] ${url} failed to activate:`, err);
        pluginRegistry.recordError(plugin.slug, msg);
      }
    }
  }

  return handles;
}

/** Semver-correct compatibility check.
 *
 * For `1.x.y` and beyond, the major segment is the breaking-change
 * boundary — we accept anything sharing the same major.
 *
 * For pre-1.0 (`0.x.y`), semver convention treats the **minor** segment
 * as the breaking-change boundary. The asc plugin API is currently `0.x`,
 * so two plugins are compatible iff they share both major *and* minor.
 */
function isCompatible(pluginApiVersion: string, hostVersion: string): boolean {
  const [pmaj, pmin] = pluginApiVersion.split('.');
  const [hmaj, hmin] = hostVersion.split('.');
  if (pmaj !== hmaj) return false;
  if (pmaj === '0') return pmin === hmin;
  return true;
}

/** True when the SPA is running on the developer's machine (Vite dev,
 *  asc-served localhost, etc.). Used to relax the apiVersion gate. */
function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/** React bridge — runs bootstrap once on mount, calls deactivate on
 *  unmount. Renders children immediately; plugins light up as they
 *  register (PluginRegistry is reactive-ish via React re-renders that
 *  read `getPages()` / `getWidgets()`). */
export function PluginBootstrap({
  api,
  children,
  options,
}: {
  api: PluginAPI;
  children: ReactNode;
  options?: Omit<BootstrapOptions, 'api'>;
}) {
  // `handles` is mirrored into a ref so the cleanup closure sees the latest
  // value rather than the empty initial state. The setState call exists only
  // to give consumers something they could subscribe to in the future; the
  // ref is the load-bearing one.
  const handlesRef = useRef<PluginHandle[]>([]);
  const [, setHandles] = useState<PluginHandle[]>([]);

  useEffect(() => {
    let cancelled = false;
    bootstrapPlugins({ api, ...options }).then((list) => {
      if (cancelled) return;
      handlesRef.current = list;
      setHandles(list);
    });
    return () => {
      cancelled = true;
      for (const h of handlesRef.current) {
        try { h.deactivate?.(); } catch (err) {
          console.warn('[plugin-bootstrap] deactivate threw:', err);
        }
      }
      handlesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
