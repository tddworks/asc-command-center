import { Subscription, SubscriptionPeriod, SubscriptionState } from '../Subscription.ts';
import { SubscriptionGroup } from '../SubscriptionGroup.ts';
import { SubscriptionLocalization } from '../SubscriptionLocalization.ts';
import { SubscriptionGroupLocalization } from '../SubscriptionGroupLocalization.ts';
import { SubscriptionAvailability, SubscriptionTerritoryAvailability } from '../SubscriptionAvailability.ts';
import { SubscriptionPriceSchedule, SubscriptionTerritoryPrice } from '../SubscriptionPriceSchedule.ts';
import { SubscriptionPricePoint, type SubscriptionPricePointPage } from '../SubscriptionPricePoint.ts';
import { SubscriptionReviewScreenshot } from '../SubscriptionReviewScreenshot.ts';
import { SubscriptionImage, SubscriptionImageState } from '../SubscriptionImage.ts';
import {
  CodeEnvironment,
  OfferMode,
  SubscriptionCustomCode,
  SubscriptionCustomerEligibility,
  SubscriptionDuration,
  SubscriptionIntroductoryOffer,
  SubscriptionOfferCode,
  SubscriptionOneTimeUseCodeBatch,
  SubscriptionPromotionalOffer,
} from '../SubscriptionOffers.ts';
import { WinBackOffer, WinBackPriority } from '../WinBackOffer.ts';
import type {
  CreateSubscriptionCustomCodeInput,
  CreateSubscriptionInput,
  CreateSubscriptionLocalizationInput,
  CreateSubscriptionOfferCodeInput,
  GenerateSubscriptionOneTimeUseCodesInput,
  SubscriptionRepository,
} from '../SubscriptionRepository.ts';
import type {
  CreateSubscriptionGroupLocalizationInput,
  SubscriptionGroupRepository,
} from '../SubscriptionGroupRepository.ts';

/** Deterministic in-memory repo seeding two groups + tier fixtures so the
 *  page exercises both the count badges and the per-tier action buttons. */
export class MockSubscriptionGroupRepository implements SubscriptionGroupRepository, SubscriptionRepository {
  private groupsByApp = new Map<string, SubscriptionGroup[]>();
  private tiersByGroup = new Map<string, Subscription[]>();
  private localizationsByTier = new Map<string, SubscriptionLocalization[]>();
  private groupLocalizationsByGroup = new Map<string, SubscriptionGroupLocalization[]>();
  private nextGroupLocId = 700;
  private screenshotByTier = new Map<string, SubscriptionReviewScreenshot | null>();
  private imagesByTier = new Map<string, SubscriptionImage[]>();
  private availabilityByTier = new Map<string, SubscriptionAvailability>();
  private priceScheduleByTier = new Map<string, SubscriptionPriceSchedule | null>();
  private offerCodesBySub = new Map<string, SubscriptionOfferCode[]>();
  private batchesByOfferCode = new Map<string, SubscriptionOneTimeUseCodeBatch[]>();
  private customCodesByOfferCode = new Map<string, SubscriptionCustomCode[]>();
  private nextLocId = 500;
  private nextShotId = 600;
  private nextImgId = 800;

  async list(appId: string): Promise<SubscriptionGroup[]> {
    if (!this.groupsByApp.has(appId)) {
      this.seed(appId);
    }
    return [...this.groupsByApp.get(appId)!];
  }

  async get(id: string): Promise<SubscriptionGroup> {
    for (const list of this.groupsByApp.values()) {
      const found = list.find((g) => g.id === id);
      if (found) return found;
    }
    throw new Error(`SubscriptionGroup ${id} not found`);
  }

  async create(input: { appId: string; referenceName: string }): Promise<SubscriptionGroup> {
    if (!this.groupsByApp.has(input.appId)) this.seed(input.appId);
    const id = `sg-mock-${Date.now()}`;
    const group = new SubscriptionGroup(
      { id, appId: input.appId, referenceName: input.referenceName, affordances: this.groupAffordances(id) },
      this,
    );
    this.groupsByApp.get(input.appId)!.push(group);
    this.tiersByGroup.set(id, []);
    return group;
  }

