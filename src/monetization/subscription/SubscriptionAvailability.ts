import { makeAutoObservable } from 'mobx';

export interface SubscriptionTerritoryAvailabilityInit {
  territoryId: string;
  territoryName: string;
  currency: string;
  isAvailable: boolean;
}

export class SubscriptionTerritoryAvailability {
  readonly territoryId: string;
  readonly territoryName: string;
  readonly currency: string;
  isAvailable: boolean;

  constructor(init: SubscriptionTerritoryAvailabilityInit) {
    this.territoryId = init.territoryId;
    this.territoryName = init.territoryName;
    this.currency = init.currency;
    this.isAvailable = init.isAvailable;

    makeAutoObservable(this, { territoryId: false, territoryName: false, currency: false });
  }

  matches(query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
      this.territoryName.toLowerCase().includes(needle) ||
      this.territoryId.toLowerCase().includes(needle) ||
      this.currency.toLowerCase().includes(needle)
    );
  }
}

export interface SubscriptionAvailabilityInit {
  availableInNewTerritories: boolean;
  territories: SubscriptionTerritoryAvailability[];
}

interface AvailabilitySnapshot {
  availableInNewTerritories: boolean;
  byId: Map<string, boolean>;
}

/** Mirrors `IAPAvailability` shape — same dirty-tracking behaviour because
 *  Apple's resource is the same. Lives in the subscription slice because
 *  it routes through `SubscriptionRepository.setAvailability`. */
export class SubscriptionAvailability {
  availableInNewTerritories: boolean;
  territories: SubscriptionTerritoryAvailability[];

  private snapshot: AvailabilitySnapshot;

  constructor(init: SubscriptionAvailabilityInit) {
    this.availableInNewTerritories = init.availableInNewTerritories;
    this.territories = init.territories;
    this.snapshot = this.captureSnapshot();

    makeAutoObservable(this);
  }

  get totalCount(): number { return this.territories.length; }
  get availableCount(): number { return this.territories.filter((t) => t.isAvailable).length; }
  get unavailableCount(): number { return this.totalCount - this.availableCount; }

  get availableTerritoryIds(): string[] {
    return this.territories.filter((t) => t.isAvailable).map((t) => t.territoryId);
  }

  filtered(query: string): SubscriptionTerritoryAvailability[] {
    return this.territories.filter((t) => t.matches(query));
  }

  byId(id: string): SubscriptionTerritoryAvailability | undefined {
    return this.territories.find((t) => t.territoryId === id);
  }

  toggleTerritory(id: string): void {
    const t = this.byId(id);
    if (!t) return;
    t.isAvailable = !t.isAvailable;
  }

  setAllAvailable(value: boolean, predicate?: (t: SubscriptionTerritoryAvailability) => boolean): void {
    for (const t of this.territories) {
      if (predicate && !predicate(t)) continue;
      t.isAvailable = value;
    }
  }

  setAvailableInNewTerritories(value: boolean): void {
    this.availableInNewTerritories = value;
  }

  get isDirty(): boolean {
    if (this.availableInNewTerritories !== this.snapshot.availableInNewTerritories) return true;
    for (const t of this.territories) {
      if (this.snapshot.byId.get(t.territoryId) !== t.isAvailable) return true;
    }
    return false;
  }

  discard(): void {
    this.availableInNewTerritories = this.snapshot.availableInNewTerritories;
    for (const t of this.territories) {
      const original = this.snapshot.byId.get(t.territoryId);
      if (original !== undefined) t.isAvailable = original;
    }
  }

  markSaved(): void {
    this.snapshot = this.captureSnapshot();
  }

  private captureSnapshot(): AvailabilitySnapshot {
    const byId = new Map<string, boolean>();
    for (const t of this.territories) byId.set(t.territoryId, t.isAvailable);
    return { availableInNewTerritories: this.availableInNewTerritories, byId };
  }

  static fromJSON(json: Record<string, unknown>): SubscriptionAvailability {
    const rows = (json.territories as Record<string, unknown>[] | undefined) ?? [];
    return new SubscriptionAvailability({
      availableInNewTerritories: (json.availableInNewTerritories as boolean) ?? false,
      territories: rows.map((r) => {
        const territory = r.territory as Record<string, unknown> | undefined;
        return new SubscriptionTerritoryAvailability({
          territoryId: (r.id as string) ?? (r.territoryId as string) ?? (territory?.id as string) ?? '',
          territoryName:
            (r.name as string) ??
            (r.territoryName as string) ??
            (territory?.displayName as string) ??
            (territory?.name as string) ??
            ((r.id as string) ?? (territory?.id as string) ?? ''),
          currency: (r.currency as string) ?? (territory?.currency as string) ?? '',
          isAvailable: (r.isAvailable as boolean) ?? false,
        });
      }),
    });
  }
}
