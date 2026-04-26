import { InAppPurchase, InAppPurchaseState, InAppPurchaseType } from '../InAppPurchase.ts';
import { InAppPurchaseLocalization } from '../InAppPurchaseLocalization.ts';
import { IAPPriceSchedule, TerritoryPrice } from '../IAPPriceSchedule.ts';
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
    return mockPriceScheduleFor(iap);
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

  private seedLocalizationsFor(iap: InAppPurchase): InAppPurchaseLocalization[] { void iap;
    return seedLocalizationsImpl(iap);
  }
}

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
    default: return null; // MISSING_METADATA fixtures stay unpriced
  }
}

function formatPrice(amount: number, currency: string, symbol: string): string {
  // JPY/KRW have no decimals on the App Store; everything else gets two.
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

function seedLocalizationsImpl(iap: InAppPurchase): InAppPurchaseLocalization[] {
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