  async subscriptions(group: SubscriptionGroup): Promise<Subscription[]> {
    return [...(this.tiersByGroup.get(group.id) ?? [])];
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    const id = `sub-mock-${Date.now()}`;
    const sub = new Subscription(
      {
        id,
        groupId: input.groupId,
        name: input.name,
        productId: input.productId,
        subscriptionPeriod: input.subscriptionPeriod,
        isFamilySharable: input.isFamilySharable,
        state: SubscriptionState.MissingMetadata,
        affordances: this.tierAffordances(id),
      },
      this,
    );
    const list = this.tiersByGroup.get(input.groupId) ?? [];
    list.push(sub);
    this.tiersByGroup.set(input.groupId, list);
    return sub;
  }

  async removeSubscription(sub: Subscription): Promise<void> {
    return this.remove(sub);
  }

  async reorderSubscriptions(group: SubscriptionGroup, orderedIds: string[]): Promise<void> {
    const list = this.tiersByGroup.get(group.id) ?? [];
    const byId = new Map(list.map((s) => [s.id, s]));
    const next: Subscription[] = [];
    orderedIds.forEach((id) => {
      const tier = byId.get(id);
      if (tier) next.push(tier);
    });
    this.tiersByGroup.set(group.id, next);
  }

  update(group: SubscriptionGroup, patch: { referenceName?: string }): Promise<void>;
  update(sub: Subscription, patch: Record<string, unknown>): Promise<void>;
  async update(_target: SubscriptionGroup | Subscription, _patch: Record<string, unknown>): Promise<void> {
    // Domain mutates `this` after the awaited call returns.
  }

  remove(group: SubscriptionGroup): Promise<void>;
  remove(sub: Subscription): Promise<void>;
  async remove(target: SubscriptionGroup | Subscription): Promise<void> {
    if ((target as SubscriptionGroup).appId !== undefined) {
      const group = target as SubscriptionGroup;
      const list = this.groupsByApp.get(group.appId);
      if (list) this.groupsByApp.set(group.appId, list.filter((g) => g.id !== group.id));
      this.tiersByGroup.delete(group.id);
      return;
    }
    const sub = target as Subscription;
    const list = this.tiersByGroup.get(sub.groupId);
    if (list) this.tiersByGroup.set(sub.groupId, list.filter((s) => s.id !== sub.id));
  }

  async submit(_sub: Subscription): Promise<void> {}
  async unsubmit(_sub: Subscription): Promise<void> {}

  // ── Group localizations ──

  async groupLocalizations(group: SubscriptionGroup): Promise<SubscriptionGroupLocalization[]> {
    const cached = this.groupLocalizationsByGroup.get(group.id);
    if (cached) return cached.map((l) => l);
    const seeded = this.seedGroupLocalizationsFor(group);
    this.groupLocalizationsByGroup.set(group.id, seeded);
    return seeded.map((l) => l);
  }

  async createGroupLocalization(
    group: SubscriptionGroup,
    input: CreateSubscriptionGroupLocalizationInput,
  ): Promise<SubscriptionGroupLocalization> {
    const id = `sub-grouploc-${this.nextGroupLocId++}`;
    const created = new SubscriptionGroupLocalization({
      id,
      locale: input.locale,
      name: input.name,
      customAppName: input.customAppName ?? null,
      affordances: this.groupLocalizationAffordances(id),
    });
    const list = this.groupLocalizationsByGroup.get(group.id) ?? [];
    list.push(created);
    this.groupLocalizationsByGroup.set(group.id, list);
    return created;
  }

  async saveGroupLocalization(_loc: SubscriptionGroupLocalization): Promise<void> {}

  async deleteGroupLocalization(loc: SubscriptionGroupLocalization): Promise<void> {
    for (const [groupId, list] of this.groupLocalizationsByGroup.entries()) {
      const next = list.filter((l) => l !== loc);
      if (next.length !== list.length) {
        this.groupLocalizationsByGroup.set(groupId, next);
        return;
      }
    }
  }

  private groupLocalizationAffordances(id: string): Record<string, string> {
    return {
      update: `/api/v1/subscription-group-localizations/${id}`,
      delete: `/api/v1/subscription-group-localizations/${id}`,
    };
  }

