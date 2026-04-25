import { InstalledPlugin } from '../InstalledPlugin.ts';
import type { InstalledPluginRepository } from '../InstalledPluginRepository.ts';
import { type DataMode } from '../../../shared/api-client.tsx';
import { MockInstalledPluginRepository } from './InstalledPlugin.mock.ts';

/**
 * REST adapter for the asc backend's `PluginsController`:
 *
 *   GET    /api/v1/plugins                — installed list
 *   GET    /api/v1/plugins/market[?q=…]   — marketplace listing / search
 *   POST   /api/v1/plugins                — install   body: { name }
 *   DELETE /api/v1/plugins/:name          — uninstall (204 No Content)
 *
 * Each plugin row carries `_links → affordances` (`install` on marketplace
 * entries, `uninstall` on installed entries). When present we follow the
 * affordance URL; otherwise we fall back to the canonical paths above.
 *
 * All requests flow through the global fetch interceptor so they resolve
 * against the user's local CLI even when the SPA is served from a public
 * origin.
 */
const BASE = '/api/v1/plugins';

export class RestInstalledPluginRepository implements InstalledPluginRepository {
  async installed(): Promise<InstalledPlugin[]> {
    return this.fetchList(BASE, { defaultIsInstalled: true });
  }

  async market(query?: string): Promise<InstalledPlugin[]> {
    const url = query && query.trim().length > 0
      ? `${BASE}/market?q=${encodeURIComponent(query.trim())}`
      : `${BASE}/market`;
    return this.fetchList(url, { defaultIsInstalled: false });
  }

  async install(plugin: InstalledPlugin): Promise<void> {
    // Prefer the affordance URL the marketplace row ships; the body shape
    // is stable regardless of which URL we hit.
    const url = plugin.installUrl ?? BASE;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name: plugin.id || plugin.slug }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`POST ${url} failed: ${resp.status} ${text || resp.statusText}`);
    }
  }

  async uninstall(plugin: InstalledPlugin): Promise<void> {
    const url = plugin.uninstallUrl ?? `${BASE}/${encodeURIComponent(plugin.slug || plugin.id)}`;
    const resp = await fetch(url, { method: 'DELETE' });
    // 204 success; 404 means already gone — idempotent delete.
    if (!resp.ok && resp.status !== 404) {
      const text = await resp.text().catch(() => '');
      throw new Error(`DELETE ${url} failed: ${resp.status} ${text || resp.statusText}`);
    }
  }

  // ── internals ──

  private async fetchList(
    url: string,
    opts: { defaultIsInstalled: boolean },
  ): Promise<InstalledPlugin[]> {
    // `no-store` keeps the browser from serving a stale 200 after an
    // install/uninstall — we want the *current* server state, not an
    // intermediate cached one.
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!resp.ok) throw new Error(`GET ${url} failed: ${resp.status}`);
    const json = await resp.json();
    // Tolerate both `{ data: [...] }` (REST list) and `{ plugins: [...] }`
    // (legacy manifest). Each row may also carry `_links` which we flatten
    // into `affordances` so the entity exposes `installUrl`/`uninstallUrl`.
    const rows: Record<string, unknown>[] = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.plugins)
        ? json.plugins
        : [];
    return rows.map((row) =>
      InstalledPlugin.fromJSON({ isInstalled: opts.defaultIsInstalled, ...flattenLinks(row) }),
    );
  }
}

/** Inline equivalent of `apiClient.normalizeLinks` for a single resource —
 *  the plugin endpoints don't go through `apiClient.get` (we use `fetch`
 *  directly) so we run the same flattening here to keep affordance access
 *  uniform with the rest of the codebase. */
function flattenLinks(row: Record<string, unknown>): Record<string, unknown> {
  if (row.affordances || !row._links) return row;
  const links = row._links as Record<string, { href: string } | string>;
  const affordances: Record<string, string> = {};
  for (const [key, val] of Object.entries(links)) {
    affordances[key] = typeof val === 'string' ? val : val.href;
  }
  return { ...row, affordances };
}

export async function repositoryFor(mode: DataMode): Promise<InstalledPluginRepository> {
  if (mode === 'mock') return new MockInstalledPluginRepository();
  return new RestInstalledPluginRepository();
}
