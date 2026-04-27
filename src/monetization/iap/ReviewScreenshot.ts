import { makeAutoObservable } from 'mobx';
import type { Affordances } from '../../shared/types.ts';

export interface ReviewScreenshotInit {
  /** Backend resource id. */
  id: string;
  /** Filename as stored on the asset. */
  fileName: string;
  /** Apple ImageAsset template — `{w}/{h}/{f}` placeholders, expanded by
   *  `srcAt(displayWidth)` to a concrete CDN URL. */
  templateUrl?: string | null;
  /** Source asset pixel dimensions, used to preserve aspect ratio when
   *  expanding the template. */
  width?: number;
  height?: number;
  /** Pre-resolved URL fallback used in mock mode (e.g. a `data:` URI from
   *  FileReader). When set, `srcAt()` returns this verbatim. */
  previewUrl?: string | null;
  affordances?: Affordances;
}

/**
 * Minimal review screenshot for the IAP Review tab. Mirrors the iOS
 * `InAppPurchaseReviewScreenshot` resource — Apple returns the asset as an
 * `imageAsset { templateUrl, width, height }` triple; the UI calls
 * `srcAt(displayWidth)` to get a concrete URL at the right size.
 */
export class ReviewScreenshot {
  readonly id: string;
  readonly fileName: string;
  readonly templateUrl: string | null;
  readonly width: number;
  readonly height: number;
  readonly previewUrl: string | null;
  affordances: Affordances;

  constructor(init: ReviewScreenshotInit) {
    this.id = init.id;
    this.fileName = init.fileName;
    this.templateUrl = init.templateUrl ?? null;
    this.width = init.width ?? 0;
    this.height = init.height ?? 0;
    this.previewUrl = init.previewUrl ?? null;
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

  // ── Display ──

  /** Resolve a concrete image URL at the requested display size (CSS px).
   *  Returns the pre-resolved `previewUrl` when no template is present
   *  (mock mode supplies a data URI directly). */
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

  static fromJSON(json: Record<string, unknown>): ReviewScreenshot {
    const imageAsset = json.imageAsset as
      | { templateUrl?: string; width?: number; height?: number }
      | undefined;
    return new ReviewScreenshot({
      id: (json.id as string) ?? '',
      fileName: ((json.fileName as string) ?? (json.name as string)) ?? '',
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
