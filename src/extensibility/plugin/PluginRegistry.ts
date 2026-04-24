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
 * The registry stays focused on *what* is registered — resolvers (pages,
 * sidebar items, widgets) are thin read-only methods. Adding a new
 * contribution type means adding a new field on `PluginRegistration`
 * and a resolver here; it does not require rewriting existing methods.
 */
export class PluginRegistry {
  private plugins: Map<string, PluginRegistration> = new Map();

  register(plugin: PluginRegistration): void {
    this.plugins.set(plugin.id, plugin);
  }

  unregister(id: string): void {
    this.plugins.delete(id);
  }

  getPages(): PluginPage[] {
    return [...this.plugins.values()].flatMap((p) => p.pages ?? []);
  }

  getSidebarItems(): PluginSidebarItem[] {
    return [...this.plugins.values()].flatMap((p) => p.sidebarItems ?? []);
  }

  /** Widgets registered for a given slot, priority-sorted (lower first).
   *  The cast back to `PluginWidget<S>` is safe because we filtered on
   *  the literal slot; TypeScript's variance check can't express that
   *  narrowing across our discriminated-union shape. */
  getWidgets<S extends SlotName>(slot: S): PluginWidget<S>[] {
    const all = [...this.plugins.values()].flatMap((p) => p.widgets ?? []);
    return all
      .filter((w) => w.slot === slot)
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100)) as unknown as PluginWidget<S>[];
  }

  getAll(): PluginRegistration[] {
    return [...this.plugins.values()];
  }

  has(id: string): boolean {
    return this.plugins.has(id);
  }
}

export const pluginRegistry = new PluginRegistry();
