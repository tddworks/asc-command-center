import { InAppPurchase, InAppPurchaseState, InAppPurchaseType } from '../InAppPurchase.ts';
import { InAppPurchaseLocalization } from '../InAppPurchaseLocalization.ts';
import { IAPAvailability, TerritoryAvailability } from '../IAPAvailability.ts';
import { IAPPriceSchedule, TerritoryPrice } from '../IAPPriceSchedule.ts';
import { IAPPricePoint, type IAPPricePointPage } from '../IAPPricePoint.ts';
import { IAPCustomerEligibility, InAppPurchaseOfferCode } from '../InAppPurchaseOfferCode.ts';
import { CodeEnvironment, IAPOneTimeUseCodeBatch } from '../OneTimeUseCodeBatch.ts';
import { ReviewScreenshot } from '../ReviewScreenshot.ts';
import type {
  CreateInAppPurchaseInput,
  CreateInAppPurchaseLocalizationInput,
  InAppPurchaseRepository,
} from '../InAppPurchaseRepository.ts';

/**
 * Deterministic in-memory IAP repository. Mutations persist on `this`
 * across calls so the page reflects every action without re-fetching.
 * Affordances are HATEOAS hrefs to keep mock and REST behaviourally
 * identical for the domain.
 */
export class MockInAppPurchaseRepository implements InAppPurchaseRepository {
  private byApp = new Map<string, InAppPurchase[]>();
  /** Per-IAP localization fixtures. Mutations persist on this map so the
   *  detail page reflects every add/delete/update without re-fetching. */
  private localizationsByIap = new Map<string, InAppPurchaseLocalization[]>();
  private screenshotByIap = new Map<string, ReviewScreenshot | null>();
  private availabilityByIap = new Map<string, IAPAvailability>();
  private offerCodesByIap = new Map<string, InAppPurchaseOfferCode[]>();
  private batchesByCode = new Map<string, IAPOneTimeUseCodeBatch[]>();
  /** Holds null for IAPs whose schedule we know is "no schedule yet". */
  private priceScheduleByIap = new Map<string, IAPPriceSchedule | null>();
  private nextLocId = 100;
  private nextShotId = 200;

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

  // ── Localizations ──

  async localizations(iap: InAppPurchase): Promise<InAppPurchaseLocalization[]> {
    const cached = this.localizationsByIap.get(iap.id);
    if (cached) return cached.map((l) => l);
    const seeded = this.seedLocalizationsFor(iap);
    this.localizationsByIap.set(iap.id, seeded);
    return seeded.map((l) => l);
  }

  async createLocalization(
    iap: InAppPurchase,
    input: CreateInAppPurchaseLocalizationInput,
  ): Promise<InAppPurchaseLocalization> {
    const id = `loc-${this.nextLocId++}`;
    const created = new InAppPurchaseLocalization({
      id,
      locale: input.locale,
      name: input.name,
      description: input.description ?? null,
      affordances: this.localizationAffordances(id),
    });
    const list = this.localizationsByIap.get(iap.id) ?? [];
    list.push(created);
    this.localizationsByIap.set(iap.id, list);
    return created;
  }

  async saveLocalization(_loc: InAppPurchaseLocalization): Promise<void> {
    // Domain mutates `_loc` in place after save resolves; the in-memory
    // array references the same object so no extra bookkeeping needed.
  }

  async deleteLocalization(loc: InAppPurchaseLocalization): Promise<void> {
    for (const [iapId, list] of this.localizationsByIap.entries()) {
      const next = list.filter((l) => l !== loc);
      if (next.length !== list.length) {
        this.localizationsByIap.set(iapId, next);
        return;
      }
    }
  }

  // ── Pricing ──

  async priceSchedule(iap: InAppPurchase): Promise<IAPPriceSchedule | null> {
    const cached = this.priceScheduleByIap.get(iap.id);
    if (cached !== undefined) return cached;
    const seeded = mockPriceScheduleFor(iap);
    this.priceScheduleByIap.set(iap.id, seeded);
    return seeded;
  }

