import { describe, it, expect } from 'vitest';
import {
  APP_CATEGORIES,
  categoryForId,
  categoryLabel,
} from '../../../src/app-catalog/app-info/AppCategoryRegistry.ts';

describe('AppCategoryRegistry', () => {

  // ── Completeness ──

  it('includes all 26 App Store categories', () => {
    expect(APP_CATEGORIES).toHaveLength(26);
  });

  it('includes the categories the backend actually uses (FINANCE, LIFESTYLE)', () => {
    const ids = APP_CATEGORIES.map((c) => c.apiId);
    expect(ids).toContain('FINANCE');
    expect(ids).toContain('LIFESTYLE');
    expect(ids).toContain('MAGAZINE_AND_NEWSPAPERS');
  });

  it('every entry has a non-empty label and api id', () => {
    for (const c of APP_CATEGORIES) {
      expect(c.apiId.length).toBeGreaterThan(0);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  it('api ids are unique', () => {
    const ids = APP_CATEGORIES.map((c) => c.apiId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // ── categoryForId ──

  it('categoryForId returns the matching entry for a known id', () => {
    const finance = categoryForId('FINANCE');
    expect(finance).not.toBeNull();
    expect(finance!.label).toBe('Finance');
  });

  it('categoryForId returns null for an unknown id', () => {
    expect(categoryForId('NOT_A_CATEGORY')).toBeNull();
  });

  it('categoryForId returns null for null / empty inputs', () => {
    expect(categoryForId(null)).toBeNull();
    expect(categoryForId(undefined)).toBeNull();
    expect(categoryForId('')).toBeNull();
  });

  // ── categoryLabel ──

  it('categoryLabel returns the human label for a known id', () => {
    expect(categoryLabel('HEALTH_AND_FITNESS')).toBe('Health & Fitness');
  });

  it('categoryLabel falls back to the id itself when unknown', () => {
    expect(categoryLabel('NOT_A_CATEGORY')).toBe('NOT_A_CATEGORY');
  });

  it('categoryLabel returns an empty string for null / empty inputs', () => {
    expect(categoryLabel(null)).toBe('');
    expect(categoryLabel(undefined)).toBe('');
    expect(categoryLabel('')).toBe('');
  });
});
