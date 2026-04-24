import { createElement } from 'react';
import { usePluginRegistry } from './PluginContext.tsx';
import type { ContextFor, SlotName } from './slots.ts';

interface Props<S extends SlotName> {
  slot: S;
  /** Context passed to every widget registered for this slot. Typed per
   *  slot so a `text.edit` mount point can't accidentally omit `onChange`. */
  ctx: ContextFor<S>;
}

/**
 * Mount point for plugin widgets. The host renders this wherever a slot
 * lives in the UI; the registry provides widgets; the slot forwards the
 * strongly-typed context as props to each widget.
 *
 * Widgets are already-loaded React components (the plugin module is
 * dynamic-imported at boot, before `register()` is called) — no Suspense
 * wrapping needed here. If a widget throws during render, React's nearest
 * error boundary catches it; the host ships one near route roots so a bad
 * plugin can't white-screen the whole app.
 */
export function PluginSlot<S extends SlotName>({ slot, ctx }: Props<S>) {
  const registry = usePluginRegistry();
  const widgets = registry.getWidgets(slot);

  if (widgets.length === 0) return null;

  return (
    <div className="plugin-slot" data-slot={slot}>
      {widgets.map((widget, i) =>
        createElement(widget.component, { key: i, ...ctx }),
      )}
    </div>
  );
}