  async setPrice(iap: InAppPurchase, input: { territoryId: string; pricePointId: string }): Promise<void> {
    // Persist a freshly-equalised schedule for this IAP so the next
    // priceSchedule() call returns the new base price + recomputed rows.
    this.priceScheduleByIap.set(iap.id, mockSetPriceScheduleFor(iap, input));
  }

  async pricePoints(
    iap: InAppPurchase,
    input: { territoryId: string; cursor: string | null; limit?: number },
  ): Promise<IAPPricePointPage> {
    return mockPricePointsPage(iap, input);
  }

  async equalizations(
    iap: InAppPurchase,
    input: { pricePointId: string; cursor: string | null; limit?: number },
  ): Promise<IAPPricePointPage> {
    // Equalisations: convert the picked tier into a multi-territory list.
    // For mock simplicity we return one row per SAMPLE_TERRITORY at the
    // equivalent price tier, paginated 5 per page.
    void iap;
    const limit = input.limit ?? 5;
    const start = input.cursor ? Number(input.cursor) || 0 : 0;
    const all = SAMPLE_TERRITORIES.map((t) => new IAPPricePoint({
      id: `${input.pricePointId}-${t.id}`,
      territoryId: t.id,
      formattedPrice: formatPrice(9.99 * t.rate, t.currency, t.symbol),
      currency: t.currency,
      proceeds: formatPrice(9.99 * t.rate * 0.7, t.currency, t.symbol),
    }));
    const slice = all.slice(start, start + limit);
    const next = start + limit < all.length ? String(start + limit) : null;
    return { items: slice, nextCursor: next };
  }

  // ── Availability ──

  async availability(iap: InAppPurchase): Promise<IAPAvailability | null> {
    let avail = this.availabilityByIap.get(iap.id);
    if (!avail) {
      avail = mockAvailabilityFor(iap);
      this.availabilityByIap.set(iap.id, avail);
    }
    return avail;
  }

  async setAvailability(
    iap: InAppPurchase,
    _input: { territoryIds: string[]; availableInNewTerritories: boolean },
  ): Promise<void> {
    void iap;
    void _input;
    // Domain mutates `availability` in place + calls markSaved after the
    // awaited call returns; the mock holds the same instance.
  }

  // ── Offer codes ──

  async offerCodes(iap: InAppPurchase): Promise<InAppPurchaseOfferCode[]> {
    let codes = this.offerCodesByIap.get(iap.id);
    if (!codes) {
      codes = mockOfferCodesFor(iap);
      this.offerCodesByIap.set(iap.id, codes);
    }
    return codes.map((c) => c);
  }

  async deactivateOfferCode(_code: InAppPurchaseOfferCode): Promise<void> {
    // Domain flips `isActive` in place after the awaited call returns; the
    // map references the same instance.
  }

  async oneTimeUseCodes(code: InAppPurchaseOfferCode): Promise<IAPOneTimeUseCodeBatch[]> {
    return this.batchesByCode.get(code.id) ?? [];
  }

  async generateOneTimeUseCodes(
    code: InAppPurchaseOfferCode,
    input: { count: number; environment: CodeEnvironment | string },
  ): Promise<IAPOneTimeUseCodeBatch> {
    const id = `batch-${Date.now()}`;
    const batch = new IAPOneTimeUseCodeBatch({
      id,
      numberOfCodes: input.count,
      environment: input.environment,
      isActive: true,
      createdDate: new Date().toISOString(),
    });
    const list = this.batchesByCode.get(code.id) ?? [];
    list.push(batch);
    this.batchesByCode.set(code.id, list);
    return batch;
  }

