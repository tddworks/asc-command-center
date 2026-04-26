import { makeAutoObservable } from 'mobx';

export interface TerritoryPriceInit {
  /** Apple territory id (e.g. "USA"). */
  territoryId: string;
  /** Country/region display name (e.g. "United States"). */
  territoryName: string;
  /** Local-currency formatted price as Apple returns it (e.g. "$9.99"). */
  formattedPrice: string;
  /** Three-letter currency code (e.g. "USD"). */
  currency: string;
  /** Price-point id Apple uses to identify this tier in this territory. */
  pricePointId: string;
}

/**
 * One territory's price for an IAP. Read-only value object — pricing edits
 * happen on the parent `IAPPriceSchedule` via aggregate-level mutators
 * once the create-price wizard lands in Phase 3.
 */
export class TerritoryPrice {
  readonly territoryId: string;
  readonly territoryName: string;
  readonly formattedPrice: string;
  readonly currency: string;
  readonly pricePointId: string;

  constructor(init: TerritoryPriceInit) {
    this.territoryId = init.territoryId;
    this.territoryName = init.territoryName;
    this.formattedPrice = init.formattedPrice;
    this.currency = init.currency;
    this.pricePointId = init.pricePointId;
  }

  /** Whether this row matches a free-text query against name, id, or
   *  currency. The pricing tab uses this for client-side filtering. */
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

  static fromJSON(json: Record<string, unknown>): TerritoryPrice {
    const territory = json.territory as Record<string, unknown> | undefined;
    return new TerritoryPrice({
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

export interface IAPPriceScheduleInit {
  /** Apple territory id of the base territory (e.g. "USA"). */
  baseTerritoryId: string;
  baseTerritoryName: string;
  /** Formatted base price (e.g. "$9.99"). May be empty when no schedule
   *  exists yet. */
  basePrice: string;
  baseCurrency: string;
  basePricePointId: string;
  territoryPrices: TerritoryPrice[];
}

/**
 * Snapshot of an IAP's pricing across every territory. Apple returns one
 * row per territory; the base territory drives equalization for the rest.
 *
 * Mutable today only via reload (`IAP.loadPriceSchedule`). The price-set
 * wizard ships in Phase 3 and will introduce `setBasePrice`/`changePrice`.
 */
export class IAPPriceSchedule {
  readonly baseTerritoryId: string;
  readonly baseTerritoryName: string;
  readonly basePrice: string;
  readonly baseCurrency: string;
  readonly basePricePointId: string;
  territoryPrices: TerritoryPrice[];

  constructor(init: IAPPriceScheduleInit) {
    this.baseTerritoryId = init.baseTerritoryId;
    this.baseTerritoryName = init.baseTerritoryName;
    this.basePrice = init.basePrice;
    this.baseCurrency = init.baseCurrency;
    this.basePricePointId = init.basePricePointId;
    this.territoryPrices = init.territoryPrices;

    makeAutoObservable(this, {
      baseTerritoryId: false,
      baseTerritoryName: false,
      basePrice: false,
      baseCurrency: false,
      basePricePointId: false,
    });
  }

  // ── Display ──

  get territoryCount(): number { return this.territoryPrices.length; }

  /** Filter the territory list by a free-text query and return a new array
   *  (the page renders this directly — original list stays sorted). */
  filteredTerritoryPrices(query: string): TerritoryPrice[] {
    return this.territoryPrices.filter((p) => p.matches(query));
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): IAPPriceSchedule {
    const base = json.baseTerritory as Record<string, unknown> | undefined;
    const baseTerritoryId = (json.baseTerritoryId as string) ?? (base?.id as string) ?? '';
    const baseTerritoryName =
      (json.baseTerritoryName as string) ??
      (base?.displayName as string) ??
      (base?.name as string) ??
      baseTerritoryId;
    const baseCurrency =
      (json.baseCurrency as string) ??
      (base?.currency as string) ??
      '';
    const basePrice =
      (json.basePrice as string) ??
      (json.formattedBasePrice as string) ??
      '';
    const basePricePointId =
      (json.basePricePointId as string) ??
      ((json.basePricePoint as Record<string, unknown> | undefined)?.id as string) ??
      '';
    const rows = (json.territoryPrices as Record<string, unknown>[] | undefined) ?? [];
    return new IAPPriceSchedule({
      baseTerritoryId,
      baseTerritoryName,
      basePrice,
      baseCurrency,
      basePricePointId,
      territoryPrices: rows.map(TerritoryPrice.fromJSON),
    });
  }
}
