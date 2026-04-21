import { describe, it, expect } from 'vitest';
import { AppInfoLocalization } from '../../../src/app-catalog/app-info/AppInfoLocalization.ts';

function make(overrides: Partial<{ id: string; locale: string; name: string; subtitle: string | null }> = {}) {
  return new AppInfoLocalization({
    id: 'loc-1',
    locale: 'en-US',
    name: 'Bakery App',
    subtitle: 'Fresh bread every morning',
    ...overrides,
  });
}

describe('AppInfoLocalization', () => {

  // ── Construction ──

  it('exposes identity and loaded fields', () => {
    const loc = make();
    expect(loc.id).toBe('loc-1');
    expect(loc.locale).toBe('en-US');
    expect(loc.name).toBe('Bakery App');
    expect(loc.subtitle).toBe('Fresh bread every morning');
  });

  it('reports not dirty immediately after construction', () => {
    expect(make().hasUnsavedChanges).toBe(false);
  });

  // ── Setters + dirty ──

  it('setName updates name and flips hasUnsavedChanges', () => {
    const loc = make();
    loc.setName('New Name');
    expect(loc.name).toBe('New Name');
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setSubtitle updates subtitle and flips hasUnsavedChanges', () => {
    const loc = make();
    loc.setSubtitle('New subtitle');
    expect(loc.subtitle).toBe('New subtitle');
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setSubtitle accepts null to clear the subtitle', () => {
    const loc = make();
    loc.setSubtitle(null);
    expect(loc.subtitle).toBeNull();
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setting a field to its current value does not flip dirty', () => {
    const loc = make();
    loc.setName('Bakery App');
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  it('returning to the snapshot value after a change clears dirty', () => {
    const loc = make();
    loc.setName('Edited');
    expect(loc.hasUnsavedChanges).toBe(true);
    loc.setName('Bakery App');
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  // ── discard ──

  it('discard restores the snapshot values', () => {
    const loc = make();
    loc.setName('Edited');
    loc.setSubtitle('Edited subtitle');

    loc.discard();

    expect(loc.name).toBe('Bakery App');
    expect(loc.subtitle).toBe('Fresh bread every morning');
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  // ── markSaved ──

  it('markSaved promotes the current values to the new snapshot', () => {
    const loc = make();
    loc.setName('New Name');

    loc.markSaved();

    expect(loc.hasUnsavedChanges).toBe(false);

    // discard would now restore "New Name", not "Bakery App"
    loc.setName('Another');
    loc.discard();
    expect(loc.name).toBe('New Name');
  });

  // ── Identity for unsaved (locally-added) locales ──

  it('accepts an empty id to represent a locally-added locale', () => {
    const loc = new AppInfoLocalization({ id: '', locale: 'fr-FR', name: 'Boulangerie', subtitle: null });
    expect(loc.id).toBe('');
    expect(loc.hasUnsavedChanges).toBe(false);
  });
});