  async createOfferCode(
    iap: InAppPurchase,
    input: { name: string; customerEligibilities: IAPCustomerEligibility[] },
  ): Promise<InAppPurchaseOfferCode> {
    const id = `oc-mock-${Date.now()}`;
    const created = new InAppPurchaseOfferCode({
      id,
      iapId: iap.id,
      name: input.name,
      customerEligibilities: input.customerEligibilities,
      isActive: true,
      productionCodeCount: 0,
      sandboxCodeCount: 0,
      affordances: { deactivate: `/api/v1/iap-offer-codes/${id}` },
    });
    const list = this.offerCodesByIap.get(iap.id) ?? [];
    list.push(created);
    this.offerCodesByIap.set(iap.id, list);
    return created;
  }

  // ── Review screenshot ──

  async reviewScreenshot(iap: InAppPurchase): Promise<ReviewScreenshot | null> {
    return this.screenshotByIap.get(iap.id) ?? null;
  }

  async uploadReviewScreenshot(iap: InAppPurchase, file: File): Promise<ReviewScreenshot> {
    const id = `shot-${this.nextShotId++}`;
    // Read the file as a data URL so the page can display the upload
    // immediately without a CDN. Real backends sign a CDN URL instead.
    const previewUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const screenshot = new ReviewScreenshot({
      id,
      fileName: file.name,
      previewUrl,
      affordances: { delete: `/api/v1/iap/${iap.id}/review-screenshot` },
    });
    this.screenshotByIap.set(iap.id, screenshot);
    return screenshot;
  }

  async deleteReviewScreenshot(iap: InAppPurchase, _screenshot: ReviewScreenshot): Promise<void> {
    this.screenshotByIap.set(iap.id, null);
  }

  private localizationAffordances(id: string): Record<string, string> {
    return {
      update: `/api/v1/iap-localizations/${id}`,
      delete: `/api/v1/iap-localizations/${id}`,
    };
  }

  private seedLocalizationsFor(iap: InAppPurchase): InAppPurchaseLocalization[] {
    const sample: Record<string, { name: string; description: string }> = {
      'iap-1': { name: 'Premium Upgrade', description: 'Unlock every feature forever.' },
      'iap-2': { name: '100 Coins', description: 'A pouch of 100 in-game coins.' },
      'iap-3': { name: 'Special Offer', description: 'Limited-time bundle.' },
      'iap-4': { name: 'Starter Pack', description: 'Everything you need to start.' },
      'iap-5': { name: '', description: '' },
    };
    const fallback = { name: iap.referenceName, description: '' };
    const en = sample[iap.id] ?? fallback;
    const id = `loc-en-${iap.id}`;
    if (!en.name) return [];
    return [
      new InAppPurchaseLocalization({
        id,
        locale: 'en-US',
        name: en.name,
        description: en.description || null,
        affordances: this.localizationAffordances(id),
      }),
    ];
  }

