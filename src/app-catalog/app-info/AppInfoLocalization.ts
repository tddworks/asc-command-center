import { makeAutoObservable } from 'mobx';

export interface AppInfoLocalizationInit {
  /** Backend resource id. Empty string for a locally-added locale awaiting save. */
  id: string;
  /** Locale code — identity from the user's perspective. Immutable. */
  locale: string;
  name: string;
  subtitle: string | null;
}

/**
 * One locale's textual metadata — name + subtitle (more fields may follow).
 * Owns its own dirty tracking via a pristine snapshot of the saved values.
 * Mutates in place; components wrapped in `observer()` re-render on change.
 */
export class AppInfoLocalization {
  id: string;
  readonly locale: string;
  name: string;
  subtitle: string | null;

  private snapshot: { id: string; name: string; subtitle: string | null };

  constructor(init: AppInfoLocalizationInit) {
    this.id = init.id;
    this.locale = init.locale;
    this.name = init.name;
    this.subtitle = init.subtitle;
    this.snapshot = { id: init.id, name: init.name, subtitle: init.subtitle };

    makeAutoObservable(this, { locale: false });
  }

  // ── Setters ──

  setName(name: string): void {
    this.name = name;
  }

  setSubtitle(subtitle: string | null): void {
    this.subtitle = subtitle;
  }

  // ── Dirty tracking ──

  get hasUnsavedChanges(): boolean {
    return (
      this.name !== this.snapshot.name ||
      this.subtitle !== this.snapshot.subtitle
    );
  }

  /** Restore the last-saved values — used by the page's Discard action. */
  discard(): void {
    this.name = this.snapshot.name;
    this.subtitle = this.snapshot.subtitle;
  }

  /** Move current values into the snapshot — called by AppInfo.save() after a
   *  successful write. An optional `id` lets the repository backfill the real
   *  backend id on a locale that was created locally. */
  markSaved(assignedId?: string): void {
    if (assignedId !== undefined) this.id = assignedId;
    this.snapshot = { id: this.id, name: this.name, subtitle: this.subtitle };
  }
}
