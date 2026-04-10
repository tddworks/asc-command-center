import { describe, it, expect } from 'vitest';
import { BetaGroup } from '../../src/testflight/BetaGroup.ts';

describe('BetaGroup', () => {

  // ── Semantic Booleans ──

  it('is internal when isInternal is true', () => {
    const g = new BetaGroup('g-1', 'app-1', 'App Store Connect Users', true, false, undefined, {});
    expect(g.isInternal).toBe(true);
  });

  it('has public link when publicLink is defined and publicLinkEnabled is true', () => {
    const g = new BetaGroup('g-2', 'app-1', 'External Testers', false, true, 'https://testflight.apple.com/join/abc', {});
    expect(g.hasPublicLink).toBe(true);
  });

  it('does not have public link when publicLinkEnabled is false', () => {
    const g = new BetaGroup('g-2', 'app-1', 'External Testers', false, false, 'https://testflight.apple.com/join/abc', {});
    expect(g.hasPublicLink).toBe(false);
  });

  it('does not have public link when publicLink is undefined', () => {
    const g = new BetaGroup('g-3', 'app-1', 'Private Testers', false, true, undefined, {});
    expect(g.hasPublicLink).toBe(false);
  });

  // ── Capability Checks ──

  it('can add tester when server provides affordance', () => {
    const g = new BetaGroup('g-1', 'app-1', 'Testers', false, false, undefined, {
      addTester: 'asc testflight testers add --group-id g-1 --email test@example.com',
    });
    expect(g.canAddTester).toBe(true);
  });

  it('cannot add tester when affordance missing', () => {
    const g = new BetaGroup('g-1', 'app-1', 'Testers', false, false, undefined, {});
    expect(g.canAddTester).toBe(false);
  });

  it('can list testers when server provides affordance', () => {
    const g = new BetaGroup('g-1', 'app-1', 'Testers', false, false, undefined, {
      listTesters: 'asc testflight testers list --group-id g-1',
    });
    expect(g.canListTesters).toBe(true);
  });

  // ── Display ──

  it('shows Internal badge for internal groups', () => {
    const g = new BetaGroup('g-1', 'app-1', 'Internal', true, false, undefined, {});
    expect(g.typeBadge).toBe('Internal');
  });

  it('shows External badge for external groups', () => {
    const g = new BetaGroup('g-2', 'app-1', 'External', false, false, undefined, {});
    expect(g.typeBadge).toBe('External');
  });

  // ── Hydration ──

  it('hydrates from API JSON', () => {
    const json = {
      id: 'g-1',
      appId: 'app-1',
      name: 'Beta Testers',
      isInternal: false,
      publicLinkEnabled: true,
      publicLink: 'https://testflight.apple.com/join/xyz',
      affordances: {
        addTester: 'asc testflight testers add --group-id g-1 --email test@example.com',
        listTesters: 'asc testflight testers list --group-id g-1',
      },
    };

    const g = BetaGroup.fromJSON(json);

    expect(g.id).toBe('g-1');
    expect(g.appId).toBe('app-1');
    expect(g.name).toBe('Beta Testers');
    expect(g.isInternal).toBe(false);
    expect(g.hasPublicLink).toBe(true);
    expect(g.canAddTester).toBe(true);
    expect(g.canListTesters).toBe(true);
    expect(g.typeBadge).toBe('External');
  });

  it('hydrates with empty affordances when missing', () => {
    const json = {
      id: 'g-2', appId: 'app-1', name: 'Internal Group',
      isInternal: true, publicLinkEnabled: false,
    };

    const g = BetaGroup.fromJSON(json);
    expect(g.affordances).toEqual({});
    expect(g.canAddTester).toBe(false);
    expect(g.canListTesters).toBe(false);
    expect(g.publicLink).toBeUndefined();
  });
});
