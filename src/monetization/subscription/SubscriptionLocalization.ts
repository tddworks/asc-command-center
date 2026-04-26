import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
import type { SubscriptionRepository } from './SubscriptionRepository.ts';

export interface SubscriptionLocalizationInit {
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
 *  subscription localizations. Same limits as IAP localizations. */
export const SUBSCRIPTION_LOCALIZATION_NAME_LIMIT = 30;
export const SUBSCRIPTION_LOCALIZATION_DESCRIPTION_LIMIT = 45;

/**
 * One locale's name + description for a Subscription tier. Mirrors
 * `InAppPurchaseLocalization` exactly — same fields, same dirty-tracking
 * rules, same self-persistence shape — because Apple's
 * SubscriptionLocalization resource is the same shape as
 * InAppPurchaseLocalization. They live in separate slices because they're
 * separate Apple resources and the affordances on each side route through
 * different repository ports.
 */
export class SubscriptionLocalization {
  id: string;
  readonly locale: string;
  name: string;
  description: string | null;
  affordances: Affordances;

  /** Repository handle for save/delete. Attached by the parent
   *  Subscription after hydrate or after a successful create. */
  repository: SubscriptionRepository | null = null;

  private snapshot: Snapshot;

  constructor(init: SubscriptionLocalizationInit) {
    this.id = init.id;
    this.locale = init.locale;
    this.name = init.name;
    this.description = init.description;
    this.affordances = init.affordances ?? {};
    this.snapshot = this.captureSnapshot();

    makeAutoObservable(this, { locale: false, repository: false });
  }

  setRepository(repo: SubscriptionRepository): void {
    this.repository = repo;
  }

  // ── Setters ──

  setName(name: string): void { this.name = name; }
  setDescription(description: string | null): void { this.description = description; }

  // ── Capability checks ──

  private static readonly UPDATE_KEYS = ['update', 'updateLocalization'] as const;
  private static readonly DELETE_KEYS = ['delete', 'deleteLocalization'] as const;

  get canUpdate(): boolean {
    return SubscriptionLocalization.UPDATE_KEYS.some((k) => k in this.affordances);
  }

  get canDelete(): boolean {
    return SubscriptionLocalization.DELETE_KEYS.some((k) => k in this.affordances);
  }

  get updateUrl(): string | null {
    for (const k of SubscriptionLocalization.UPDATE_KEYS) {
      const u = this.affordances[k];
      if (u) return u;
    }
    return null;
  }

  get deleteUrl(): string | null {
    for (const k of SubscriptionLocalization.DELETE_KEYS) {
      const u = this.affordances[k];
      if (u) return u;
    }
    return null;
  }

  // ── Display helpers ──

  get isNew(): boolean { return this.id === ''; }

  get isComplete(): boolean {
    return !!this.name && this.name.trim().length > 0;
  }

  get nameRemaining(): number {
    return SUBSCRIPTION_LOCALIZATION_NAME_LIMIT - (this.name?.length ?? 0);
  }

  get descriptionRemaining(): number {
    return SUBSCRIPTION_LOCALIZATION_DESCRIPTION_LIMIT - (this.description?.length ?? 0);
  }

  // ── Dirty tracking ──

  get hasUnsavedChanges(): boolean {
    return (
      this.name !== this.snapshot.name ||
      this.description !== this.snapshot.description
    );
  }

  discard(): void {
    this.name = this.snapshot.name;
    this.description = this.snapshot.description;
  }

  markSaved(assignedId?: string): void {
    if (assignedId !== undefined) this.id = assignedId;
    this.snapshot = this.captureSnapshot();
  }

  // ── Self-persistence ──

  async save(): Promise<void> {
    if (!this.repository) {
      throw new Error(`SubscriptionLocalization ${this.id || '(new)'} has no repository attached`);
    }
    await this.repository.saveLocalization(this);
    runInAction(() => this.markSaved());
  }

  async delete(): Promise<void> {
    if (!this.repository) {
      throw new Error(`SubscriptionLocalization ${this.id || '(new)'} has no repository attached`);
    }
    await this.repository.deleteLocalization(this);
  }

  private captureSnapshot(): Snapshot {
    return { id: this.id, name: this.name, description: this.description };
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): SubscriptionLocalization {
    return new SubscriptionLocalization({
      id: (json.id as string) ?? '',
      locale: (json.locale as string) ?? '',
      name: (json.name as string) ?? '',
      description: (json.description as string | null | undefined) ?? null,
      affordances: (json.affordances as Affordances | undefined) ?? {},
    });
  }
}
