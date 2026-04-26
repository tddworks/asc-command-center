import { describe, it, expect } from 'vitest';
import { ReviewScreenshot } from '../../../src/monetization/iap/ReviewScreenshot.ts';

describe('ReviewScreenshot', () => {

  it('canDelete maps to short or long affordance keys', () => {
    expect(new ReviewScreenshot({ id: 's-1', fileName: 'a.png', previewUrl: null, affordances: { delete: '/x' } }).canDelete).toBe(true);
    expect(new ReviewScreenshot({ id: 's-1', fileName: 'a.png', previewUrl: null, affordances: { deleteScreenshot: '/x' } }).canDelete).toBe(true);
    expect(new ReviewScreenshot({ id: 's-1', fileName: 'a.png', previewUrl: null, affordances: {} }).canDelete).toBe(false);
  });

  it('deleteUrl returns the matching affordance', () => {
    expect(new ReviewScreenshot({ id: 's-1', fileName: 'a.png', previewUrl: null, affordances: { delete: '/x' } }).deleteUrl).toBe('/x');
    expect(new ReviewScreenshot({ id: 's-1', fileName: 'a.png', previewUrl: null, affordances: { deleteScreenshot: '/y' } }).deleteUrl).toBe('/y');
    expect(new ReviewScreenshot({ id: 's-1', fileName: 'a.png', previewUrl: null, affordances: {} }).deleteUrl).toBeNull();
  });

  it('fromJSON tolerates `name`/`url` aliases', () => {
    const shot = ReviewScreenshot.fromJSON({
      id: 'shot-1',
      name: 'screenshot.png',
      url: 'https://cdn/example.png',
    });
    expect(shot.id).toBe('shot-1');
    expect(shot.fileName).toBe('screenshot.png');
    expect(shot.previewUrl).toBe('https://cdn/example.png');
  });

  it('fromJSON falls back to nulls when fields are missing', () => {
    const shot = ReviewScreenshot.fromJSON({ id: 'shot-2' });
    expect(shot.fileName).toBe('');
    expect(shot.previewUrl).toBeNull();
  });
});
