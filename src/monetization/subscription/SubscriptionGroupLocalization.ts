import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
import type { SubscriptionGroupRepository } from './SubscriptionGroupRepository.ts';

export interface SubscriptionGroupLocalizationInit {
  id: string;
  locale: string;
  name: string;
  /** Optional override for the app name when this group is shown in the
   *  device's subscription management UI. Apple lets the developer surface
   *  a different name here so users see "Premium Plans" instead of the
   *  bundle name. */
  customAppName: string | null;
  affordances?: Affordances;
}

interface Snapshot {
  id: string;
  name: string;
  customAppName: string | null;
}

/** App Store enforces 30 chars on both fields for group localizations. */
export const SUBSCRIPTION_GROUP_NAME_LIMIT = 30;
export const SUBSCRIPTION_GROUP_CUSTOM_APP_NAME_LIMIT = 30;

/**
 * One locale's display name + custom app name for a SubscriptionGroup.
 * Mirrors the snapshot/dirty-tracking pattern of the IAP and tier
 * localization classes — separate slice because group localizations route
 * through a different repository port.
 */
export class SubscriptionGroupLocalization {
  id: string;
  readonly locale: string;
  name: string;
  customAppName: string | null;
  affordances: Affordances;

  repository: SubscriptionGroupRepository | null = null;

  private snapshot: Snapshot;

  constructor(init: SubscriptionGroupLocalizationInit) {
    this.id = init.id;
    this.locale = init.locale;
    this.name = init.name;
    this.customAppName = init.customAppName;
    this.affordances = init.affordances ?? {};
    this.snapshot = this.captureSnapshot();

    makeAutoObservable(this, { locale: false, repository: false });
  }

  setRepository(repo: SubscriptionGroupRepository): void {
    this.repository = repo;
  }

  // ── Setters ──

  setName(name: string): void { this.name = name; }
  setCustomAppName(value: string | null): void { this.customAppName = value; }

  // ── Capability checks ──

  private static readonly UPDATE_KEYS = ['update', 'updateLocalization'] as const;
  private static readonly DELETE_KEYS = ['delete', 'deleteLocalization'] as const;

  get canUpdate(): boolean {
    return SubscriptionGroupLocalization.UPDATE_KEYS.some((k) => k in this.affordances);
  }

  get canDelete(): boolean {
    return SubscriptionGroupLocalization.DELETE_KEYS.some((k) => k in this.affordances);
  }

  // ── Display helpers ──

  get isNew(): boolean { return this.id === ''; }

  get isComplete(): boolean {
    return !!this.name && this.name.trim().length > 0;
  }

  get nameRemaining(): number {
    return SUBSCRIPTION_GROUP_NAME_LIMIT - (this.name?.length ?? 0);
  }

  get customAppNameRemaining(): number {
    return SUBSCRIPTION_GROUP_CUSTOM_APP_NAME_LIMIT - (this.customAppName?.length ?? 0);
  }

  // ── Dirty tracking ──

  get hasUnsavedChanges(): boolean {
    return (
      this.name !== this.snapshot.name ||
      this.customAppName !== this.snapshot.customAppName
    );
  }

  discard(): void {
    this.name = this.snapshot.name;
    this.customAppName = this.snapshot.customAppName;
  }

  markSaved(assignedId?: string): void {
    if (assignedId !== undefined) this.id = assignedId;
    this.snapshot = this.captureSnapshot();
  }

  // ── Self-persistence ──

  async save(): Promise<void> {
    if (!this.repository) {
      throw new Error(`SubscriptionGroupLocalization ${this.id || '(new)'} has no repository attached`);
    }
    await this.repository.saveGroupLocalization(this);
    runInAction(() => this.markSaved());
  }

  async delete(): Promise<void> {
    if (!this.repository) {
      throw new Error(`SubscriptionGroupLocalization ${this.id || '(new)'} has no repository attached`);
    }
    await this.repository.deleteGroupLocalization(this);
  }

  private captureSnapshot(): Snapshot {
    return { id: this.id, name: this.name, customAppName: this.customAppName };
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): SubscriptionGroupLocalization {
    return new SubscriptionGroupLocalization({
      id: (json.id as string) ?? '',
      locale: (json.locale as string) ?? '',
      name: (json.name as string) ?? '',
      customAppName: (json.customAppName as string | null | undefined) ?? null,
      affordances: (json.affordances as Affordances | undefined) ?? {},
    });
  }
}
