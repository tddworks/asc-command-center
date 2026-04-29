import { makeAutoObservable } from 'mobx';
import type { Affordances } from '../../shared/types.ts';

export const SubscriptionImageState = {
  AwaitingUpload: 'AWAITING_UPLOAD',
  UploadComplete: 'UPLOAD_COMPLETE',
  Failed: 'FAILED',
  PrepareForSubmission: 'PREPARE_FOR_SUBMISSION',
  WaitingForReview: 'WAITING_FOR_REVIEW',
  Approved: 'APPROVED',
  Rejected: 'REJECTED',
} as const;
export type SubscriptionImageState =
  typeof SubscriptionImageState[keyof typeof SubscriptionImageState];

export interface SubscriptionImageInit {
  id: string;
  fileName: string;
  state: SubscriptionImageState | string;
  fileSize?: number;
  sourceFileChecksum?: string | null;
  templateUrl?: string | null;
  width?: number;
  height?: number;
  previewUrl?: string | null;
  affordances?: Affordances;
}

/**
 * SubscriptionImage — 1024×1024 promotional image for a subscription tier.
 * Apple allows one completed image per subscription; the parent aggregate
 * enforces that constraint.
 */
export class SubscriptionImage {
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

  constructor(init: SubscriptionImageInit) {
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

  get isApproved(): boolean { return this.state === SubscriptionImageState.Approved; }
  get isPendingReview(): boolean { return this.state === SubscriptionImageState.WaitingForReview; }
  get hasFailed(): boolean { return this.state === SubscriptionImageState.Failed; }

  get isCompleted(): boolean {
    return (
      this.state === SubscriptionImageState.UploadComplete ||
      this.state === SubscriptionImageState.PrepareForSubmission ||
      this.state === SubscriptionImageState.WaitingForReview ||
      this.state === SubscriptionImageState.Approved
    );
  }

  get canDelete(): boolean { return 'delete' in this.affordances; }
  get deleteUrl(): string | null { return this.affordances.delete ?? null; }

  get stateLabel(): string {
    switch (this.state) {
      case SubscriptionImageState.AwaitingUpload: return 'Awaiting Upload';
      case SubscriptionImageState.UploadComplete: return 'Uploaded';
      case SubscriptionImageState.Failed: return 'Failed';
      case SubscriptionImageState.PrepareForSubmission: return 'Ready';
      case SubscriptionImageState.WaitingForReview: return 'In Review';
      case SubscriptionImageState.Approved: return 'Approved';
      case SubscriptionImageState.Rejected: return 'Rejected';
      default: return this.state;
    }
  }

  get stateTone(): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
    switch (this.state) {
      case SubscriptionImageState.Approved: return 'success';
      case SubscriptionImageState.WaitingForReview: return 'info';
      case SubscriptionImageState.Failed:
      case SubscriptionImageState.Rejected: return 'danger';
      default: return 'neutral';
    }
  }

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

  static fromJSON(json: Record<string, unknown>): SubscriptionImage {
    const imageAsset = json.imageAsset as
      | { templateUrl?: string; width?: number; height?: number }
      | undefined;
    const rawState =
      (json.assetState as string | undefined) ??
      (json.state as string | undefined) ??
      SubscriptionImageState.AwaitingUpload;
    return new SubscriptionImage({
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
