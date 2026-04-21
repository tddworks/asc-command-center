import { describe, it, expect } from 'vitest';
import { VersionLocalization } from '../../../src/release/version/VersionLocalization.ts';

function make(overrides: Partial<ConstructorParameters<typeof VersionLocalization>[0]> = {}) {
  return new VersionLocalization({
    id: 'loc-1',
    locale: 'en-US',
    description: 'Track subscriptions fast.',
    keywords: 'subs,tracker',
    whatsNew: 'Initial release.',
    promotionalText: 'Try us free.',
    supportUrl: 'https://example.com/support',
    marketingUrl: 'https://example.com',
    ...overrides,
  });
}

describe('VersionLocalization', () => {

  // ── Construction ──

  it('exposes identity and loaded fields', () => {
    const loc = make();
    expect(loc.id).toBe('loc-1');
    expect(loc.locale).toBe('en-US');
    expect(loc.description).toBe('Track subscriptions fast.');
    expect(loc.keywords).toBe('subs,tracker');
    expect(loc.whatsNew).toBe('Initial release.');
    expect(loc.promotionalText).toBe('Try us free.');
    expect(loc.supportUrl).toBe('https://example.com/support');
    expect(loc.marketingUrl).toBe('https://example.com');
  });

  it('reports not dirty immediately after construction', () => {
    expect(make().hasUnsavedChanges).toBe(false);
  });

  it('accepts an empty id for locally-added locales', () => {
    const loc = make({ id: '' });
    expect(loc.id).toBe('');
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  // ── Setters + dirty ──

  it('setDescription flips dirty', () => {
    const loc = make();
    loc.setDescription('new');
    expect(loc.description).toBe('new');
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setKeywords flips dirty', () => {
    const loc = make();
    loc.setKeywords('a,b,c');
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setWhatsNew flips dirty', () => {
    const loc = make();
    loc.setWhatsNew('new');
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setPromotionalText flips dirty', () => {
    const loc = make();
    loc.setPromotionalText('promo');
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setSupportUrl accepts null to clear', () => {
    const loc = make();
    loc.setSupportUrl(null);
    expect(loc.supportUrl).toBeNull();
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setMarketingUrl accepts null to clear', () => {
    const loc = make();
    loc.setMarketingUrl(null);
    expect(loc.marketingUrl).toBeNull();
    expect(loc.hasUnsavedChanges).toBe(true);
  });

  it('setting a field to its current value does not flip dirty', () => {
    const loc = make();
    loc.setDescription('Track subscriptions fast.');
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  // ── discard ──

  it('discard restores every field to the snapshot', () => {
    const loc = make();
    loc.setDescription('edited');
    loc.setKeywords('edited');
    loc.setWhatsNew('edited');
    loc.setPromotionalText('edited');
    loc.setSupportUrl(null);
    loc.setMarketingUrl(null);

    loc.discard();

    expect(loc.description).toBe('Track subscriptions fast.');
    expect(loc.keywords).toBe('subs,tracker');
    expect(loc.whatsNew).toBe('Initial release.');
    expect(loc.promotionalText).toBe('Try us free.');
    expect(loc.supportUrl).toBe('https://example.com/support');
    expect(loc.marketingUrl).toBe('https://example.com');
    expect(loc.hasUnsavedChanges).toBe(false);
  });

  // ── markSaved ──

  it('markSaved promotes current values to the snapshot', () => {
    const loc = make();
    loc.setDescription('new');
    loc.markSaved();

    expect(loc.hasUnsavedChanges).toBe(false);

    // Discard now restores to the new baseline, not the original.
    loc.setDescription('later edit');
    loc.discard();
    expect(loc.description).toBe('new');
  });

  it('markSaved with assigned id backfills the backend id', () => {
    const loc = make({ id: '' });
    loc.setDescription('typed');
    loc.markSaved('vloc-42');
    expect(loc.id).toBe('vloc-42');
    expect(loc.hasUnsavedChanges).toBe(false);
  });
});
