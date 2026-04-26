import { makeAutoObservable } from 'mobx';

export interface SubscriptionTerritoryPriceInit {
  territoryId: string;
  territoryName: string;
  formattedPrice: string;
  currency: string;
  pricePointId: string;
}

/** One territory's price for a Subscription tier. Read-only value object —
 *  pricing edits arrive in the create-price wizard slice (Phase 4). Mirrors
 *  IAP's `TerritoryPrice` shape because Apple's payload is the same. */
export class SubscriptionTerritoryPrice {
  readonly territoryId: string;
  readonly territoryName: string;
  readonly formattedPrice: string;
  readonly currency: string;
  readonly pricePointId: string;

  constructor(init: SubscriptionTerritoryPriceInit) {
    this.territoryId = init.territoryId;
    this.territoryName = init.territoryName;
    this.formattedPrice = init.formattedPrice;
    this.currency = init.currency;
    this.pricePointId = init.pricePointId;
  }

  matches(query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
      this.territoryName.toLowerCase().includes(needle) ||
      this.territoryId.toLowerCase().includes(needle) ||
      this.currency.toLowerCase().includes(needle) ||
      this.formattedPrice.toLowerCase().includes(needle)
    );
  }

  static fromJSON(json: Record<string, unknown>): SubscriptionTerritoryPrice {
    const territory = json.territory as Record<string, unknown> | undefined;
    return new SubscriptionTerritoryPrice({
      territoryId: (json.territoryId as string) ?? (territory?.id as string) ?? '',
      territoryName:
        (json.territoryName as string) ??
        (territory?.displayName as string) ??
        (territory?.name as string) ??
        ((json.territoryId as string) ?? (territory?.id as string) ?? ''),
      formattedPrice:
        (json.formattedPrice as string) ??
        (json.customerPrice as string) ??
        (json.price as string) ??
        '',
      currency:
        (json.currency as string) ??
        (territory?.currency as string) ??
        '',
      pricePointId:
        (json.pricePointId as string) ??
        ((json.pricePoint as Record<string, unknown> | undefined)?.id as string) ??
        '',
    });
  }
}

export interface SubscriptionPriceScheduleInit {
  territoryPrices: SubscriptionTerritoryPrice[];
}

/**
 * Snapshot of a Subscription tier's pricing across territories. Unlike IAP,
 * subscriptions have no "base territory" concept — Apple equalises off the
 * first territory passed to `setPrices` and exposes the result as a flat
 * list. The setter wizard ships in Phase 4.
 */
export class SubscriptionPriceSchedule {
  territoryPrices: SubscriptionTerritoryPrice[];

  constructor(init: SubscriptionPriceScheduleInit) {
    this.territoryPrices = init.territoryPrices;

    makeAutoObservable(this);
  }

  get territoryCount(): number { return this.territoryPrices.length; }

  filteredTerritoryPrices(query: string): SubscriptionTerritoryPrice[] {
    return this.territoryPrices.filter((p) => p.matches(query));
  }

  static fromJSON(json: Record<string, unknown>): SubscriptionPriceSchedule {
    const rows = (json.territoryPrices as Record<string, unknown>[] | undefined) ?? [];
    return new SubscriptionPriceSchedule({
      territoryPrices: rows.map(SubscriptionTerritoryPrice.fromJSON),
    });
  }
}
