import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
// Type-only import — InAppPurchaseRepository depends on InAppPurchase which
// depends on this child class. The cycle exists only at the type level.
import type { InAppPurchaseRepository } from './InAppPurchaseRepository.ts';

export interface InAppPurchaseLocalizationInit {
  /** Backend resource id. Empty string for a locally-added locale awaiting save. */
  id: string;
  /** Locale code — identity from the user's perspective. Immutable. */
  locale: string;
  name: string;
  description: string | null;
  affordances?: Affordances;
}

interface Snapshot {
  id: string;
  name: string;
  description: string | null;
}

/** App Store enforces 30 chars on display name and 45 on description for
 *  IAP localizations. The page reads these to render the live counter. */
export const IAP_LOCALIZATION_NAME_LIMIT = 30;
export const IAP_LOCALIZATION_DESCRIPTION_LIMIT = 45;

/**
 * One locale's name + description for an InAppPurchase.
 *
 * Owns its own dirty tracking via a pristine snapshot of the saved values,
 * mirroring the AppInfoLocalization pattern. Mutates in place; components
 * wrapped in `observer()` re-render on change. The parent IAP attaches a
 * repository handle so the locale can save/delete itself.
 */
export class InAppPurchaseLocalization {
  id: string;
  readonly locale: string;
  name: string;
  description: string | null;
  affordances: Affordances;

  /** Repository handle for save/delete. Attached by the parent IAP after
   *  hydrate or after a successful create. */
  repository: InAppPurchaseRepository | null = null;

  private snapshot: Snapshot;

  constructor(init: InAppPurchaseLocalizationInit) {
    this.id = init.id;
    this.locale = init.locale;
    this.name = init.name;
    this.description = init.description;
    this.affordances = init.affordances ?? {};
    this.snapshot = this.captureSnapshot();

    makeAutoObservable(this, { locale: false, repository: false });
  }

  setRepository(repo: InAppPurchaseRepository): void {
    this.repository = repo;
  }

  // ── Setters ──

  setName(name: string): void {
    this.name = name;
  }

  setDescription(description: string | null): void {
    this.description = description;
  }

  // ── Capability checks ──
  //
  // Backend variants: short `update`/`delete` and long
  // `updateLocalization`/`deleteLocalization`. Accept both so REST and mock
  // behave identically regardless of which the asc backend ships.

  private static readonly UPDATE_KEYS = ['update', 'updateLocalization'] as const;
  private static readonly DELETE_KEYS = ['delete', 'deleteLocalization'] as const;

  get canUpdate(): boolean {
    return InAppPurchaseLocalization.UPDATE_KEYS.some((k) => k in this.affordances);
  }

  get canDelete(): boolean {
    return InAppPurchaseLocalization.DELETE_KEYS.some((k) => k in this.affordances);
  }

  get updateUrl(): string | null {
    for (const k of InAppPurchaseLocalization.UPDATE_KEYS) {
      const u = this.affordances[k];
      if (u) return u;
    }
    return null;
  }

  get deleteUrl(): string | null {
    for (const k of InAppPurchaseLocalization.DELETE_KEYS) {
      const u = this.affordances[k];
      if (u) return u;
    }
    return null;
  }

  // ── Display helpers ──

  /** True for a locale that hasn't been saved to the backend yet (id ===
   *  ''). The page disables Save until at least one field is set and
   *  hides Delete entirely (use the page-level Discard instead). */
  get isNew(): boolean {
    return this.id === '';
  }

  /** A locale is "complete" when it has at least a non-empty display name —
   *  description is optional per Apple's API. The aggregate uses this in
   *  `completionCount` so the Submit gate can show the missing-metadata
   *  warning. */
  get isComplete(): boolean {
    return !!this.name && this.name.trim().length > 0;
  }

  get nameRemaining(): number {
    return IAP_LOCALIZATION_NAME_LIMIT - (this.name?.length ?? 0);
  }

  get descriptionRemaining(): number {
    return IAP_LOCALIZATION_DESCRIPTION_LIMIT - (this.description?.length ?? 0);
  }

  // ── Dirty tracking ──

  get hasUnsavedChanges(): boolean {
    return (
      this.name !== this.snapshot.name ||
      this.description !== this.snapshot.description
    );
  }

  /** Restore last-saved values — used by the per-card Discard button. */
  discard(): void {
    this.name = this.snapshot.name;
    this.description = this.snapshot.description;
  }

  /** Move current values into the snapshot — called after a successful
   *  write. The optional `assignedId` lets the repository backfill the
   *  real backend id on a locale that was created locally. */
  markSaved(assignedId?: string): void {
    if (assignedId !== undefined) this.id = assignedId;
    this.snapshot = this.captureSnapshot();
  }

  // ── Self-persistence ──

  async save(): Promise<void> {
    if (!this.repository) {
      throw new Error(`InAppPurchaseLocalization ${this.id || '(new)'} has no repository attached`);
    }
    await this.repository.saveLocalization(this);
    runInAction(() => this.markSaved());
  }

  async delete(): Promise<void> {
    if (!this.repository) {
      throw new Error(`InAppPurchaseLocalization ${this.id || '(new)'} has no repository attached`);
    }
    await this.repository.deleteLocalization(this);
  }

  private captureSnapshot(): Snapshot {
    return { id: this.id, name: this.name, description: this.description };
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): InAppPurchaseLocalization {
    return new InAppPurchaseLocalization({
      id: (json.id as string) ?? '',
      locale: (json.locale as string) ?? '',
      name: (json.name as string) ?? '',
      description: (json.description as string | null | undefined) ?? null,
      affordances: (json.affordances as Affordances | undefined) ?? {},
    });
  }
}
