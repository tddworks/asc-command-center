import type { PluginSettings } from './PluginAPI.ts';

/**
 * `host.settings` — plaintext plugin settings store. Primary path hits
 * asc-cli (`GET/PUT /api/plugin-settings/:id`), which owns the on-disk
 * JSON at `~/.asc/plugin-settings/<id>.json`. When those endpoints aren't
 * deployed yet, transparently falls back to `localStorage` keyed by
 * `ascpro.plugin-settings.<id>` so plugins keep working locally.
 *
 * Plaintext — no keychain routing. A plugin holding a credential must
 * live with the tradeoff that the JSON file sits readable on disk.
 *
 * The fallback is a bridge, not a final home: once asc-cli ships the
 * endpoints, the fallback path never runs in production and could be
 * removed. Its shape matches the REST response so swapping is silent.
 */

interface SettingsResponse {
  settings: Record<string, unknown>;
}

function storageKey(pluginId: string): string {
  return `ascpro.plugin-settings.${pluginId}`;
}

/** Injection hooks so tests can stub fetch + localStorage deterministically. */
export interface SettingsClientDeps {
  fetch: typeof fetch;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  /** Poll cadence for `subscribe`. Tests pass 0 to disable; default 2s. */
  pollMs: number;
}

const defaultDeps: SettingsClientDeps = {
  fetch: (...args) => globalThis.fetch(...args),
  storage: globalThis.localStorage,
  pollMs: 2000,
};

export function createSettingsClient(deps: Partial<SettingsClientDeps> = {}): PluginSettings {
  const { fetch, storage, pollMs } = { ...defaultDeps, ...deps };

  // Track subscribe callbacks per-pluginId so multiple subscribers share
  // one poll loop. The poller exits when every subscriber detaches.
  const subs = new Map<string, Set<() => void>>();
  const lastSignature = new Map<string, string>();
  const timers = new Map<string, ReturnType<typeof setInterval>>();

  async function restLoad(pluginId: string): Promise<Record<string, unknown> | null> {
    const res = await fetch(`/api/plugin-settings/${pluginId}`);
    if (res.status === 404) return null; // endpoint not deployed → fallback
    if (!res.ok) {
      throw new Error(`GET /api/plugin-settings/${pluginId} failed: ${res.status}`);
    }
    const payload = (await res.json()) as SettingsResponse;
    return payload.settings ?? {};
  }

  function localLoad(pluginId: string): Record<string, unknown> {
    const raw = storage.getItem(storageKey(pluginId));
    if (!raw) return {};
    try { return JSON.parse(raw) as Record<string, unknown>; }
    catch { return {}; }
  }

  function localSave(pluginId: string, value: Record<string, unknown>): void {
    storage.setItem(storageKey(pluginId), JSON.stringify(value));
  }

  async function restSave(pluginId: string, value: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/plugin-settings/${pluginId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: value }),
    });
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`PUT /api/plugin-settings/${pluginId}: ${res.status}`);
    return true;
  }

  function notify(pluginId: string, next: Record<string, unknown>): void {
    const signature = JSON.stringify(next);
    if (lastSignature.get(pluginId) === signature) return;
    lastSignature.set(pluginId, signature);
    const set = subs.get(pluginId);
    if (!set) return;
    for (const cb of set) {
      try { cb(); } catch (err) { console.warn('[host.settings] subscriber threw:', err); }
    }
  }

  const api: PluginSettings = {
    async load(pluginId) {
      try {
        const rest = await restLoad(pluginId);
        if (rest !== null) {
          notify(pluginId, rest);
          return rest as never;
        }
      } catch (err) {
        console.warn(`[host.settings] REST load failed for ${pluginId}, falling back:`, err);
      }
      const local = localLoad(pluginId);
      notify(pluginId, local);
      return local as never;
    },

    async save(pluginId, value) {
      try {
        const ok = await restSave(pluginId, value as Record<string, unknown>);
        if (ok) { notify(pluginId, value as Record<string, unknown>); return; }
      } catch (err) {
        console.warn(`[host.settings] REST save failed for ${pluginId}, falling back:`, err);
      }
      localSave(pluginId, value as Record<string, unknown>);
      notify(pluginId, value as Record<string, unknown>);
    },

    subscribe(pluginId, onChange) {
      let set = subs.get(pluginId);
      if (!set) {
        set = new Set();
        subs.set(pluginId, set);
      }
      set.add(onChange);

      if (pollMs > 0 && !timers.has(pluginId)) {
        const tick = () => {
          api.load(pluginId).catch(() => { /* logged inside */ });
        };
        tick();
        const handle = setInterval(tick, pollMs);
        timers.set(pluginId, handle);
      }

      return () => {
        set!.delete(onChange);
        if (set!.size === 0) {
          const timer = timers.get(pluginId);
          if (timer) clearInterval(timer);
          timers.delete(pluginId);
          subs.delete(pluginId);
          lastSignature.delete(pluginId);
        }
      };
    },
  };

  return api;
}

/** Shared instance used by `installPluginAPI`. */
export const hostSettings: PluginSettings = createSettingsClient();
