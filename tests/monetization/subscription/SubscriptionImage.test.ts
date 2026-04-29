import { describe, it, expect } from 'vitest';
import {
  SubscriptionImage,
  SubscriptionImageState,
} from '../../../src/monetization/subscription/SubscriptionImage.ts';

describe('SubscriptionImage', () => {

  it('isApproved is true only when state is APPROVED', () => {
    expect(new SubscriptionImage({ id: 'i', fileName: 'a.png', state: SubscriptionImageState.Approved }).isApproved).toBe(true);
    expect(new SubscriptionImage({ id: 'i', fileName: 'a.png', state: SubscriptionImageState.WaitingForReview }).isApproved).toBe(false);
  });

  it('isPendingReview is true only when state is WAITING_FOR_REVIEW', () => {
    expect(new SubscriptionImage({ id: 'i', fileName: 'a.png', state: SubscriptionImageState.WaitingForReview }).isPendingReview).toBe(true);
    expect(new SubscriptionImage({ id: 'i', fileName: 'a.png', state: SubscriptionImageState.Approved }).isPendingReview).toBe(false);
  });

  it('isCompleted covers UPLOAD_COMPLETE / PREPARE_FOR_SUBMISSION / WAITING_FOR_REVIEW / APPROVED', () => {
    for (const s of [
      SubscriptionImageState.UploadComplete,
      SubscriptionImageState.PrepareForSubmission,
      SubscriptionImageState.WaitingForReview,
      SubscriptionImageState.Approved,
    ]) {
      expect(new SubscriptionImage({ id: 'i', fileName: 'a.png', state: s }).isCompleted).toBe(true);
    }
    expect(new SubscriptionImage({ id: 'i', fileName: 'a.png', state: SubscriptionImageState.AwaitingUpload }).isCompleted).toBe(false);
    expect(new SubscriptionImage({ id: 'i', fileName: 'a.png', state: SubscriptionImageState.Failed }).isCompleted).toBe(false);
  });

  it('canDelete maps to delete affordance presence', () => {
    expect(new SubscriptionImage({ id: 'i', fileName: 'a.png', state: SubscriptionImageState.Approved, affordances: { delete: '/x' } }).canDelete).toBe(true);
    expect(new SubscriptionImage({ id: 'i', fileName: 'a.png', state: SubscriptionImageState.Approved, affordances: {} }).canDelete).toBe(false);
  });

  it('stateLabel and stateTone follow the same mapping as IAP images', () => {
    const img = (s: string) => new SubscriptionImage({ id: 'i', fileName: 'a.png', state: s });
    expect(img(SubscriptionImageState.Approved).stateLabel).toBe('Approved');
    expect(img(SubscriptionImageState.Approved).stateTone).toBe('success');
    expect(img(SubscriptionImageState.WaitingForReview).stateTone).toBe('info');
    expect(img(SubscriptionImageState.Failed).stateTone).toBe('danger');
    expect(img(SubscriptionImageState.Rejected).stateTone).toBe('danger');
  });

  it('srcAt expands the imageAsset templateUrl', () => {
    const img = new SubscriptionImage({
      id: 'i',
      fileName: 'promo.png',
      state: SubscriptionImageState.Approved,
      templateUrl: 'https://cdn/x/{w}x{h}.{f}',
      width: 1024,
      height: 1024,
    });
    expect(img.srcAt(120)).toBe('https://cdn/x/240x240.jpg');
  });

  it('fromJSON hydrates the live backend shape', () => {
    const img = SubscriptionImage.fromJSON({
      id: 'img-9',
      fileName: 'promo.png',
      assetState: 'APPROVED',
      imageAsset: { templateUrl: 'https://cdn/x/{w}x{h}.{f}', width: 1024, height: 1024 },
      affordances: { delete: '/api/v1/subscription-images/img-9' },
    });
    expect(img.state).toBe(SubscriptionImageState.Approved);
    expect(img.canDelete).toBe(true);
  });

  it('fromJSON falls back to AWAITING_UPLOAD when state is missing', () => {
    const img = SubscriptionImage.fromJSON({ id: 'i', fileName: 'a.png' });
    expect(img.state).toBe(SubscriptionImageState.AwaitingUpload);
  });
});
