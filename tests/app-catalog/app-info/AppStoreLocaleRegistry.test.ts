import { describe, it, expect } from 'vitest';
import {
  APP_STORE_LOCALES,
  localeForCode,
  localeDisplayName,
} from '../../../src/app-catalog/app-info/AppStoreLocaleRegistry.ts';

describe('AppStoreLocaleRegistry', () => {

  // ── Completeness ──

  it('includes all 39 App Store locales (matches the iOS canonical list)', () => {
    expect(APP_STORE_LOCALES).toHaveLength(39);
  });

  it('includes the locales we know the backend uses (en-US, zh-Hans, ja)', () => {
    const codes = APP_STORE_LOCALES.map((l) => l.code);
    expect(codes).toContain('en-US');
    expect(codes).toContain('zh-Hans');
    expect(codes).toContain('zh-Hant');
    expect(codes).toContain('ja');
    expect(codes).toContain('fr-FR');
  });

  it('every entry has a non-empty code and display name', () => {
    for (const l of APP_STORE_LOCALES) {
      expect(l.code.length).toBeGreaterThan(0);
      expect(l.displayName.length).toBeGreaterThan(0);
    }
  });

  it('codes are unique', () => {
    const codes = APP_STORE_LOCALES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  // ── localeForCode ──

  it('localeForCode returns the matching entry for a known code', () => {
    const ja = localeForCode('ja');
    expect(ja).not.toBeNull();
    expect(ja!.displayName).toBe('Japanese');
  });

  it('localeForCode returns null for an unknown code', () => {
    expect(localeForCode('xx-YY')).toBeNull();
  });

  it('localeForCode returns null for null / empty inputs', () => {
    expect(localeForCode(null)).toBeNull();
    expect(localeForCode(undefined)).toBeNull();
    expect(localeForCode('')).toBeNull();
  });

  // ── localeDisplayName ──

  it('localeDisplayName returns the human label for a known code', () => {
    expect(localeDisplayName('zh-Hans')).toBe('Chinese (Simplified)');
  });

  it('localeDisplayName falls back to the code itself when unknown', () => {
    expect(localeDisplayName('xx-YY')).toBe('xx-YY');
  });

  it('localeDisplayName returns an empty string for null / empty inputs', () => {
    expect(localeDisplayName(null)).toBe('');
    expect(localeDisplayName(undefined)).toBe('');
    expect(localeDisplayName('')).toBe('');
  });
});