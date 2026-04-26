import type { InAppPurchase, InAppPurchaseType } from './InAppPurchase.ts';
import type { InAppPurchaseLocalization } from './InAppPurchaseLocalization.ts';

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
}
