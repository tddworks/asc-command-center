import { makeAutoObservable } from 'mobx';
import type { Affordances } from '../../shared/types.ts';

export interface SubscriptionReviewScreenshotInit {
  id: string;
  fileName: string;
  /** Apple ImageAsset template — `{w}/{h}/{f}` placeholders. */
  templateUrl?: string | null;
  width?: number;
  height?: number;
  /** Mock-mode pre-resolved URL fallback (data URI from FileReader). */
  previewUrl?: string | null;
  affordances?: Affordances;
}

/**
 * Minimal review screenshot for the Subscription Review tab. Mirrors
 * `ReviewScreenshot` (IAP slice) — same shape because Apple's resource
 * is the same. Lives in the subscription slice because it routes through
 * the SubscriptionRepository port.
 */
export class SubscriptionReviewScreenshot {
  readonly id: string;
  readonly fileName: string;
  readonly templateUrl: string | null;
  readonly width: number;
  readonly height: number;
  readonly previewUrl: string | null;
  affordances: Affordances;

  constructor(init: SubscriptionReviewScreenshotInit) {
    this.id = init.id;
    this.fileName = init.fileName;
    this.templateUrl = init.templateUrl ?? null;
    this.width = init.width ?? 0;
    this.height = init.height ?? 0;
    this.previewUrl = init.previewUrl ?? null;
    this.affordances = init.affordances ?? {};

    makeAutoObservable(this, { id: false, fileName: false });
  }

  get canDelete(): boolean {
    return 'delete' in this.affordances || 'deleteScreenshot' in this.affordances;
  }

  get deleteUrl(): string | null {
    return this.affordances.delete ?? this.affordances.deleteScreenshot ?? null;
  }

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

  static fromJSON(json: Record<string, unknown>): SubscriptionReviewScreenshot {
    const imageAsset = json.imageAsset as
      | { templateUrl?: string; width?: number; height?: number }
      | undefined;
    return new SubscriptionReviewScreenshot({
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
