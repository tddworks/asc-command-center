import { describe, it, expect } from 'vitest';
import { AppInfoLocalization, type AppInfoLocalizationInit } from '../../../src/app-catalog/app-info/AppInfoLocalization.ts';

function make(overrides: Partial<AppInfoLocalizationInit> = {}) {
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

  it('setPrivacyPolicyUrl updates the field and flips hasUnsavedChanges', () => {
    const loc = make();
    loc.setPrivacyPolicyUrl('https://x.test/p');
    expect(loc.privacyPolicyUrl).toBe('https://x.test/p');
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setPrivacyChoicesUrl updates the field and flips hasUnsavedChanges', () => {
    const loc = make();
    loc.setPrivacyChoicesUrl('https://x.test/c');
    expect(loc.privacyChoicesUrl).toBe('https://x.test/c');
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setPrivacyPolicyUrl accepts null to clear', () => {
    const loc = make({ privacyPolicyUrl: 'https://x.test/p' });
    loc.setPrivacyPolicyUrl(null);
    expect(loc.privacyPolicyUrl).toBeNull();
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

  it('discard restores privacy URLs to the snapshot', () => {
    const loc = make({
      privacyPolicyUrl: 'https://x.test/p',
      privacyChoicesUrl: 'https://x.test/c',
    });
    loc.setPrivacyPolicyUrl('https://y.test/p');
    loc.setPrivacyChoicesUrl(null);

    loc.discard();

    expect(loc.privacyPolicyUrl).toBe('https://x.test/p');
    expect(loc.privacyChoicesUrl).toBe('https://x.test/c');
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

  it('markSaved promotes privacy URLs into the snapshot', () => {
    const loc = make();
    loc.setPrivacyPolicyUrl('https://x.test/p');

    loc.markSaved();

    expect(loc.hasUnsavedChanges).toBe(false);
    loc.setPrivacyPolicyUrl('https://z.test/p');
    loc.discard();
    expect(loc.privacyPolicyUrl).toBe('https://x.test/p');
  });

  // ── Capability ──

  it('canUpdate is true when the update affordance is present', () => {
    const loc = make({ affordances: { update: '/api/v1/app-info-localizations/loc-1' } });
    expect(loc.canUpdate).toBe(true);
  });

  it('canUpdate is false when the update affordance is absent', () => {
    expect(make().canUpdate).toBe(false);
  });

  it('canDelete reflects the delete affordance', () => {
    expect(make().canDelete).toBe(false);
    const removable = make({ affordances: { delete: '/api/v1/app-info-localizations/loc-1' } });
    expect(removable.canDelete).toBe(true);
  });

  // ── Identity for unsaved (locally-added) locales ──

  it('accepts an empty id to represent a locally-added locale', () => {
    const loc = new AppInfoLocalization({ id: '', locale: 'fr-FR', name: 'Boulangerie', subtitle: null });
    expect(loc.id).toBe('');
    expect(loc.hasUnsavedChanges).toBe(false);
  });
});
