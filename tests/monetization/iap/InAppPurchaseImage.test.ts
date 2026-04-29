import { describe, it, expect } from 'vitest';
import {
  InAppPurchaseImage,
  InAppPurchaseImageState,
} from '../../../src/monetization/iap/InAppPurchaseImage.ts';

describe('InAppPurchaseImage', () => {

  // ── Semantic Booleans ──

  it('isApproved is true only when state is APPROVED', () => {
    expect(new InAppPurchaseImage({ id: 'img-1', fileName: 'a.png', state: InAppPurchaseImageState.Approved }).isApproved).toBe(true);
    expect(new InAppPurchaseImage({ id: 'img-1', fileName: 'a.png', state: InAppPurchaseImageState.WaitingForReview }).isApproved).toBe(false);
  });

  it('isPendingReview is true only when state is WAITING_FOR_REVIEW', () => {
    expect(new InAppPurchaseImage({ id: 'img-1', fileName: 'a.png', state: InAppPurchaseImageState.WaitingForReview }).isPendingReview).toBe(true);
    expect(new InAppPurchaseImage({ id: 'img-1', fileName: 'a.png', state: InAppPurchaseImageState.Approved }).isPendingReview).toBe(false);
  });

  it('isCompleted covers UPLOAD_COMPLETE / PREPARE_FOR_SUBMISSION / WAITING_FOR_REVIEW / APPROVED', () => {
    // Mirrors the Swift card's "image has finished uploading" gate — anything
    // other than "still awaiting upload" / "failed" counts.
    for (const s of [
      InAppPurchaseImageState.UploadComplete,
      InAppPurchaseImageState.PrepareForSubmission,
      InAppPurchaseImageState.WaitingForReview,
      InAppPurchaseImageState.Approved,
    ]) {
      expect(new InAppPurchaseImage({ id: 'i', fileName: 'a.png', state: s }).isCompleted).toBe(true);
    }
    expect(new InAppPurchaseImage({ id: 'i', fileName: 'a.png', state: InAppPurchaseImageState.AwaitingUpload }).isCompleted).toBe(false);
    expect(new InAppPurchaseImage({ id: 'i', fileName: 'a.png', state: InAppPurchaseImageState.Failed }).isCompleted).toBe(false);
  });

  it('hasFailed is true only when state is FAILED', () => {
    expect(new InAppPurchaseImage({ id: 'i', fileName: 'a.png', state: InAppPurchaseImageState.Failed }).hasFailed).toBe(true);
    expect(new InAppPurchaseImage({ id: 'i', fileName: 'a.png', state: InAppPurchaseImageState.Approved }).hasFailed).toBe(false);
  });

  // ── Capability checks ──

  it('canDelete maps to delete affordance presence', () => {
    expect(new InAppPurchaseImage({ id: 'i', fileName: 'a.png', state: InAppPurchaseImageState.Approved, affordances: { delete: '/x' } }).canDelete).toBe(true);
    expect(new InAppPurchaseImage({ id: 'i', fileName: 'a.png', state: InAppPurchaseImageState.Approved, affordances: {} }).canDelete).toBe(false);
  });

  // ── Display ──

  it('stateLabel maps each state to a user-facing label', () => {
    const cases: Array<[string, string]> = [
      [InAppPurchaseImageState.AwaitingUpload, 'Awaiting Upload'],
      [InAppPurchaseImageState.UploadComplete, 'Uploaded'],
      [InAppPurchaseImageState.Failed, 'Failed'],
      [InAppPurchaseImageState.PrepareForSubmission, 'Ready'],
      [InAppPurchaseImageState.WaitingForReview, 'In Review'],
      [InAppPurchaseImageState.Approved, 'Approved'],
      [InAppPurchaseImageState.Rejected, 'Rejected'],
    ];
    for (const [state, label] of cases) {
      expect(new InAppPurchaseImage({ id: 'i', fileName: 'a.png', state }).stateLabel).toBe(label);
    }
  });

  it('stateTone maps APPROVED→success, WAITING_FOR_REVIEW→info, FAILED/REJECTED→danger, others→neutral', () => {
    const tone = (s: string) =>
      new InAppPurchaseImage({ id: 'i', fileName: 'a.png', state: s }).stateTone;
    expect(tone(InAppPurchaseImageState.Approved)).toBe('success');
    expect(tone(InAppPurchaseImageState.WaitingForReview)).toBe('info');
    expect(tone(InAppPurchaseImageState.Failed)).toBe('danger');
    expect(tone(InAppPurchaseImageState.Rejected)).toBe('danger');
    expect(tone(InAppPurchaseImageState.AwaitingUpload)).toBe('neutral');
    expect(tone(InAppPurchaseImageState.UploadComplete)).toBe('neutral');
  });

  it('srcAt expands the imageAsset templateUrl preserving aspect ratio', () => {
    // Same template-resolution rules as ReviewScreenshot — square 1024x1024
    // Apple-served promo images expand to 2× retina width.
    const img = new InAppPurchaseImage({
      id: 'i',
      fileName: 'promo.png',
      state: InAppPurchaseImageState.Approved,
      templateUrl: 'https://is1-ssl.mzstatic.com/image/thumb/abc/{w}x{h}bb.{f}',
      width: 1024,
      height: 1024,
    });
    expect(img.srcAt(120)).toBe('https://is1-ssl.mzstatic.com/image/thumb/abc/240x240bb.jpg');
  });

  it('srcAt falls back to previewUrl when template missing (mock mode)', () => {
    const img = new InAppPurchaseImage({
      id: 'i',
      fileName: 'promo.png',
      state: InAppPurchaseImageState.UploadComplete,
      previewUrl: 'data:image/jpeg;base64,abc',
    });
    expect(img.srcAt(120)).toBe('data:image/jpeg;base64,abc');
  });

  // ── Factory ──

  it('fromJSON hydrates the live backend shape', () => {
    const img = InAppPurchaseImage.fromJSON({
      id: 'img-9',
      fileName: 'promo.png',
      fileSize: 12345,
      sourceFileChecksum: 'abc123',
      assetState: 'APPROVED',
      imageAsset: {
        templateUrl: 'https://cdn/x/{w}x{h}.{f}',
        width: 1024,
        height: 1024,
      },
      affordances: { delete: '/api/v1/iap-images/img-9' },
    });

    expect(img.id).toBe('img-9');
    expect(img.fileName).toBe('promo.png');
    expect(img.fileSize).toBe(12345);
    expect(img.state).toBe(InAppPurchaseImageState.Approved);
    expect(img.isApproved).toBe(true);
    expect(img.canDelete).toBe(true);
    expect(img.srcAt(100)).toBe('https://cdn/x/200x200.jpg');
  });

  it('fromJSON tolerates `state` as alias for `assetState`', () => {
    const img = InAppPurchaseImage.fromJSON({
      id: 'img-1',
      fileName: 'a.png',
      state: 'WAITING_FOR_REVIEW',
    });
    expect(img.state).toBe(InAppPurchaseImageState.WaitingForReview);
    expect(img.isPendingReview).toBe(true);
  });

  it('fromJSON falls back to AWAITING_UPLOAD when state is missing', () => {
    const img = InAppPurchaseImage.fromJSON({ id: 'img-1', fileName: 'a.png' });
    expect(img.state).toBe(InAppPurchaseImageState.AwaitingUpload);
  });
});
