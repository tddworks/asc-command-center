import type { InAppPurchase, InAppPurchaseType } from './InAppPurchase.ts';
import type { InAppPurchaseLocalization } from './InAppPurchaseLocalization.ts';
import type { IAPPriceSchedule } from './IAPPriceSchedule.ts';
import type { ReviewScreenshot } from './ReviewScreenshot.ts';

export interface CreateInAppPurchaseInput {
  appId: string;
  referenceName: string;
  productId: string;
  inAppPurchaseType: InAppPurchaseType | string;
}

export interface CreateInAppPurchaseLocalizationInput {
  locale: string;
  name: string;
  description?: string | null;
}

/**
 * Port for the IAP slice. Methods are named in domain terms (`submit`,
 * `unsubmit`, `update`) so REST and Mock implementations stay 1:1 with
 * the affordances exposed by the asc backend.
 */
export interface InAppPurchaseRepository {
  list(appId: string): Promise<InAppPurchase[]>;
  get(id: string): Promise<InAppPurchase>;
  create(input: CreateInAppPurchaseInput): Promise<InAppPurchase>;
  update(iap: InAppPurchase, patch: { referenceName?: string; reviewNote?: string | null }): Promise<void>;
  remove(iap: InAppPurchase): Promise<void>;
  submit(iap: InAppPurchase): Promise<void>;
  unsubmit(iap: InAppPurchase): Promise<void>;

  // ── Localizations ──
  localizations(iap: InAppPurchase): Promise<InAppPurchaseLocalization[]>;
  createLocalization(iap: InAppPurchase, input: CreateInAppPurchaseLocalizationInput): Promise<InAppPurchaseLocalization>;
  saveLocalization(loc: InAppPurchaseLocalization): Promise<void>;
  deleteLocalization(loc: InAppPurchaseLocalization): Promise<void>;

  // ── Pricing ──
  /** Returns null when the IAP has no price schedule yet (newly created). */
  priceSchedule(iap: InAppPurchase): Promise<IAPPriceSchedule | null>;

  // ── Review screenshot ──
  /** Returns null when the IAP has no review screenshot uploaded yet. */
  reviewScreenshot(iap: InAppPurchase): Promise<ReviewScreenshot | null>;
  uploadReviewScreenshot(iap: InAppPurchase, file: File): Promise<ReviewScreenshot>;
  deleteReviewScreenshot(iap: InAppPurchase, screenshot: ReviewScreenshot): Promise<void>;
}
