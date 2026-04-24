import { useEffect, useState, type ReactNode } from 'react';
import type { PluginAPI } from './PluginAPI.ts';
import type { PluginHandle, PluginModule } from './Plugin.ts';

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
  resolveModule = (url) => import(/* @vite-ignore */ url),
  manifestUrl = '/api/plugins',
}: BootstrapOptions): Promise<PluginHandle[]> {
  const handles: PluginHandle[] = [];

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
    // apiVersion mismatch: warn once and skip. Follows SRP — bootstrap
    // decides compatibility, not individual plugins.
    if (plugin.apiVersion && !isCompatible(plugin.apiVersion, api.version)) {
      console.warn(
        `[plugin-bootstrap] ${plugin.name}: incompatible apiVersion ` +
        `${plugin.apiVersion} (host: ${api.version}) — skipping.`,
      );
      continue;
    }

    for (const file of plugin.ui ?? []) {
      if (!file.endsWith('.js')) continue;
      const url = `/api/plugins/${plugin.slug}/${file}`;
      try {
        const mod = await resolveModule(url);
        if (typeof mod.activate !== 'function') {
          console.warn(`[plugin-bootstrap] ${url}: no default.activate export`);
          continue;
        }
        const handle = await mod.activate(api);
        if (handle) handles.push(handle);
      } catch (err) {
        console.warn(`[plugin-bootstrap] ${url} failed to activate:`, err);
      }
    }
  }

  return handles;
}

/** `1.x.y` is compatible with plugin `apiVersion` `1.a.b` when their major
 *  versions match. Everything else is either ahead (risky) or behind
 *  (missing features) and we skip to keep the boot deterministic. */
function isCompatible(pluginApiVersion: string, hostVersion: string): boolean {
  const major = (v: string) => v.split('.')[0];
  return major(pluginApiVersion) === major(hostVersion);
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
  const [handles, setHandles] = useState<PluginHandle[]>([]);

  useEffect(() => {
    let cancelled = false;
    bootstrapPlugins({ api, ...options }).then((list) => {
      if (!cancelled) setHandles(list);
    });
    return () => {
      cancelled = true;
      for (const h of handles) {
        try { h.deactivate?.(); } catch (err) {
          console.warn('[plugin-bootstrap] deactivate threw:', err);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
