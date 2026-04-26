import { makeAutoObservable } from 'mobx';
import type { Affordances } from '../../shared/types.ts';

export interface ReviewScreenshotInit {
  /** Backend resource id. */
  id: string;
  /** Filename as stored on the asset. */
  fileName: string;
  /** Resolvable URL for displaying the screenshot in the page. May be a
   *  signed CDN URL, a `data:` URI (mock mode), or `null` while the
   *  asset is still uploading. */
  previewUrl: string | null;
  affordances?: Affordances;
}

/**
 * Minimal review screenshot for the IAP Review tab. Mirrors the iOS
 * `ReviewScreenshot` resource at the field level Apple actually exposes
 * to a list/get caller. The richer upload-state machine
 * (`AWAITING_UPLOAD → UPLOAD_COMPLETE → APPROVED/REJECTED`) is not modeled
 * here yet — it lands when we wire real S3-style chunked uploads in a
 * later phase.
 */
export class ReviewScreenshot {
  readonly id: string;
  readonly fileName: string;
  previewUrl: string | null;
  affordances: Affordances;

  constructor(init: ReviewScreenshotInit) {
    this.id = init.id;
    this.fileName = init.fileName;
    this.previewUrl = init.previewUrl;
    this.affordances = init.affordances ?? {};

    makeAutoObservable(this, { id: false, fileName: false });
  }

  // ── Capability checks ──

  get canDelete(): boolean {
    return 'delete' in this.affordances || 'deleteScreenshot' in this.affordances;
  }

  get deleteUrl(): string | null {
    return this.affordances.delete ?? this.affordances.deleteScreenshot ?? null;
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): ReviewScreenshot {
    return new ReviewScreenshot({
      id: (json.id as string) ?? '',
      fileName: ((json.fileName as string) ?? (json.name as string)) ?? '',
      previewUrl:
        (json.previewUrl as string | null | undefined) ??
        (json.url as string | null | undefined) ??
        null,
      affordances: (json.affordances as Affordances | undefined) ?? {},
    });
  }
}
