import type { InAppPurchase, InAppPurchaseType } from './InAppPurchase.ts';

export interface CreateInAppPurchaseInput {
  appId: string;
  referenceName: string;
  productId: string;
  inAppPurchaseType: InAppPurchaseType | string;
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
}