  private seedGroupLocalizationsFor(group: SubscriptionGroup): SubscriptionGroupLocalization[] {
    const id = `sub-grouploc-en-${group.id}`;
    return [
      new SubscriptionGroupLocalization({
        id,
        locale: 'en-US',
        name: group.referenceName,
        customAppName: null,
        affordances: this.groupLocalizationAffordances(id),
      }),
    ];
  }

  // ── Pricing ──

  async priceSchedule(sub: Subscription): Promise<SubscriptionPriceSchedule | null> {
    const cached = this.priceScheduleByTier.get(sub.id);
    if (cached !== undefined) return cached;
    const seeded = mockSubPriceScheduleFor(sub);
    this.priceScheduleByTier.set(sub.id, seeded);
    return seeded;
  }

  async setPrices(
    sub: Subscription,
    input: Array<{ territoryId: string; pricePointId: string }>,
  ): Promise<void> {
    this.priceScheduleByTier.set(sub.id, mockSetSubPricesFor(sub, input));
  }

  async pricePoints(
    sub: Subscription,
    input: { territoryId: string; cursor: string | null; limit?: number },
  ): Promise<SubscriptionPricePointPage> {
    return mockSubPricePointsPage(sub, input);
  }

  async equalizations(
    sub: Subscription,
    input: { pricePointId: string; cursor: string | null; limit?: number },
  ): Promise<SubscriptionPricePointPage> {
    void sub;
    const limit = input.limit ?? 5;
    const start = input.cursor ? Number(input.cursor) || 0 : 0;
    const all = SUB_TERRITORIES.map((t) => new SubscriptionPricePoint({
      id: `${input.pricePointId}-${t.id}`,
      territoryId: t.id,
      formattedPrice: formatSubPrice(9.99 * t.rate, t.currency, t.symbol),
      currency: t.currency,
      proceeds: formatSubPrice(9.99 * t.rate * 0.7, t.currency, t.symbol),
    }));
    const slice = all.slice(start, start + limit);
    const next = start + limit < all.length ? String(start + limit) : null;
    return { items: slice, nextCursor: next };
  }

  // ── Review screenshot ──

  async reviewScreenshot(sub: Subscription): Promise<SubscriptionReviewScreenshot | null> {
    return this.screenshotByTier.get(sub.id) ?? null;
  }

  async uploadReviewScreenshot(sub: Subscription, file: File): Promise<SubscriptionReviewScreenshot> {
    const id = `sub-shot-${this.nextShotId++}`;
    const previewUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const screenshot = new SubscriptionReviewScreenshot({
      id,
      fileName: file.name,
      previewUrl,
      affordances: { delete: `/api/v1/subscriptions/${sub.id}/review-screenshot` },
    });
    this.screenshotByTier.set(sub.id, screenshot);
    return screenshot;
  }

  async deleteReviewScreenshot(sub: Subscription, _screenshot: SubscriptionReviewScreenshot): Promise<void> {
    this.screenshotByTier.set(sub.id, null);
  }

  // ── Promotional images ──

  async images(sub: Subscription): Promise<SubscriptionImage[]> {
    return [...(this.imagesByTier.get(sub.id) ?? [])];
  }

  async uploadImage(sub: Subscription, file: File): Promise<SubscriptionImage> {
    const id = `sub-img-${this.nextImgId++}`;
    const previewUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const created = new SubscriptionImage({
      id,
      fileName: file.name,
      fileSize: file.size,
      state: SubscriptionImageState.UploadComplete,
      previewUrl,
      affordances: { delete: `/api/v1/subscription-images/${id}` },
    });
    const list = this.imagesByTier.get(sub.id) ?? [];
    list.push(created);
    this.imagesByTier.set(sub.id, list);
    return created;
  }

  async deleteImage(sub: Subscription, image: SubscriptionImage): Promise<void> {
    const list = this.imagesByTier.get(sub.id);
    if (!list) return;
    this.imagesByTier.set(sub.id, list.filter((img) => img !== image));
  }

  // ── Availability ──

  async availability(sub: Subscription): Promise<SubscriptionAvailability | null> {
    let avail = this.availabilityByTier.get(sub.id);
    if (!avail) {
      avail = mockSubAvailabilityFor(sub);
      this.availabilityByTier.set(sub.id, avail);
    }
    return avail;
  }

