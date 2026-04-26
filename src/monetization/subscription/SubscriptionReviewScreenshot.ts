import { makeAutoObservable } from 'mobx';
import type { Affordances } from '../../shared/types.ts';

export interface SubscriptionReviewScreenshotInit {
  id: string;
  fileName: string;
  previewUrl: string | null;
  affordances?: Affordances;
}

/**
 * Minimal review screenshot for the Subscription Review tab. Mirrors
 * `ReviewScreenshot` (IAP slice) — same shape because Apple's resource
 * is the same. Lives in the subscription slice because it routes through
 * the SubscriptionRepository port. The richer upload-state machine ships
 * when chunked uploads land.
 */
export class SubscriptionReviewScreenshot {
  readonly id: string;
  readonly fileName: string;
  previewUrl: string | null;
  affordances: Affordances;

  constructor(init: SubscriptionReviewScreenshotInit) {
    this.id = init.id;
    this.fileName = init.fileName;
    this.previewUrl = init.previewUrl;
    this.affordances = init.affordances ?? {};

    makeAutoObservable(this, { id: false, fileName: false });
  }

  get canDelete(): boolean {
    return 'delete' in this.affordances || 'deleteScreenshot' in this.affordances;
  }

  get deleteUrl(): string | null {
    return this.affordances.delete ?? this.affordances.deleteScreenshot ?? null;
  }

  static fromJSON(json: Record<string, unknown>): SubscriptionReviewScreenshot {
    return new SubscriptionReviewScreenshot({
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
