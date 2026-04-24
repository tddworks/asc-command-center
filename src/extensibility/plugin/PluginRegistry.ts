import { makeAutoObservable } from 'mobx';
import type {
  PluginRegistration,
  PluginPage,
  PluginSidebarItem,
  PluginWidget,
} from './Plugin.ts';
import type { SlotName } from './slots.ts';

/**
 * In-memory plugin registry. Single source of truth for what contributions
 * are live. `register` is idempotent per-id (the last registration wins),
 * which makes HMR and hot-reload straightforward. `unregister` removes a
 * plugin's contributions cleanly on deactivation.
 *
 * Observable: mutations propagate through MobX so `observer()`-wrapped
 * consumers (Sidebar, AppShell) re-render when plugins register *after*
 * initial page load — plugins are dynamic-imported by PluginBootstrap so
 * the Sidebar mounts first and the AI item lands a few ms later.
 *
 * Adding a new contribution type means adding a field on
 * `PluginRegistration` and a resolver here; existing resolvers stay
 * closed for modification.
 */
export class PluginRegistry {
  private plugins: Map<string, PluginRegistration> = new Map();
  /** Observable tick — MobX doesn't track Map mutations automatically, so
   *  we bump this on every change and touch it in every read. Consumers
   *  subscribe transparently via `observer()`. */
  private revision = 0;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  register(plugin: PluginRegistration): void {
    this.plugins.set(plugin.id, plugin);
    this.revision++;
  }

  unregister(id: string): void {
    if (this.plugins.delete(id)) this.revision++;
  }

  getPages(): PluginPage[] {
    void this.revision; // observe
    return [...this.plugins.values()].flatMap((p) => p.pages ?? []);
  }

  getSidebarItems(): PluginSidebarItem[] {
    void this.revision; // observe
    return [...this.plugins.values()].flatMap((p) => p.sidebarItems ?? []);
  }

  /** Widgets registered for a given slot, priority-sorted (lower first).
   *  The cast back to `PluginWidget<S>` is safe because we filtered on
   *  the literal slot; TypeScript's variance check can't express that
   *  narrowing across our discriminated-union shape. */
  getWidgets<S extends SlotName>(slot: S): PluginWidget<S>[] {
    void this.revision; // observe
    const all = [...this.plugins.values()].flatMap((p) => p.widgets ?? []);
    return all
      .filter((w) => w.slot === slot)
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100)) as unknown as PluginWidget<S>[];
  }

  getAll(): PluginRegistration[] {
    void this.revision; // observe
    return [...this.plugins.values()];
  }

  has(id: string): boolean {
    void this.revision; // observe
    return this.plugins.has(id);
  }
}

export const pluginRegistry = new PluginRegistry();
