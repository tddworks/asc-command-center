/** Price-range buckets the picker uses for filter pills. Mirrors the
 *  iOS prototype's "All / <$1 / $1-$10 / $10-$50 / $50-$100 / $100+"
 *  segmented control. The thresholds are nominal USD; we apply them
 *  against the leading numeric amount of the formatted price string,
 *  which works for major currencies and gives a "good enough"
 *  approximation for non-USD picker sessions. */
export const PriceBucket = {
  All: 'all',
  Under1: 'under-1',
  From1To10: '1-10',
  From10To50: '10-50',
  From50To100: '50-100',
  Over100: 'over-100',
} as const;
export type PriceBucket = typeof PriceBucket[keyof typeof PriceBucket];

export interface IAPPricePointInit {
  id: string;
  territoryId: string;
  formattedPrice: string;
  currency: string;
  proceeds: string;
}

/** Parse the leading numeric amount from a formatted price string like
 *  "$9.99", "¥1,500", "£7.99". Returns null when no number is found. */
function parseAmount(formatted: string): number | null {
  const cleaned = formatted.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * One Apple price-point. Read-only value object — the picker renders a
 * paginated list of these and the user clicks one to call `IAP.setPrice`.
 */
export class IAPPricePoint {
  readonly id: string;
  readonly territoryId: string;
  readonly formattedPrice: string;
  readonly currency: string;
  readonly proceeds: string;

  constructor(init: IAPPricePointInit) {
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

  get priceBucket(): PriceBucket {
    const amount = parseAmount(this.formattedPrice);
    if (amount === null) return PriceBucket.All;
    if (amount < 1) return PriceBucket.Under1;
    if (amount < 10) return PriceBucket.From1To10;
    if (amount < 50) return PriceBucket.From10To50;
    if (amount < 100) return PriceBucket.From50To100;
    return PriceBucket.Over100;
  }

  matchesBucket(bucket: PriceBucket): boolean {
    if (bucket === PriceBucket.All) return true;
    return this.priceBucket === bucket;
  }

  static fromJSON(json: Record<string, unknown>): IAPPricePoint {
    const territory = json.territory as Record<string, unknown> | undefined;
    return new IAPPricePoint({
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

/** A page of price points returned by the repository. */
export interface IAPPricePointPage {
  items: IAPPricePoint[];
  /** Pass back to the next call to fetch the next page. `null` when this
   *  is the last page. */
  nextCursor: string | null;
}
