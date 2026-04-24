import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from '../../../src/extensibility/plugin/PluginRegistry.ts';

/** Widgets are now plain React components — the host dynamic-imports the
 *  plugin module before calling `register`, so by the time the widget
 *  lands in the registry it's already a real component (no lazy wrapper).
 *  Pages stay lazy because routes benefit from code-splitting. */
const NullComponent = () => null;
const lazyPageFactory = () => Promise.resolve({ default: NullComponent });

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  it('starts empty', () => {
    expect(registry.getAll()).toEqual([]);
    expect(registry.getPages()).toEqual([]);
    expect(registry.getSidebarItems()).toEqual([]);
  });

  it('registers a plugin and retrieves its pages', () => {
    registry.register({
      id: 'test-plugin',
      name: 'Test',
      version: '1.0.0',
      pages: [{ path: '/test', title: 'Test', component: lazyPageFactory }],
    });

    expect(registry.getPages()).toHaveLength(1);
    expect(registry.getPages()[0].path).toBe('/test');
  });

  it('returns widgets for a specific slot sorted by priority', () => {
    const widgetA = { slot: 'text.edit' as const, component: NullComponent, priority: 50 };
    const widgetB = { slot: 'text.edit' as const, component: NullComponent, priority: 10 };
    const widgetC = { slot: 'page.toolbar' as const, component: NullComponent };

    registry.register({ id: 'p1', name: 'P1', version: '1.0', widgets: [widgetA, widgetC] });
    registry.register({ id: 'p2', name: 'P2', version: '1.0', widgets: [widgetB] });

    const textEditWidgets = registry.getWidgets('text.edit');
    expect(textEditWidgets).toHaveLength(2);
    expect(textEditWidgets[0].priority).toBe(10);
    expect(textEditWidgets[1].priority).toBe(50);
  });

  it('returns empty array for slot with no widgets', () => {
    expect(registry.getWidgets('list.rowAction')).toEqual([]);
  });

  it('aggregates sidebar items from all plugins', () => {
    registry.register({
      id: 'p1', name: 'P1', version: '1.0',
      sidebarItems: [{ id: 's1', label: 'Item 1', section: 'plugins', path: '/p1' }],
    });
    registry.register({
      id: 'p2', name: 'P2', version: '1.0',
      sidebarItems: [{ id: 's2', label: 'Item 2', section: 'plugins', path: '/p2' }],
    });

    expect(registry.getSidebarItems()).toHaveLength(2);
  });

  it('overwrites when registering same plugin id twice', () => {
    registry.register({
      id: 'p1', name: 'P1', version: '1.0',
      pages: [{ path: '/a', title: 'A', component: lazyPageFactory }],
    });
    registry.register({
      id: 'p1', name: 'P1 Updated', version: '2.0',
      pages: [{ path: '/b', title: 'B', component: lazyPageFactory }],
    });

    expect(registry.getAll()).toHaveLength(1);
    expect(registry.getPages()[0].path).toBe('/b');
  });

  it('unregister removes a plugin and its contributions', () => {
    registry.register({
      id: 'p1', name: 'P1', version: '1.0',
      pages: [{ path: '/p1', title: 'P1', component: lazyPageFactory }],
      widgets: [{ slot: 'text.edit', component: NullComponent }],
    });

    registry.unregister('p1');

    expect(registry.has('p1')).toBe(false);
    expect(registry.getPages()).toEqual([]);
    expect(registry.getWidgets('text.edit')).toEqual([]);
  });

  it('checks if plugin is registered', () => {
    registry.register({ id: 'p1', name: 'P1', version: '1.0' });

    expect(registry.has('p1')).toBe(true);
    expect(registry.has('p2')).toBe(false);
  });

  it('uses default priority 100 when not specified', () => {
    const widgetA = { slot: 'text.edit' as const, component: NullComponent, priority: 50 };
    const widgetB = { slot: 'text.edit' as const, component: NullComponent }; // default 100

    registry.register({ id: 'p1', name: 'P1', version: '1.0', widgets: [widgetB] });
    registry.register({ id: 'p2', name: 'P2', version: '1.0', widgets: [widgetA] });

    const widgets = registry.getWidgets('text.edit');
    expect(widgets[0].priority).toBe(50);
    expect(widgets[1].priority).toBeUndefined();
  });
});
