import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PluginRegistry } from '../../../src/extensibility/plugin/PluginRegistry.ts';
import { PluginSlot } from '../../../src/extensibility/plugin/PluginSlot.tsx';
import { PluginProvider } from '../../../src/extensibility/plugin/PluginContext.tsx';
import type { TextEditSlotContext } from '../../../src/extensibility/plugin/slots.ts';

describe('PluginSlot', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  function renderSlot(ctx: TextEditSlotContext) {
    return render(
      <PluginProvider registry={registry}>
        <PluginSlot slot="text.edit" ctx={ctx} />
      </PluginProvider>,
    );
  }

  const ctx: TextEditSlotContext = {
    slot: 'text.edit',
    kind: 'appInfo.name',
    text: 'Hello',
    onChange: () => {},
    locale: 'en-US',
  };

  it('renders nothing when no widgets are registered', () => {
    const { container } = renderSlot(ctx);
    expect(container.firstChild).toBeNull();
  });

  it('forwards ctx as props to every registered widget', () => {
    function Widget(props: TextEditSlotContext) {
      return <span data-testid="w">{`${props.kind}:${props.text}`}</span>;
    }
    registry.register({
      id: 'p1', name: 'P1', version: '1.0',
      widgets: [{ slot: 'text.edit', component: Widget }],
    });

    renderSlot(ctx);
    expect(screen.getByTestId('w').textContent).toBe('appInfo.name:Hello');
  });

  it('renders multiple widgets in priority order (lower first)', () => {
    function Primary(_: TextEditSlotContext) { return <span data-testid="row">primary</span>; }
    function Secondary(_: TextEditSlotContext) { return <span data-testid="row">secondary</span>; }
    registry.register({
      id: 'p1', name: 'P1', version: '1.0',
      widgets: [{ slot: 'text.edit', component: Secondary, priority: 50 }],
    });
    registry.register({
      id: 'p2', name: 'P2', version: '1.0',
      widgets: [{ slot: 'text.edit', component: Primary, priority: 10 }],
    });

    renderSlot(ctx);
    const rendered = screen.getAllByTestId('row').map((el) => el.textContent);
    expect(rendered).toEqual(['primary', 'secondary']);
  });

  it('widgets that decline to render (return null) do not break siblings', () => {
    function Filter(props: TextEditSlotContext) {
      if (props.kind !== 'version.description') return null;
      return <span data-testid="w">shown</span>;
    }
    function Always() { return <span data-testid="w">always</span>; }
    registry.register({
      id: 'p1', name: 'P1', version: '1.0',
      widgets: [
        { slot: 'text.edit', component: Filter, priority: 10 },
        { slot: 'text.edit', component: Always, priority: 20 },
      ],
    });

    renderSlot(ctx);
    const rendered = screen.getAllByTestId('w').map((el) => el.textContent);
    expect(rendered).toEqual(['always']);
  });
});
