import type { ComponentType } from 'react';
import type { ContextFor, SlotName } from './slots.ts';

/**
 * Plugin contribution shape — what a plugin hands to `api.register(...)`.
 *
 * `id` namespaces the settings store and the registry entry. The three
 * contribution arrays are independent; a plugin can declare only pages,
 * only widgets, or any combination.
 */
export interface PluginRegistration {
  id: string;
  name: string;
  version: string;
  pages?: PluginPage[];
  sidebarItems?: PluginSidebarItem[];
  /** Each widget is typed by *its* slot — the array is a discriminated
   *  union so a `text.edit` widget's component is typed against
   *  `TextEditSlotContext` specifically (not the union of all slot
   *  contexts). */
  widgets?: SomeWidget[];
}

/** Discriminated union over slot names. Mapped-lookup pattern produces
 *  `PluginWidget<'text.edit'> | PluginWidget<'page.toolbar'> | …`. */
export type SomeWidget = { [S in SlotName]: PluginWidget<S> }[SlotName];

export interface PluginPage {
  path: string;
  title: string;
  icon?: string;
  /** Lazy ES-module factory. Using a factory instead of a pre-loaded
   *  component keeps cold-load cost off the host's critical path. */
  component: () => Promise<{ default: ComponentType }>;
}

export interface PluginSidebarItem {
  id: string;
  label: string;
  icon?: string;
  section: string;
  path: string;
}

/**
 * A widget targets a specific host slot. Its component props are the
 * slot's `ContextFor<slot>` — TypeScript enforces the match, so a widget
 * registered for `text.edit` cannot read `page.toolbar` fields by
 * accident.
 */
export interface PluginWidget<S extends SlotName = SlotName> {
  slot: S;
  component: ComponentType<ContextFor<S>>;
  /** Lower values render earlier; defaults to 100. */
  priority?: number;
}

/**
 * Lifecycle handle returned from a plugin's `activate`. The host calls
 * `deactivate` on reload / disable so the plugin can release resources
 * (MobX disposers, timers, etc.). Optional — most plugins have nothing
 * to clean up and can return `undefined`.
 */
export interface PluginHandle {
  deactivate?(): void | Promise<void>;
}

/**
 * A plugin module's shape. Each plugin entry file exports this as its
 * default export; the host calls `activate(api)` after dynamic import.
 */
export interface PluginModule {
  activate(api: import('./PluginAPI.ts').PluginAPI): PluginHandle | void | Promise<PluginHandle | void>;
}