  async setAvailability(
    _sub: Subscription,
    _input: { territoryIds: string[]; availableInNewTerritories: boolean },
  ): Promise<void> {
    // Mock holds the same instance the page edits — markSaved on the
    // domain side is sufficient; nothing else to persist.
  }

  // ── Offers ──

  async introductoryOffers(sub: Subscription): Promise<SubscriptionIntroductoryOffer[]> {
    return mockIntroductoryOffersFor(sub);
  }

  async createIntroductoryOffer(
    sub: Subscription,
    input: {
      offerMode: OfferMode | string;
      duration: SubscriptionDuration | string;
      numberOfPeriods: number;
      territory?: string | null;
      startDate?: string | null;
      endDate?: string | null;
    },
  ): Promise<SubscriptionIntroductoryOffer> {
    void sub;
    return new SubscriptionIntroductoryOffer({
      id: `intro-mock-${Date.now()}`,
      offerMode: input.offerMode,
      duration: input.duration,
      numberOfPeriods: input.numberOfPeriods,
      territory: input.territory ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    });
  }

  async deleteIntroductoryOffer(_offer: SubscriptionIntroductoryOffer): Promise<void> {}

  async promotionalOffers(sub: Subscription): Promise<SubscriptionPromotionalOffer[]> {
    return mockPromotionalOffersFor(sub);
  }

  async createPromotionalOffer(
    sub: Subscription,
    input: {
      name: string;
      offerCode: string;
      offerMode: OfferMode | string;
      duration: SubscriptionDuration | string;
      numberOfPeriods: number;
    },
  ): Promise<SubscriptionPromotionalOffer> {
    void sub;
    return new SubscriptionPromotionalOffer({
      id: `promo-mock-${Date.now()}`,
      name: input.name,
      offerCode: input.offerCode,
      offerMode: input.offerMode,
      duration: input.duration,
      numberOfPeriods: input.numberOfPeriods,
    });
  }

  async deletePromotionalOffer(_offer: SubscriptionPromotionalOffer): Promise<void> {}

  async offerCodes(sub: Subscription): Promise<SubscriptionOfferCode[]> {
    let cached = this.offerCodesBySub.get(sub.id);
    if (!cached) {
      cached = mockOfferCodesFor(sub).map((code) => {
        // Inject appId so the redemption-URL getter is realistic in mock mode.
        const appId = this.appIdForSub(sub);
        if (appId) code.affordances.appId = appId;
        return code;
      });
      this.offerCodesBySub.set(sub.id, cached);
    }
    return cached.map((c) => c);
  }

  async winBackOffers(sub: Subscription): Promise<WinBackOffer[]> {
    return mockWinBackOffersFor(sub);
  }

  async createOfferCode(
    sub: Subscription,
    input: CreateSubscriptionOfferCodeInput,
  ): Promise<SubscriptionOfferCode> {
    const id = `sc-mock-${Date.now()}`;
    void input.prices;
    const created = new SubscriptionOfferCode({
      id,
      subscriptionId: sub.id,
      name: input.name,
      offerMode: input.offerMode,
      duration: input.duration,
      numberOfPeriods: input.numberOfPeriods,
      customerEligibilities: input.customerEligibilities,
      autoRenewEnabled: input.autoRenewEnabled ?? true,
      offerEligibility: input.offerEligibility ?? null,
      isActive: true,
      totalNumberOfCodes: 0,
      affordances: {
        deactivate: `/api/v1/subscription-offer-codes/${id}`,
        appId: this.appIdForSub(sub),
      },
    });
    const list = this.offerCodesBySub.get(sub.id) ?? [];
    list.push(created);
    this.offerCodesBySub.set(sub.id, list);
    return created;
  }

  async deactivateOfferCode(_code: SubscriptionOfferCode): Promise<void> {
    // Domain flips `isActive` in place after the awaited call returns.
  }

  // ── Offer-code children ──

  async oneTimeUseCodes(code: SubscriptionOfferCode): Promise<SubscriptionOneTimeUseCodeBatch[]> {
    let cached = this.batchesByOfferCode.get(code.id);
    if (!cached) {
      cached = mockSubBatchesFor(code.id);
      this.batchesByOfferCode.set(code.id, cached);
    }
    return [...cached];
  }

