export const SubscriptionPriceBucket = {
  All: 'all',
  Under1: 'under-1',
  From1To10: '1-10',
  From10To50: '10-50',
  From50To100: '50-100',
  Over100: 'over-100',
} as const;
export type SubscriptionPriceBucket = typeof SubscriptionPriceBucket[keyof typeof SubscriptionPriceBucket];

export interface SubscriptionPricePointInit {
  id: string;
  territoryId: string;
  formattedPrice: string;
  currency: string;
  proceeds: string;
}

function parseAmount(formatted: string): number | null {
  const cleaned = formatted.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Mirrors `IAPPricePoint`. Lives in the subscription slice because it
 *  routes through `SubscriptionRepository.pricePoints`. */
export class SubscriptionPricePoint {
  readonly id: string;
  readonly territoryId: string;
  readonly formattedPrice: string;
  readonly currency: string;
  readonly proceeds: string;

  constructor(init: SubscriptionPricePointInit) {
    this.id = init.id;
    this.territoryId = init.territoryId;
    this.formattedPrice = init.formattedPrice;
    this.currency = init.currency;
    this.proceeds = init.proceeds;
  }

  matches(query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
      this.formattedPrice.toLowerCase().includes(needle) ||
      this.currency.toLowerCase().includes(needle) ||
      this.proceeds.toLowerCase().includes(needle)
    );
  }

  get priceBucket(): SubscriptionPriceBucket {
    const amount = parseAmount(this.formattedPrice);
    if (amount === null) return SubscriptionPriceBucket.All;
    if (amount < 1) return SubscriptionPriceBucket.Under1;
    if (amount < 10) return SubscriptionPriceBucket.From1To10;
    if (amount < 50) return SubscriptionPriceBucket.From10To50;
    if (amount < 100) return SubscriptionPriceBucket.From50To100;
    return SubscriptionPriceBucket.Over100;
  }

  matchesBucket(bucket: SubscriptionPriceBucket): boolean {
    if (bucket === SubscriptionPriceBucket.All) return true;
    return this.priceBucket === bucket;
  }

  static fromJSON(json: Record<string, unknown>): SubscriptionPricePoint {
    const territory = json.territory as Record<string, unknown> | undefined;
    return new SubscriptionPricePoint({
      id: (json.id as string) ?? '',
      territoryId:
        (json.territoryId as string) ??
        (territory?.id as string) ??
        '',
      formattedPrice:
        (json.formattedPrice as string) ??
        (json.customerPrice as string) ??
        (json.price as string) ??
        '',
      currency:
        (json.currency as string) ??
        (territory?.currency as string) ??
        '',
      proceeds: (json.proceeds as string) ?? '',
    });
  }
}

export interface SubscriptionPricePointPage {
  items: SubscriptionPricePoint[];
  nextCursor: string | null;
}
