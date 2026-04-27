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

  it('fromJSON hydrates the live imageAsset shape and resolves srcAt() URLs', () => {
    // Mirrors the live backend payload — the asset comes back as an
    // `imageAsset` with a `templateUrl` containing {w}/{h}/{f} placeholders.
    const shot = ReviewScreenshot.fromJSON({
      id: '11111111-2222-3333-4444-555555555555',
      fileName: 'SOURCE',
      assetState: 'COMPLETE',
      imageAsset: {
        height: 2868,
        width: 1320,
        templateUrl: 'https://is1-ssl.mzstatic.com/image/thumb/abc/{w}x{h}bb.{f}',
      },
    });
    // Display at 120 CSS pixels (2× retina → 240px). Aspect ratio preserved:
    // 240 × (2868/1320) ≈ 521 tall.
    expect(shot.srcAt(120)).toBe('https://is1-ssl.mzstatic.com/image/thumb/abc/240x521bb.jpg');
  });

  it('srcAt() falls back to previewUrl when no template is present (mock mode)', () => {
    const shot = ReviewScreenshot.fromJSON({
      id: 'shot-3',
      fileName: 'a.png',
      url: 'data:image/png;base64,abc',
    });
    expect(shot.srcAt(120)).toBe('data:image/png;base64,abc');
  });
});
