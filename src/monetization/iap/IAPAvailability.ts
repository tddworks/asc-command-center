import { makeAutoObservable } from 'mobx';

export interface TerritoryAvailabilityInit {
  territoryId: string;
  territoryName: string;
  currency: string;
  isAvailable: boolean;
}

/**
 * One territory's availability flag. Mutable so the page can flip the
 * checkbox in place; the parent `IAPAvailability` watches the snapshot to
 * compute `isDirty`.
 */
export class TerritoryAvailability {
  readonly territoryId: string;
  readonly territoryName: string;
  readonly currency: string;
  isAvailable: boolean;

  constructor(init: TerritoryAvailabilityInit) {
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

export interface IAPAvailabilityInit {
  /** Apple's "include this IAP automatically when a new territory is
   *  added to the App Store" toggle. */
  availableInNewTerritories: boolean;
  territories: TerritoryAvailability[];
}

interface AvailabilitySnapshot {
  availableInNewTerritories: boolean;
  /** territoryId → isAvailable as of last save. */
  byId: Map<string, boolean>;
}

/**
 * Aggregate of one IAP's territory availability. Owns dirty tracking via
 * a snapshot so the page can render a Save bar that reflects the actual
 * pending changes — and revert via `discard()` cleanly.
 */
export class IAPAvailability {
  availableInNewTerritories: boolean;
  territories: TerritoryAvailability[];

  private snapshot: AvailabilitySnapshot;

  constructor(init: IAPAvailabilityInit) {
    this.availableInNewTerritories = init.availableInNewTerritories;
    this.territories = init.territories;
    this.snapshot = this.captureSnapshot();

    makeAutoObservable(this);
  }

  // ── Counts ──

  get totalCount(): number { return this.territories.length; }
  get availableCount(): number { return this.territories.filter((t) => t.isAvailable).length; }
  get unavailableCount(): number { return this.totalCount - this.availableCount; }

  /** All territory ids currently marked available — used by `setAvailability`
   *  to send Apple the canonical "available territories" list. */
  get availableTerritoryIds(): string[] {
    return this.territories.filter((t) => t.isAvailable).map((t) => t.territoryId);
  }

  // ── Filtering ──

  filtered(query: string): TerritoryAvailability[] {
    return this.territories.filter((t) => t.matches(query));
  }

  byId(id: string): TerritoryAvailability | undefined {
    return this.territories.find((t) => t.territoryId === id);
  }

  // ── Editing ──

  toggleTerritory(id: string): void {
    const t = this.byId(id);
    if (!t) return;
    t.isAvailable = !t.isAvailable;
  }

  /** Bulk-toggle every territory (or just the ones matching `predicate`)
   *  to `value`. Used by the page's "Select all visible" / "Deselect all"
   *  ellipsis-menu actions. */
  setAllAvailable(value: boolean, predicate?: (t: TerritoryAvailability) => boolean): void {
    for (const t of this.territories) {
      if (predicate && !predicate(t)) continue;
      t.isAvailable = value;
    }
  }

  setAvailableInNewTerritories(value: boolean): void {
    this.availableInNewTerritories = value;
  }

  // ── Snapshot / dirty tracking ──

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

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): IAPAvailability {
    const rows = (json.territories as Record<string, unknown>[] | undefined) ?? [];
    return new IAPAvailability({
      availableInNewTerritories: (json.availableInNewTerritories as boolean) ?? false,
      territories: rows.map((r) => {
        const territory = r.territory as Record<string, unknown> | undefined;
        return new TerritoryAvailability({
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
