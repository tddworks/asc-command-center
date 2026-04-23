import { makeAutoObservable } from 'mobx';
import type { Affordances } from '../../shared/types.ts';

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

    makeAutoObservable(this, { locale: false });
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

  get canUpdate(): boolean {
    return 'update' in this.affordances;
  }

  get canDelete(): boolean {
    return 'delete' in this.affordances;
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