  private affordancesFor(id: string): Record<string, string> {
    return {
      get: `/api/v1/iap/${id}`,
      update: `/api/v1/iap/${id}`,
      delete: `/api/v1/iap/${id}`,
      submit: `/api/v1/iap/${id}/submit`,
      unsubmit: `/api/v1/iap/${id}/submit`,
      listLocalizations: `/api/v1/iap/${id}/localizations`,
      createLocalization: `/api/v1/iap/${id}/localizations`,
      getReviewScreenshot: `/api/v1/iap/${id}/review-screenshot`,
      uploadReviewScreenshot: `/api/v1/iap/${id}/review-screenshot`,
      getPriceSchedule: `/api/v1/iap/${id}/price-schedule`,
      setPrice: `/api/v1/iap/${id}/price-schedule`,
      getAvailability: `/api/v1/iap/${id}/availability`,
      setAvailability: `/api/v1/iap/${id}/availability`,
      listOfferCodes: `/api/v1/iap/${id}/offer-codes`,
      createOfferCode: `/api/v1/iap/${id}/offer-codes`,
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

// ── Mock price schedule helpers (module-level so they're not bound to `this`) ──

const SAMPLE_TERRITORIES: { id: string; name: string; currency: string; symbol: string; rate: number }[] = [
  { id: 'USA', name: 'United States', currency: 'USD', symbol: '$', rate: 1 },
  { id: 'GBR', name: 'United Kingdom', currency: 'GBP', symbol: '£', rate: 0.79 },
  { id: 'DEU', name: 'Germany', currency: 'EUR', symbol: '€', rate: 0.92 },
  { id: 'JPN', name: 'Japan', currency: 'JPY', symbol: '¥', rate: 152 },
  { id: 'CHN', name: 'China', currency: 'CNY', symbol: '¥', rate: 7.2 },
  { id: 'AUS', name: 'Australia', currency: 'AUD', symbol: 'A$', rate: 1.52 },
  { id: 'CAN', name: 'Canada', currency: 'CAD', symbol: 'C$', rate: 1.38 },
  { id: 'BRA', name: 'Brazil', currency: 'BRL', symbol: 'R$', rate: 5.05 },
  { id: 'IND', name: 'India', currency: 'INR', symbol: '₹', rate: 83 },
  { id: 'KOR', name: 'South Korea', currency: 'KRW', symbol: '₩', rate: 1380 },
];

/** Map a fixture IAP to a USD base price. Returns null for IAPs that
 *  shouldn't have a schedule yet (newly seeded with MISSING_METADATA). */
function basePriceFor(iap: InAppPurchase): number | null {
  switch (iap.id) {
    case 'iap-1': return 9.99;
    case 'iap-2': return 0.99;
    case 'iap-3': return 4.99;
    case 'iap-4': return 1.99;
    default: return null;
  }
}

function formatPrice(amount: number, currency: string, symbol: string): string {
  if (currency === 'JPY' || currency === 'KRW') {
    return `${symbol}${Math.round(amount).toLocaleString('en-US')}`;
  }
  return `${symbol}${amount.toFixed(2)}`;
}

function mockPriceScheduleFor(iap: InAppPurchase): IAPPriceSchedule | null {
  const usd = basePriceFor(iap);
  if (usd === null) return null;
  const base = SAMPLE_TERRITORIES[0];
  const rows = SAMPLE_TERRITORIES.map((t) => {
    const local = usd * t.rate;
    return new TerritoryPrice({
      territoryId: t.id,
      territoryName: t.name,
      formattedPrice: formatPrice(local, t.currency, t.symbol),
      currency: t.currency,
      pricePointId: `pp-${iap.id}-${t.id}`,
    });
  });
  return new IAPPriceSchedule({
    baseTerritoryId: base.id,
    baseTerritoryName: base.name,
    basePrice: formatPrice(usd, base.currency, base.symbol),
    baseCurrency: base.currency,
    basePricePointId: `pp-${iap.id}-${base.id}`,
    territoryPrices: rows,
  });
}

function mockAvailabilityFor(iap: InAppPurchase): IAPAvailability {
  // First-load default: every territory available, auto-include on. The
  // page mutates this in place; mutations persist on the mock map across
  // re-loads because we hand back the same instance.
  const usd = basePriceFor(iap);
  const territories = SAMPLE_TERRITORIES.map((t) => new TerritoryAvailability({
    territoryId: t.id,
    territoryName: t.name,
    currency: t.currency,
    isAvailable: usd !== null, // unpriced fixtures stay unavailable
  }));
  return new IAPAvailability({
    availableInNewTerritories: usd !== null,
    territories,
  });
}

/** Apple's standard StoreKit price tiers, abbreviated. The picker
 *  paginates these with a 25-per-page window and a numeric cursor that's
 *  just the next start index. */
const STANDARD_USD_TIERS: number[] = [
  0.49, 0.99, 1.49, 1.99, 2.49, 2.99, 3.49, 3.99, 4.49, 4.99,
  5.99, 6.99, 7.99, 8.99, 9.99,
  14.99, 19.99, 24.99, 29.99, 39.99,
  49.99, 59.99, 69.99, 79.99, 89.99, 99.99,
  149.99, 199.99, 249.99, 299.99, 499.99, 999.99,
];

function mockPricePointsPage(
  iap: InAppPurchase,
  input: { territoryId: string; cursor: string | null; limit?: number },
): IAPPricePointPage {
  const territory = SAMPLE_TERRITORIES.find((t) => t.id === input.territoryId)
    ?? SAMPLE_TERRITORIES[0];
  const limit = input.limit ?? 25;
  const start = input.cursor ? Number(input.cursor) || 0 : 0;

  const all = STANDARD_USD_TIERS.map((usd) => {
    const local = usd * territory.rate;
    const id = `pp-${iap.id}-${territory.id}-${usd}`;
    return new IAPPricePoint({
      id,
      territoryId: territory.id,
      formattedPrice: formatPrice(local, territory.currency, territory.symbol),
      currency: territory.currency,
      proceeds: formatPrice(local * 0.7, territory.currency, territory.symbol),
    });
  });

  const slice = all.slice(start, start + limit);
  const next = start + limit < all.length ? String(start + limit) : null;
  return { items: slice, nextCursor: next };
}

function mockOfferCodesFor(iap: InAppPurchase): InAppPurchaseOfferCode[] {
  // Approved IAPs ship with one active offer code as a fixture so the page
  // renders something on first paint. Other IAPs start empty.
  if (iap.id !== 'iap-1') return [];
  return [
    new InAppPurchaseOfferCode({
      id: `oc-${iap.id}-welcome`,
      iapId: iap.id,
      name: 'WELCOME20',
      customerEligibilities: [IAPCustomerEligibility.NonSpender],
      isActive: true,
      productionCodeCount: 100,
      sandboxCodeCount: 25,
      affordances: { deactivate: `/api/v1/iap-offer-codes/oc-${iap.id}-welcome` },
    }),
    new InAppPurchaseOfferCode({
      id: `oc-${iap.id}-winback`,
      iapId: iap.id,
      name: 'WINBACK',
      customerEligibilities: [IAPCustomerEligibility.ChurnedSpender],
      isActive: false,
      productionCodeCount: 50,
    }),
  ];
}

/** Build a fresh price schedule for an IAP after the user picks a base
 *  price. The mock can't ask Apple for equalised territory prices, so it
 *  runs the same FX-derived computation as the seed function but anchored
 *  on the picked territory + parsed price-point amount. */
function mockSetPriceScheduleFor(
  iap: InAppPurchase,
  input: { territoryId: string; pricePointId: string },
): IAPPriceSchedule {
  // Best-effort: parse a USD-equivalent from the pricePointId. Demo IDs
  // look like "pp-iap-1-USA"; we fall back to the seed price for the IAP
  // when we can't infer an amount.
  const territory = SAMPLE_TERRITORIES.find((t) => t.id === input.territoryId)
    ?? SAMPLE_TERRITORIES[0];
  const fallbackUsd = basePriceFor(iap) ?? 9.99;
  const amountInTerritory = fallbackUsd * territory.rate;
  const usdEquivalent = amountInTerritory / territory.rate;

  const rows = SAMPLE_TERRITORIES.map((t) => {
    const local = usdEquivalent * t.rate;
    return new TerritoryPrice({
      territoryId: t.id,
      territoryName: t.name,
      formattedPrice: formatPrice(local, t.currency, t.symbol),
      currency: t.currency,
      pricePointId: t.id === input.territoryId ? input.pricePointId : `pp-${iap.id}-${t.id}`,
    });
  });

  return new IAPPriceSchedule({
    baseTerritoryId: territory.id,
    baseTerritoryName: territory.name,
    basePrice: formatPrice(amountInTerritory, territory.currency, territory.symbol),
    baseCurrency: territory.currency,
    basePricePointId: input.pricePointId,
    territoryPrices: rows,
  });
}
