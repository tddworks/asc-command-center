import { makeAutoObservable } from 'mobx';
import type { Affordances } from '../../shared/types.ts';

export const InAppPurchaseImageState = {
  AwaitingUpload: 'AWAITING_UPLOAD',
  UploadComplete: 'UPLOAD_COMPLETE',
  Failed: 'FAILED',
  PrepareForSubmission: 'PREPARE_FOR_SUBMISSION',
  WaitingForReview: 'WAITING_FOR_REVIEW',
  Approved: 'APPROVED',
  Rejected: 'REJECTED',
} as const;
export type InAppPurchaseImageState =
  typeof InAppPurchaseImageState[keyof typeof InAppPurchaseImageState];

export interface InAppPurchaseImageInit {
  id: string;
  fileName: string;
  state: InAppPurchaseImageState | string;
  fileSize?: number;
  sourceFileChecksum?: string | null;
  templateUrl?: string | null;
  width?: number;
  height?: number;
  previewUrl?: string | null;
  affordances?: Affordances;
}

/**
 * InAppPurchaseImage — 1024×1024 promotional image attached to an IAP.
 * Mirrors the Swift SDK's `InAppPurchaseImage`. Apple allows one completed
 * image per IAP; the parent aggregate enforces that constraint via
 * `hasExistingImage`. State machine maps to the Apple `assetState` enum.
 */
export class InAppPurchaseImage {
  readonly id: string;
  readonly fileName: string;
  readonly fileSize: number;
  readonly sourceFileChecksum: string | null;
  state: string;
  readonly templateUrl: string | null;
  readonly width: number;
  readonly height: number;
  readonly previewUrl: string | null;
  affordances: Affordances;

  constructor(init: InAppPurchaseImageInit) {
    this.id = init.id;
    this.fileName = init.fileName;
    this.fileSize = init.fileSize ?? 0;
    this.sourceFileChecksum = init.sourceFileChecksum ?? null;
    this.state = init.state;
    this.templateUrl = init.templateUrl ?? null;
    this.width = init.width ?? 0;
    this.height = init.height ?? 0;
    this.previewUrl = init.previewUrl ?? null;
    this.affordances = init.affordances ?? {};

    makeAutoObservable(this, { id: false, fileName: false, fileSize: false });
  }

  // ── Semantic Booleans ──

  get isApproved(): boolean { return this.state === InAppPurchaseImageState.Approved; }
  get isPendingReview(): boolean { return this.state === InAppPurchaseImageState.WaitingForReview; }
  get hasFailed(): boolean { return this.state === InAppPurchaseImageState.Failed; }

  /** True once the image has finished uploading — anything past
   *  AWAITING_UPLOAD/FAILED. The "Apple allows only one promotional image"
   *  constraint counts only completed images. */
  get isCompleted(): boolean {
    return (
      this.state === InAppPurchaseImageState.UploadComplete ||
      this.state === InAppPurchaseImageState.PrepareForSubmission ||
      this.state === InAppPurchaseImageState.WaitingForReview ||
      this.state === InAppPurchaseImageState.Approved
    );
  }

  // ── Capability checks ──

  get canDelete(): boolean { return 'delete' in this.affordances; }
  get deleteUrl(): string | null { return this.affordances.delete ?? null; }

  // ── Display ──

  get stateLabel(): string {
    switch (this.state) {
      case InAppPurchaseImageState.AwaitingUpload: return 'Awaiting Upload';
      case InAppPurchaseImageState.UploadComplete: return 'Uploaded';
      case InAppPurchaseImageState.Failed: return 'Failed';
      case InAppPurchaseImageState.PrepareForSubmission: return 'Ready';
      case InAppPurchaseImageState.WaitingForReview: return 'In Review';
      case InAppPurchaseImageState.Approved: return 'Approved';
      case InAppPurchaseImageState.Rejected: return 'Rejected';
      default: return this.state;
    }
  }

  get stateTone(): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
    switch (this.state) {
      case InAppPurchaseImageState.Approved: return 'success';
      case InAppPurchaseImageState.WaitingForReview: return 'info';
      case InAppPurchaseImageState.Failed:
      case InAppPurchaseImageState.Rejected: return 'danger';
      default: return 'neutral';
    }
  }

  /** Resolve a concrete CDN URL at the requested CSS pixel width.
   *  Same expansion rules as ReviewScreenshot — falls back to previewUrl
   *  for mock-mode data URIs. */
  srcAt(displayWidth: number): string | null {
    if (this.templateUrl && this.width > 0 && this.height > 0) {
      const w = Math.round(displayWidth * 2);
      const h = Math.round((this.height / this.width) * w);
      return this.templateUrl
        .replace(/\{w\}/g, String(w))
        .replace(/\{h\}/g, String(h))
        .replace(/\{f\}/g, 'jpg');
    }
    return this.previewUrl;
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): InAppPurchaseImage {
    const imageAsset = json.imageAsset as
      | { templateUrl?: string; width?: number; height?: number }
      | undefined;
    const rawState =
      (json.assetState as string | undefined) ??
      (json.state as string | undefined) ??
      InAppPurchaseImageState.AwaitingUpload;
    return new InAppPurchaseImage({
      id: (json.id as string) ?? '',
      fileName: ((json.fileName as string) ?? (json.name as string)) ?? '',
      fileSize: (json.fileSize as number | undefined) ?? 0,
      sourceFileChecksum: (json.sourceFileChecksum as string | null | undefined) ?? null,
      state: rawState,
      templateUrl: imageAsset?.templateUrl ?? null,
      width: imageAsset?.width ?? 0,
      height: imageAsset?.height ?? 0,
      previewUrl:
        (json.previewUrl as string | null | undefined) ??
        (json.url as string | null | undefined) ??
        null,
      affordances: (json.affordances as Affordances | undefined) ?? {},
    });
  }
}