  async generateOneTimeUseCodes(
    code: SubscriptionOfferCode,
    input: GenerateSubscriptionOneTimeUseCodesInput,
  ): Promise<SubscriptionOneTimeUseCodeBatch> {
    const id = `sub-batch-${Date.now()}`;
    const created = new SubscriptionOneTimeUseCodeBatch({
      id,
      numberOfCodes: input.count,
      environment: input.environment,
      isActive: true,
      createdDate: new Date().toISOString(),
      expirationDate: input.expirationDate ?? null,
    });
    const list = this.batchesByOfferCode.get(code.id) ?? [];
    list.push(created);
    this.batchesByOfferCode.set(code.id, list);
    return created;
  }

  async customCodes(code: SubscriptionOfferCode): Promise<SubscriptionCustomCode[]> {
    return this.customCodesByOfferCode.get(code.id) ?? [];
  }

  async createCustomCode(
    code: SubscriptionOfferCode,
    input: CreateSubscriptionCustomCodeInput,
  ): Promise<SubscriptionCustomCode> {
    const id = `sub-cc-${Date.now()}`;
    const created = new SubscriptionCustomCode({
      id,
      customCode: input.customCode,
      numberOfCodes: input.numberOfCodes,
      expirationDate: input.expirationDate ?? null,
      isActive: true,
    });
    const list = this.customCodesByOfferCode.get(code.id) ?? [];
    list.push(created);
    this.customCodesByOfferCode.set(code.id, list);
    return created;
  }

  async oneTimeUseCodeValues(
    _code: SubscriptionOfferCode,
    batch: SubscriptionOneTimeUseCodeBatch,
  ): Promise<string> {
    const lines: string[] = [];
    for (let i = 0; i < batch.numberOfCodes; i++) {
      lines.push(pseudoSubCode(batch.id, i));
    }
    return lines.join('\n');
  }

  /** Resolve the App Store ID for a subscription's host app. The mock
   *  doesn't carry the bidirectional link so we fall back to the appId
   *  cached on the parent group; the REST repo relies on the backend
   *  injecting the affordance directly. */
  private appIdForSub(sub: Subscription): string {
    for (const groups of this.groupsByApp.values()) {
      for (const group of groups) {
        if (group.id === sub.groupId) {
          for (const [appId, gs] of this.groupsByApp.entries()) {
            if (gs.includes(group)) return appId;
          }
        }
      }
    }
    return '';
  }

  // ── Localizations ──

  async localizations(sub: Subscription): Promise<SubscriptionLocalization[]> {
    const cached = this.localizationsByTier.get(sub.id);
    if (cached) return cached.map((l) => l);
    const seeded = this.seedLocalizationsFor(sub);
    this.localizationsByTier.set(sub.id, seeded);
    return seeded.map((l) => l);
  }

  async createLocalization(
    sub: Subscription,
    input: CreateSubscriptionLocalizationInput,
  ): Promise<SubscriptionLocalization> {
    const id = `sub-loc-${this.nextLocId++}`;
    const created = new SubscriptionLocalization({
      id,
      locale: input.locale,
      name: input.name,
      description: input.description ?? null,
      affordances: this.localizationAffordances(id),
    });
    const list = this.localizationsByTier.get(sub.id) ?? [];
    list.push(created);
    this.localizationsByTier.set(sub.id, list);
    return created;
  }

  async saveLocalization(_loc: SubscriptionLocalization): Promise<void> {
    // Mutated in place by the domain after save resolves.
  }

  async deleteLocalization(loc: SubscriptionLocalization): Promise<void> {
    for (const [tierId, list] of this.localizationsByTier.entries()) {
      const next = list.filter((l) => l !== loc);
      if (next.length !== list.length) {
        this.localizationsByTier.set(tierId, next);
        return;
      }
    }
  }

  private localizationAffordances(id: string): Record<string, string> {
    return {
      update: `/api/v1/subscription-localizations/${id}`,
      delete: `/api/v1/subscription-localizations/${id}`,
    };
  }

  private seedLocalizationsFor(sub: Subscription): SubscriptionLocalization[] {
    const id = `sub-loc-en-${sub.id}`;
    return [
      new SubscriptionLocalization({
        id,
        locale: 'en-US',
        name: sub.name,
        description: `${sub.periodLabel} ${sub.name} subscription.`,
        affordances: this.localizationAffordances(id),
      }),
    ];
  }

