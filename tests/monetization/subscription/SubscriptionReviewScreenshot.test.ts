import { describe, it, expect } from 'vitest';
import { SubscriptionReviewScreenshot } from '../../../src/monetization/subscription/SubscriptionReviewScreenshot.ts';

describe('SubscriptionReviewScreenshot', () => {
  it('fromJSON hydrates the live imageAsset shape and resolves srcAt() URLs', () => {
    const shot = SubscriptionReviewScreenshot.fromJSON({
      id: 'shot-1',
      fileName: 'SOURCE',
      assetState: 'COMPLETE',
      imageAsset: {
        height: 2868,
        width: 1320,
        templateUrl: 'https://is1-ssl.mzstatic.com/image/thumb/abc/{w}x{h}bb.{f}',
      },
    });
    expect(shot.srcAt(120)).toBe('https://is1-ssl.mzstatic.com/image/thumb/abc/240x521bb.jpg');
  });

  it('srcAt() falls back to previewUrl when no template is present (mock mode)', () => {
    const shot = SubscriptionReviewScreenshot.fromJSON({
      id: 'shot-2',
      fileName: 'a.png',
      url: 'data:image/png;base64,abc',
    });
    expect(shot.srcAt(120)).toBe('data:image/png;base64,abc');
  });

  it('canDelete maps to delete affordance', () => {
    expect(new SubscriptionReviewScreenshot({ id: 's-1', fileName: 'a.png', previewUrl: null, affordances: { delete: '/x' } }).canDelete).toBe(true);
    expect(new SubscriptionReviewScreenshot({ id: 's-1', fileName: 'a.png', previewUrl: null, affordances: {} }).canDelete).toBe(false);
  });
});
