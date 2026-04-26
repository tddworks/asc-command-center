import { InAppPurchase, InAppPurchaseState, InAppPurchaseType } from '../InAppPurchase.ts';
import type { CreateInAppPurchaseInput, InAppPurchaseRepository } from '../InAppPurchaseRepository.ts';

/**
 * Deterministic in-memory IAP repository. Mutations persist on `this`
 * across calls so the page reflects every action without re-fetching.
 * Affordances are HATEOAS hrefs to keep mock and REST behaviourally
 * identical for the domain.
 */
export class MockInAppPurchaseRepository implements InAppPurchaseRepository {
  private byApp = new Map<string, InAppPurchase[]>();

  async list(appId: string): Promise<InAppPurchase[]> {
    if (!this.byApp.has(appId)) {
      this.byApp.set(appId, this.seed(appId));
    }
    return [...this.byApp.get(appId)!];
  }

  async get(id: string): Promise<InAppPurchase> {
    for (const list of this.byApp.values()) {
      const found = list.find((p) => p.id === id);
      if (found) return found;
    }
    throw new Error(`IAP ${id} not found`);
  }

  async create(input: CreateInAppPurchaseInput): Promise<InAppPurchase> {
    if (!this.byApp.has(input.appId)) {
      this.byApp.set(input.appId, this.seed(input.appId));
    }
    const list = this.byApp.get(input.appId)!;
    const id = `iap-mock-${Date.now()}`;
    const created = new InAppPurchase(
      {
        id,
        appId: input.appId,
        referenceName: input.referenceName,
        productId: input.productId,
        inAppPurchaseType: input.inAppPurchaseType,
        state: InAppPurchaseState.MissingMetadata,
        affordances: this.affordancesFor(id),
      },
      this,
    );
    list.push(created);
    return created;
  }

  async update(
    iap: InAppPurchase,
    patch: { referenceName?: string; reviewNote?: string | null },
  ): Promise<void> {
    void patch;
    void iap;
    // Domain mutates `this` after the awaited call returns.
  }

  async remove(iap: InAppPurchase): Promise<void> {
    const list = this.byApp.get(iap.appId);
    if (!list) return;
    this.byApp.set(iap.appId, list.filter((p) => p.id !== iap.id));
  }

  async submit(iap: InAppPurchase): Promise<void> {
    void iap;
  }

  async unsubmit(iap: InAppPurchase): Promise<void> {
    void iap;
  }

  private affordancesFor(id: string): Record<string, string> {
    return {
      get: `/api/v1/iap/${id}`,
      update: `/api/v1/iap/${id}`,
      delete: `/api/v1/iap/${id}`,
      submit: `/api/v1/iap/${id}/submit`,
      unsubmit: `/api/v1/iap/${id}/submit`,
      listLocalizations: `/api/v1/iap/${id}/localizations`,
      getPriceSchedule: `/api/v1/iap/${id}/price-schedule`,
      getAvailability: `/api/v1/iap/${id}/availability`,
      listOfferCodes: `/api/v1/iap/${id}/offer-codes`,
    };
  }

  private seed(appId: string): InAppPurchase[] {
    const mk = (
      id: string,
      referenceName: string,
      productId: string,
      type: string,
      state: string,
      extra: { hasSubmission?: boolean; reviewNote?: string | null } = {},
    ): InAppPurchase =>
      new InAppPurchase(
        {
          id,
          appId,
          referenceName,
          productId,
          inAppPurchaseType: type,
          state,
          reviewNote: extra.reviewNote ?? null,
          hasSubmission: extra.hasSubmission ?? false,
          affordances: this.affordancesFor(id),
        },
        this,
      );

    return [
      mk('iap-1', 'Premium Upgrade', 'com.example.premium', InAppPurchaseType.NonConsumable, InAppPurchaseState.Approved),
      mk('iap-2', '100 Coins', 'com.example.coins100', InAppPurchaseType.Consumable, InAppPurchaseState.Approved),
      mk('iap-3', 'Special Offer', 'com.example.special', InAppPurchaseType.NonConsumable, InAppPurchaseState.WaitingForReview, { hasSubmission: true }),
      mk('iap-4', 'Starter Pack', 'com.example.starter', InAppPurchaseType.NonConsumable, InAppPurchaseState.ReadyToSubmit),
      mk('iap-5', 'Legacy Bundle', 'com.example.legacy', InAppPurchaseType.NonConsumable, InAppPurchaseState.MissingMetadata),
    ];
  }
}