  private groupAffordances(id: string): Record<string, string> {
    return {
      get: `/api/v1/subscription-groups/${id}`,
      update: `/api/v1/subscription-groups/${id}`,
      delete: `/api/v1/subscription-groups/${id}`,
      listSubscriptions: `/api/v1/subscription-groups/${id}/subscriptions`,
      createSubscription: `/api/v1/subscription-groups/${id}/subscriptions`,
      listLocalizations: `/api/v1/subscription-groups/${id}/localizations`,
      createLocalization: `/api/v1/subscription-groups/${id}/localizations`,
      reorderSubscriptions: `/api/v1/subscription-groups/${id}/subscriptions/reorder`,
    };
  }

  private tierAffordances(id: string): Record<string, string> {
    return {
      get: `/api/v1/subscriptions/${id}`,
      update: `/api/v1/subscriptions/${id}`,
      delete: `/api/v1/subscriptions/${id}`,
      submit: `/api/v1/subscriptions/${id}/submit`,
      unsubmit: `/api/v1/subscriptions/${id}/submit`,
      listLocalizations: `/api/v1/subscriptions/${id}/localizations`,
      createLocalization: `/api/v1/subscriptions/${id}/localizations`,
      getPriceSchedule: `/api/v1/subscriptions/${id}/price-schedule`,
      setPrices: `/api/v1/subscriptions/${id}/price-schedule`,
      getReviewScreenshot: `/api/v1/subscriptions/${id}/review-screenshot`,
      uploadReviewScreenshot: `/api/v1/subscriptions/${id}/review-screenshot`,
      listImages: `/api/v1/subscriptions/${id}/images`,
      createImage: `/api/v1/subscriptions/${id}/images`,
      getAvailability: `/api/v1/subscriptions/${id}/availability`,
      setAvailability: `/api/v1/subscriptions/${id}/availability`,
      listIntroductoryOffers: `/api/v1/subscriptions/${id}/introductory-offers`,
      createIntroductoryOffer: `/api/v1/subscriptions/${id}/introductory-offers`,
      listWinBackOffers: `/api/v1/subscriptions/${id}/win-back-offers`,
      listPromotionalOffers: `/api/v1/subscriptions/${id}/promotional-offers`,
      createPromotionalOffer: `/api/v1/subscriptions/${id}/promotional-offers`,
      listOfferCodes: `/api/v1/subscriptions/${id}/offer-codes`,
      createOfferCode: `/api/v1/subscriptions/${id}/offer-codes`,
    };
  }

  private seed(appId: string): void {
    const premium = new SubscriptionGroup(
      { id: 'sg-1', appId, referenceName: 'Premium Plans', affordances: this.groupAffordances('sg-1') },
      this,
    );
    const addon = new SubscriptionGroup(
      { id: 'sg-2', appId, referenceName: 'Add-on Features', affordances: this.groupAffordances('sg-2') },
      this,
    );
    this.groupsByApp.set(appId, [premium, addon]);

    const mkTier = (
      id: string,
      groupId: string,
      name: string,
      productId: string,
      period: string,
      state: string,
      family = false,
      level: number | null = null,
      hasSubmission = false,
    ): Subscription =>
      new Subscription(
        {
          id, groupId, name, productId,
          subscriptionPeriod: period,
          isFamilySharable: family,
          state,
          groupLevel: level,
          hasSubmission,
          affordances: this.tierAffordances(id),
        },
        this,
      );

    this.tiersByGroup.set('sg-1', [
      mkTier('sub-1', 'sg-1', 'Premium Monthly', 'com.example.premium.monthly', SubscriptionPeriod.OneMonth, SubscriptionState.Approved, true, 1),
      mkTier('sub-2', 'sg-1', 'Premium Yearly', 'com.example.premium.yearly', SubscriptionPeriod.OneYear, SubscriptionState.Approved, true, 2),
      mkTier('sub-3', 'sg-1', 'Premium Plus', 'com.example.premium.plus', SubscriptionPeriod.OneMonth, SubscriptionState.ReadyToSubmit, false, 3),
    ]);
    this.tiersByGroup.set('sg-2', [
      mkTier('sub-4', 'sg-2', 'Cloud Backup', 'com.example.addon.cloud', SubscriptionPeriod.OneMonth, SubscriptionState.WaitingForReview, false, 1, true),
    ]);
  }
}

