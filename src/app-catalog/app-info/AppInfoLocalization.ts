import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
// Type-only import — AppInfoRepository depends on AppInfo which depends on
// AppInfoLocalization. The cycle only exists at the type level; this keeps
// runtime module resolution clean.
import type { AppInfoRepository } from './AppInfoRepository.ts';

export interface AppInfoLocalizationInit {
  /** Backend resource id. Empty string for a locally-added locale awaiting save. */
  id: string;
  /** Locale code — identity from the user's perspective. Immutable. */
  locale: string;
  name: string;
  subtitle: string | null;
  /** Per-locale privacy URLs — Apple's AppInfoLocalization resource owns these,
   *  not AppInfo. The aggregate's `privacyPolicyUrl` getter delegates here. */
  privacyPolicyUrl?: string | null;
  privacyChoicesUrl?: string | null;
  /** HATEOAS affordances on the localization resource (update, delete, …). */
  affordances?: Affordances;
}

interface Snapshot {
  id: string;
  name: string;
  subtitle: string | null;
  privacyPolicyUrl: string | null;
  privacyChoicesUrl: string | null;
}

/**
 * One locale's textual metadata — name, subtitle, and privacy URLs.
 * Owns its own dirty tracking via a pristine snapshot of the saved values.
 * Mutates in place; components wrapped in `observer()` re-render on change.
 */
export class AppInfoLocalization {
  id: string;
  readonly locale: string;
  name: string;
  subtitle: string | null;
  privacyPolicyUrl: string | null;
  privacyChoicesUrl: string | null;
  affordances: Affordances;

  /** Repository handle the entity uses to save/delete itself. Attached by the
   *  parent aggregate (`AppInfo.setRepository`) after hydrate or after a
   *  successful create, so each locale owns its own lifecycle. */
  repository: AppInfoRepository | null = null;

  private snapshot: Snapshot;

  constructor(init: AppInfoLocalizationInit) {
    this.id = init.id;
    this.locale = init.locale;
    this.name = init.name;
    this.subtitle = init.subtitle;
    this.privacyPolicyUrl = init.privacyPolicyUrl ?? null;
    this.privacyChoicesUrl = init.privacyChoicesUrl ?? null;
    this.affordances = init.affordances ?? {};
    this.snapshot = this.captureSnapshot();

    makeAutoObservable(this, { locale: false, repository: false });
  }

  setRepository(repo: AppInfoRepository): void {
    this.repository = repo;
  }

  // ── Setters ──

  setName(name: string): void {
    this.name = name;
  }

  setSubtitle(subtitle: string | null): void {
    this.subtitle = subtitle;
  }

  setPrivacyPolicyUrl(url: string | null): void {
    this.privacyPolicyUrl = url;
  }

  setPrivacyChoicesUrl(url: string | null): void {
    this.privacyChoicesUrl = url;
  }

  // ── Capability checks ──
  //
  // The backend's affordance keys follow a `verb+resource` convention
  // (`updateVersion`, `updateCategories`, `updateAppInfoLocalization`). Older
  // fixtures and some endpoints use the shorter `update` / `delete`. We
  // accept every variant so REST + mock behave the same regardless of which
  // shape the backend ships.

  private static readonly UPDATE_KEYS = ['update', 'updateLocalization', 'updateAppInfoLocalization'] as const;
  private static readonly DELETE_KEYS = ['delete', 'deleteLocalization', 'deleteAppInfoLocalization'] as const;

  get canUpdate(): boolean {
    return AppInfoLocalization.UPDATE_KEYS.some((k) => k in this.affordances);
  }

  get canDelete(): boolean {
    return AppInfoLocalization.DELETE_KEYS.some((k) => k in this.affordances);
  }

  /** URL to PATCH this localization, or null when no affordance is exposed. */
  get updateUrl(): string | null {
    for (const key of AppInfoLocalization.UPDATE_KEYS) {
      const url = this.affordances[key];
      if (url) return url;
    }
    return null;
  }

  /** URL to DELETE this localization, or null when no affordance is exposed. */
  get deleteUrl(): string | null {
    for (const key of AppInfoLocalization.DELETE_KEYS) {
      const url = this.affordances[key];
      if (url) return url;
    }
    return null;
  }

  // ── Dirty tracking ──

  get hasUnsavedChanges(): boolean {
    return (
      this.name !== this.snapshot.name ||
      this.subtitle !== this.snapshot.subtitle ||
      this.privacyPolicyUrl !== this.snapshot.privacyPolicyUrl ||
      this.privacyChoicesUrl !== this.snapshot.privacyChoicesUrl
    );
  }

  /** Restore the last-saved values — used by the page's Discard action. */
  discard(): void {
    this.name = this.snapshot.name;
    this.subtitle = this.snapshot.subtitle;
    this.privacyPolicyUrl = this.snapshot.privacyPolicyUrl;
    this.privacyChoicesUrl = this.snapshot.privacyChoicesUrl;
  }

  /** Move current values into the snapshot — called after a successful write.
   *  An optional `id` lets the repository backfill the real backend id on a
   *  locale that was created locally. */
  markSaved(assignedId?: string): void {
    if (assignedId !== undefined) this.id = assignedId;
    this.snapshot = this.captureSnapshot();
  }

  // ── Self-persistence ──
  //
  // Each localization owns its own save/delete so the aggregate just has to
  // orchestrate — iterate its children, call `loc.save()` on the dirty ones,
  // `loc.delete()` on the removed ones. The aggregate never speaks HTTP.

  async save(): Promise<void> {
    if (!this.repository) {
      throw new Error(`AppInfoLocalization ${this.id || '(new)'} has no repository attached`);
    }
    await this.repository.saveLocalization(this);
    runInAction(() => this.markSaved());
  }

  async delete(): Promise<void> {
    if (!this.repository) {
      throw new Error(`AppInfoLocalization ${this.id || '(new)'} has no repository attached`);
    }
    await this.repository.deleteLocalization(this);
  }

  private captureSnapshot(): Snapshot {
    return {
      id: this.id,
      name: this.name,
      subtitle: this.subtitle,
      privacyPolicyUrl: this.privacyPolicyUrl,
      privacyChoicesUrl: this.privacyChoicesUrl,
    };
  }

  // ── Factory ──

  /** Build a localization from the raw JSON shape the backend sends.
   *  Affordances are read as-already-flattened by `apiClient.normalizeLinks`. */
  static fromJSON(json: Record<string, unknown>): AppInfoLocalization {
    return new AppInfoLocalization({
      id: (json.id as string) ?? '',
      locale: (json.locale as string) ?? '',
      name: (json.name as string) ?? '',
      subtitle: (json.subtitle as string | null) ?? null,
      privacyPolicyUrl: (json.privacyPolicyUrl as string | null | undefined) ?? null,
      privacyChoicesUrl: (json.privacyChoicesUrl as string | null | undefined) ?? null,
      affordances: (json.affordances as Affordances | undefined) ?? {},
    });
  }
}
