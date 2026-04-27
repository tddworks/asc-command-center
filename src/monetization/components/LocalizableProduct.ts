/**
 * Structural interfaces shared by `InAppPurchase` and `Subscription` for the
 * Localizations / Availability / Add-Languages views. Both concrete domain
 * classes already satisfy these via TypeScript's structural typing — no
 * `implements` needed.
 *
 * The shared components live in `src/monetization/components/` and depend
 * only on these interfaces, not on either slice's concrete classes. That
 * keeps slices closed (per CLAUDE.md's "slices depend on each other's
 * domain class only" rule) while letting the components share UI.
 */

import type { TextEditKind } from '../../extensibility/plugin/slots.ts';

export interface LocalizationLike {
  /** Backend resource id — empty for a locally-added locale awaiting save. */
  readonly id: string;
  readonly locale: string;
  name: string;
  description: string | null;
  readonly isComplete: boolean;
  readonly isNew: boolean;
  readonly hasUnsavedChanges: boolean;
  readonly canUpdate: boolean;
  readonly canDelete: boolean;
  readonly nameRemaining: number;
  readonly descriptionRemaining: number;
  setName(v: string): void;
  setDescription(v: string | null): void;
  save(): Promise<void>;
  delete(): Promise<void>;
  discard(): void;
}

export interface ProductWithLocalizations<L extends LocalizationLike = LocalizationLike> {
  readonly localizations: L[];
  readonly isLocalizationsLoaded: boolean;
  readonly canViewLocalizations: boolean;
  readonly canCreateLocalization: boolean;
  loadLocalizations(): Promise<unknown>;
  addLocalization(input: { locale: string; name: string; description?: string | null }): Promise<unknown>;
  removeLocalization(loc: L): Promise<void>;
}

/** Per-product UI configuration — the bits that can't be inferred from the
 *  domain (display label, char limits, AI prompt context). */
export interface LocalizationsConfig {
  /** Title-bar context, e.g. `"Premium Upgrade"` (IAP referenceName) or
   *  `"Premium Monthly"` (Subscription name). Used inside the modal. */
  productLabel: string;
  /** App-Store name char limit (30 today for both slices). */
  nameLimit: number;
  /** Description char limit (45 today for both slices). */
  descriptionLimit: number;
  /** `text.edit` slot kinds for the name + description inputs. The plugin
   *  filters per-kind via `enhancementsFor(kind)`, which is how IAP and
   *  subscription localizations get distinct AI behavior without the
   *  shared component knowing which slice it's in. */
  slotKinds: { name: TextEditKind; description: TextEditKind };
  /** App's primary locale (e.g. `'en-US'`). Drives the "Primary" / "SOURCE"
   *  badges and auto-selection in `AddLanguagesSheet`. Threaded from
   *  `workspace.currentApp.primaryLocale` by the slice wrapper. */
  primaryLocale: string;
}

// ── Availability ──────────────────────────────────────────────────

export interface TerritoryAvailabilityLike {
  readonly territoryId: string;
  readonly territoryName: string;
  readonly currency: string;
  isAvailable: boolean;
  matches(query: string): boolean;
}

export interface AvailabilityLike<T extends TerritoryAvailabilityLike = TerritoryAvailabilityLike> {
  availableInNewTerritories: boolean;
  readonly territories: T[];
  readonly availableCount: number;
  readonly totalCount: number;
  readonly isDirty: boolean;
  filtered(query: string): T[];
  toggleTerritory(id: string): void;
  setAllAvailable(value: boolean, predicate?: (t: T) => boolean): void;
  setAvailableInNewTerritories(value: boolean): void;
  discard(): void;
}

export interface ProductWithAvailability<
  T extends TerritoryAvailabilityLike = TerritoryAvailabilityLike,
  A extends AvailabilityLike<T> = AvailabilityLike<T>,
> {
  readonly availability: A | null;
  readonly isAvailabilityLoaded: boolean;
  readonly canViewAvailability: boolean;
  readonly canSetAvailability: boolean;
  loadAvailability(): Promise<unknown>;
  saveAvailability(): Promise<void>;
}

export interface AvailabilityConfig {
  /** Used in the auto-include hint: "Apple will include this <kind>
   *  automatically when a new territory is added." */
  productKind: string;
}

/** Structural shape that both `TerritoryPrice` (IAP) and
 *  `SubscriptionTerritoryPrice` already satisfy. Lets the shared territory
 *  price table render either without coupling to a slice. */
export interface TerritoryPriceLike {
  readonly territoryId: string;
  readonly territoryName: string;
  readonly formattedPrice: string;
  readonly currency: string;
}