// ── Mock pricing helpers (module-level so they're not bound to `this`) ──

const SUB_TERRITORIES: { id: string; name: string; currency: string; symbol: string; rate: number }[] = [
  { id: 'USA', name: 'United States', currency: 'USD', symbol: '$', rate: 1 },
  { id: 'GBR', name: 'United Kingdom', currency: 'GBP', symbol: '£', rate: 0.79 },
  { id: 'DEU', name: 'Germany', currency: 'EUR', symbol: '€', rate: 0.92 },
  { id: 'JPN', name: 'Japan', currency: 'JPY', symbol: '¥', rate: 152 },
  { id: 'CHN', name: 'China', currency: 'CNY', symbol: '¥', rate: 7.2 },
  { id: 'AUS', name: 'Australia', currency: 'AUD', symbol: 'A$', rate: 1.52 },
  { id: 'CAN', name: 'Canada', currency: 'CAD', symbol: 'C$', rate: 1.38 },
];

/** USD base price per fixture tier. Returns null for tiers that should
 *  display the empty state instead. */
function subBasePriceFor(sub: Subscription): number | null {
  switch (sub.id) {
    case 'sub-1': return 4.99;
    case 'sub-2': return 49.99;
    case 'sub-3': return 9.99;
    case 'sub-4': return 1.99;
    default: return null;
  }
}

function formatSubPrice(amount: number, currency: string, symbol: string): string {
  if (currency === 'JPY' || currency === 'KRW') {
    return `${symbol}${Math.round(amount).toLocaleString('en-US')}`;
  }
  return `${symbol}${amount.toFixed(2)}`;
}

function mockSubPriceScheduleFor(sub: Subscription): SubscriptionPriceSchedule | null {
  const usd = subBasePriceFor(sub);
  if (usd === null) return null;
  const rows = SUB_TERRITORIES.map((t) => new SubscriptionTerritoryPrice({
    territoryId: t.id,
    territoryName: t.name,
    formattedPrice: formatSubPrice(usd * t.rate, t.currency, t.symbol),
    currency: t.currency,
    pricePointId: `pp-${sub.id}-${t.id}`,
  }));
  return new SubscriptionPriceSchedule({ territoryPrices: rows });
}

function mockSubAvailabilityFor(sub: Subscription): SubscriptionAvailability {
  const usd = subBasePriceFor(sub);
  const territories = SUB_TERRITORIES.map((t) => new SubscriptionTerritoryAvailability({
    territoryId: t.id,
    territoryName: t.name,
    currency: t.currency,
    isAvailable: usd !== null,
  }));
  return new SubscriptionAvailability({
    availableInNewTerritories: usd !== null,
    territories,
  });
}

function mockIntroductoryOffersFor(sub: Subscription): SubscriptionIntroductoryOffer[] {
  // Approved tiers ship with a free-trial offer; others stay empty.
  if (sub.id !== 'sub-1' && sub.id !== 'sub-2') return [];
  return [
    new SubscriptionIntroductoryOffer({
      id: `intro-${sub.id}`,
      offerMode: OfferMode.FreeTrial,
      duration: SubscriptionDuration.OneWeek,
      numberOfPeriods: 1,
      territory: 'USA',
      startDate: '2026-01-01',
    }),
  ];
}

function mockPromotionalOffersFor(sub: Subscription): SubscriptionPromotionalOffer[] {
  if (sub.id !== 'sub-2') return [];
  return [
    new SubscriptionPromotionalOffer({
      id: `promo-${sub.id}`,
      name: 'Holiday 2026',
      offerCode: 'HOLIDAY2026',
      offerMode: OfferMode.PayAsYouGo,
      duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 3,
    }),
  ];
}

/** Build a fresh schedule after the user picks one or more
 *  {territoryId, pricePointId} pairs. The first pair is the anchor; we
 *  re-equalise off Apple's notional FX for the rest. Real Apple equalises
 *  via paginated price-points; the wizard ships in a later phase. */
