import { describe, it, expect } from 'vitest';
import {
  territoryName,
  territoryFlag,
  formatTerritoryPrice,
} from '../../src/shared/territoryDirectory.ts';

describe('territoryDirectory', () => {
  describe('territoryName', () => {
    it('maps Apple ISO-3 codes to display names', () => {
      expect(territoryName('USA')).toBe('United States');
      expect(territoryName('JPN')).toBe('Japan');
      expect(territoryName('GBR')).toBe('United Kingdom');
      expect(territoryName('CHN')).toBe('China');
      expect(territoryName('AFG')).toBe('Afghanistan');
      expect(territoryName('ARE')).toBe('United Arab Emirates');
    });

    it('falls back to the raw code for unknown territories', () => {
      expect(territoryName('ZZZ')).toBe('ZZZ');
      expect(territoryName('')).toBe('');
    });
  });

  describe('territoryFlag', () => {
    it('returns a flag emoji for known territories', () => {
      expect(territoryFlag('USA')).toBe('🇺🇸');
      expect(territoryFlag('JPN')).toBe('🇯🇵');
      expect(territoryFlag('GBR')).toBe('🇬🇧');
    });

    it('returns an empty string for unknown territories', () => {
      expect(territoryFlag('ZZZ')).toBe('');
      expect(territoryFlag('')).toBe('');
    });
  });
});

describe('formatTerritoryPrice', () => {
  it('formats USD with the dollar symbol', () => {
    expect(formatTerritoryPrice('6.99', 'USD')).toBe('$6.99');
  });

  it('formats currencies that have no fractional units without decimals', () => {
    expect(formatTerritoryPrice('1100', 'JPY')).toBe('¥1,100');
    expect(formatTerritoryPrice('9900', 'KRW')).toBe('₩9,900');
  });

  it('uses ISO currency code as prefix when no symbol exists in the locale', () => {
    // AED has no commonly-rendered single-character symbol in en-US — Intl
    // returns it as "AED 24.99" or similar. Just assert the code is present
    // and the digits are preserved.
    const out = formatTerritoryPrice('24.99', 'AED');
    expect(out).toMatch(/AED/);
    expect(out).toMatch(/24\.99/);
  });

  it('returns the raw value when the price is not numeric', () => {
    expect(formatTerritoryPrice('', 'USD')).toBe('');
    expect(formatTerritoryPrice('not-a-number', 'USD')).toBe('not-a-number');
  });

  it('falls back to "<code> <amount>" when the currency code is malformed', () => {
    // Intl.NumberFormat accepts any 3-letter code, so the fallback only
    // triggers for codes the runtime rejects outright (empty / wrong length).
    expect(formatTerritoryPrice('100', '')).toBe(' 100');
  });
});