function mockSetSubPricesFor(
  sub: Subscription,
  input: Array<{ territoryId: string; pricePointId: string }>,
): SubscriptionPriceSchedule {
  const anchor = input[0];
  const anchorTerritory = SUB_TERRITORIES.find((t) => t.id === anchor?.territoryId)
    ?? SUB_TERRITORIES[0];
  const fallbackUsd = subBasePriceFor(sub) ?? 9.99;
  const usdEquivalent = (fallbackUsd * anchorTerritory.rate) / anchorTerritory.rate;

  const rows = SUB_TERRITORIES.map((t) => {
    const local = usdEquivalent * t.rate;
    const explicit = input.find((p) => p.territoryId === t.id);
    return new SubscriptionTerritoryPrice({
      territoryId: t.id,
      territoryName: t.name,
      formattedPrice: formatSubPrice(local, t.currency, t.symbol),
      currency: t.currency,
      pricePointId: explicit?.pricePointId ?? `pp-${sub.id}-${t.id}`,
    });
  });
  return new SubscriptionPriceSchedule({ territoryPrices: rows });
}

const SUB_USD_TIERS: number[] = [
  0.99, 1.99, 2.99, 3.99, 4.99, 5.99, 6.99, 7.99, 8.99, 9.99,
  14.99, 19.99, 24.99, 29.99, 39.99, 49.99, 59.99, 69.99, 79.99, 99.99,
  149.99, 199.99, 299.99, 499.99,
];

function mockSubPricePointsPage(
  sub: Subscription,
  input: { territoryId: string; cursor: string | null; limit?: number },
): SubscriptionPricePointPage {
  const territory = SUB_TERRITORIES.find((t) => t.id === input.territoryId)
    ?? SUB_TERRITORIES[0];
  const limit = input.limit ?? 25;
  const start = input.cursor ? Number(input.cursor) || 0 : 0;
  const all = SUB_USD_TIERS.map((usd) => {
    const local = usd * territory.rate;
    return new SubscriptionPricePoint({
      id: `pp-${sub.id}-${territory.id}-${usd}`,
      territoryId: territory.id,
      formattedPrice: formatSubPrice(local, territory.currency, territory.symbol),
      currency: territory.currency,
      proceeds: formatSubPrice(local * 0.7, territory.currency, territory.symbol),
    });
  });
  const slice = all.slice(start, start + limit);
  const next = start + limit < all.length ? String(start + limit) : null;
  return { items: slice, nextCursor: next };
}

function mockOfferCodesFor(sub: Subscription): SubscriptionOfferCode[] {
  if (sub.id !== 'sub-1') return [];
  return [
    new SubscriptionOfferCode({
      id: `code-${sub.id}-welcome`,
      name: 'WELCOME50',
      offerMode: OfferMode.PayAsYouGo,
      duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 1,
      customerEligibilities: [SubscriptionCustomerEligibility.New],
      isActive: true,
      totalNumberOfCodes: 500,
    }),
  ];
}

function mockWinBackOffersFor(sub: Subscription): WinBackOffer[] {
  // Only Approved tiers have win-back offers in the iOS prototype.
  if (!sub.isApproved) return [];
  if (sub.id !== 'sub-1' && sub.id !== 'sub-2') return [];
  return [
    new WinBackOffer({
      id: `wb-${sub.id}`,
      referenceName: 'Q1 Win-back',
      offerMode: OfferMode.PayAsYouGo,
      duration: SubscriptionDuration.OneMonth,
      numberOfPeriods: 3,
      priority: WinBackPriority.High,
    }),
  ];
}

/** Default fixture: one production batch on each seeded offer code. Lets
 *  the detail page render something on first paint. */
function mockSubBatchesFor(offerCodeId: string): SubscriptionOneTimeUseCodeBatch[] {
  return [
    new SubscriptionOneTimeUseCodeBatch({
      id: `${offerCodeId}-batch-1`,
      numberOfCodes: 100,
      environment: CodeEnvironment.Production,
      isActive: true,
      createdDate: '2026-01-15',
    }),
  ];
}

/** Deterministic 12-char alphanumerics seeded from a batch id. Matches
 *  the look of Apple's real redeemable codes without leaking any. */
function pseudoSubCode(seed: string, index: number): string {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  h = (h + index * 2654435761) >>> 0;
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += ALPHABET[h % ALPHABET.length];
    h = ((h * 1103515245) + 12345 + i) >>> 0;
  }
  return out;
}
